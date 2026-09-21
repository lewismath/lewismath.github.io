(function () {
  'use strict';
  var HEM = window.HEM;
  var HOUR_MS = 3600000;
  var FRAME_MS = 50;             // draw at most 20 times a second
  var SPARK_EVERY_MS = 1000;
  var ANNOUNCE_EVERY_MS = 60000; // screen-reader announcements at most once a minute

  var DEFAULT_CONFIG = {
    version: 1, window_seconds: 60, smoothing_seconds: 5, min_words: 20,
    midpoint: 5.93, range: 0.12, bands: [5.90, 5.92, 5.94, 5.96],
    stall_seconds: 45, fallback_after_seconds: 12, failed_attempts_before_fallback: 4, hidden_pause_seconds: 60,
    backoff_start_seconds: 1, backoff_max_seconds: 30,
    hosts: ['jetstream1.us-east.bsky.network', 'jetstream2.us-east.bsky.network',
            'jetstream1.us-west.bsky.network', 'jetstream2.us-west.bsky.network']
  };
  var STATUS_TEXT = {
    fallback: 'Replaying a recorded day',
    reconnecting: 'Reconnecting to Bluesky',
    paused: 'Paused while this tab is hidden'
  };
  var ILLUSTRATIVE_TEXT = 'Showing an illustrative day (not live data)';   // the fallback day is made up, not recorded
  var DEMO_TEXT = 'Demo value';                                            // a page opened with ?demo= is not a real reading

  function byId(id) { return document.getElementById(id); }

  function statusText(state) {
    if (isFinite(state.demo)) { return DEMO_TEXT; }
    if (state.mode === 'fallback' && state.synthetic) { return ILLUSTRATIVE_TEXT; }
    return STATUS_TEXT[state.mode] || '';
  }

  function setText(element, text) {
    if (element.textContent !== text) { element.textContent = text; }
  }

  function fetchJson(path, version) {
    return fetch(path + '?v=' + encodeURIComponent(version)).then(function (response) {
      if (!response.ok) { throw new Error(path + ': HTTP ' + response.status); }
      return response.json();
    });
  }

  // A gentle made-up day, used only if data/day.json cannot be loaded.
  function syntheticDay() {
    var scores = [];
    for (var i = 0; i < 2880; i++) { scores.push(5.93 + 0.03 * Math.sin(2 * Math.PI * (i / 2880 - 0.6))); }
    return { version: 1, step_seconds: 30, scores: scores, synthetic: true };
  }

  function paintSparkGradient() {
    var gradient = byId('tide-y');
    if (gradient.childNodes.length > 0) { return; }   // already painted (start() can run again as the fallback)
    var stops = HEM.TIDE_STOPS;
    stops.forEach(function (rgb, i) {
      var stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', String(i / (stops.length - 1)));
      stop.setAttribute('stop-color', 'rgb(' + rgb.join(',') + ')');
      gradient.appendChild(stop);
    });
  }

  function pathFrom(points) {
    var d = '';
    var pen = false;
    points.forEach(function (p) {
      if (p === null) { pen = false; return; }
      d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      pen = true;
    });
    return d;
  }

  function drawSpark(state, now) {
    var cfg = state.cfg;
    function y(score) { return 86 - HEM.scoreToT(score, cfg.midpoint, cfg.range) * 82; }
    if (!state.synthetic) {   // a made-up day is not a "typical" trace: draw the live line only
      var typical = state.day.trace(now, HOUR_MS, 60).map(function (score, i, all) {
        return score === null ? null : [400 * i / (all.length - 1), y(score)];
      });
      byId('spark-typical').setAttribute('d', pathFrom(typical));
    }
    var points = state.history.points
      .filter(function (p) { return p[0] >= now - HOUR_MS; })
      .map(function (p) { return [400 * (1 - (now - p[0]) / HOUR_MS), y(p[1])]; });
    byId('spark-live').setAttribute('d', points.length > 1 ? pathFrom(points) : '');
    var dot = byId('spark-dot');
    if (points.length > 0) {
      var last = points[points.length - 1];
      dot.setAttribute('cx', last[0].toFixed(1));
      dot.setAttribute('cy', last[1].toFixed(1));
      dot.setAttribute('visibility', 'visible');
    } else {
      dot.setAttribute('visibility', 'hidden');
    }
  }

  function render(state, view, now) {
    // 'connecting' also covers the return from a paused tab: show Listening until the stream delivers a post again.
    var listening = view.listening || state.mode === 'connecting';
    var visualState = listening ? 'listening' : state.mode;
    if (document.body.dataset.state !== visualState) { document.body.dataset.state = visualState; }
    setText(byId('status'), statusText(state));
    if (listening) {
      setText(byId('mood-word'), 'Listening');
      setText(byId('mood-sentence'), 'Listening to Bluesky...');
      setText(byId('score'), '--');
      setText(byId('rate'), '--');
      return;
    }
    document.documentElement.style.setProperty('--rgb', view.colour.join(' '));
    setText(byId('mood-word'), view.mood.word);
    setText(byId('mood-sentence'), view.mood.sentence);
    setText(byId('score'), view.score.toFixed(2));
    setText(byId('rate'), String(view.postsPerMinute));
    if (state.announced !== view.mood.word && now - state.announcedAt > ANNOUNCE_EVERY_MS) {
      byId('live-region').textContent = view.mood.word + ': ' + view.mood.sentence;
      state.announced = view.mood.word;
      state.announcedAt = now;
    }
  }

  function start(config, lens, dayPayload, params, version) {
    var cfg = Object.assign({}, DEFAULT_CONFIG, config);
    var demo = parseFloat(params.get('demo'));
    var offline = isFinite(demo) || params.has('fallback') || params.has('listening') || lens === null;
    var state = {
      cfg: cfg,
      day: new HEM.Day(dayPayload),
      synthetic: !!dayPayload.synthetic,
      model: new HEM.Model(cfg, new HEM.LabMT(lens ? lens.words : {}), HEM.palette),
      history: new HEM.History(HOUR_MS, 15000),
      mode: isFinite(demo) ? 'live' : (params.has('listening') ? 'connecting' : (offline ? 'fallback' : 'connecting')),
      demo: demo,
      announced: null,
      announcedAt: 0,
      lastDraw: 0,
      lastSpark: 0,
      lastError: null
    };
    paintSparkGradient();

    if (!offline) {
      var stream = new HEM.Stream({
        hosts: cfg.hosts,
        config: cfg,
        WebSocket: window.WebSocket,
        now: function () { return Date.now(); },
        setTimeout: function (fn, ms) { return window.setTimeout(fn, ms); },
        clearTimeout: function (id) { window.clearTimeout(id); },
        onPost: function (text, at) { state.model.addPost(text, at); },
        onState: function (mode) {
          // Returning from a pause or the fallback: drop the old score so the page says Listening until fresh posts arrive.
          var was = state.mode;
          if ((was === 'paused' || was === 'fallback') && mode !== 'paused' && mode !== 'fallback') { state.model.reset(); }
          state.mode = mode;
        }
      });
      stream.start();
      if (document.hidden) { stream.setVisible(false); }   // a tab opened in the background must not stay connected
      document.addEventListener('visibilitychange', function () { stream.setVisible(!document.hidden); });
    }

    function tick() {
      window.requestAnimationFrame(tick);   // first, so an error below cannot end the loop
      var now = Date.now();
      if (now - state.lastDraw >= FRAME_MS) {
        state.lastDraw = now;
        try {
          frame(now);
        } catch (error) {
          var message = String(error && error.message ? error.message : error);
          if (message !== state.lastError) {
            state.lastError = message;
            console.error(error);
          }
        }
      }
    }

    function frame(now) {
      var override;
      if (isFinite(state.demo)) {
        override = state.demo;
      } else if (state.mode === 'fallback') {
        var recorded = state.day.scoreAt(now);
        if (recorded !== null) { override = recorded; }
      }
      var view = state.model.view(now, override);
      state.history.add(now, view.score);
      render(state, view, now);
      if (now - state.lastSpark >= SPARK_EVERY_MS) {
        state.lastSpark = now;
        drawSpark(state, now);
      }
    }
    window.requestAnimationFrame(tick);
  }

  // The two views: "instrument" (the default) and "lamp". Only the body attribute, the button state and the address bar change.
  function setView(view) {
    document.body.dataset.view = view;
    byId('view-lamp').setAttribute('aria-pressed', String(view === 'lamp'));
    byId('view-instrument').setAttribute('aria-pressed', String(view === 'instrument'));
  }

  // Keep the address bar in step so a link opens the same view. Every other query parameter is left as it was.
  function showViewInAddress(view) {
    try {
      var kept = window.location.search.replace(/^\?/, '').split('&').filter(function (part) {
        return part !== '' && part.split('=')[0] !== 'view';
      });
      kept.push('view=' + view);
      window.history.replaceState(null, '', window.location.pathname + '?' + kept.join('&') + window.location.hash);
    } catch (error) {
      // file:// pages and locked-down browsers refuse this: the view still switches, only the address stays as it is.
    }
  }

  function initViews(params) {
    setView(params.get('view') === 'lamp' ? 'lamp' : 'instrument');
    byId('view-lamp').addEventListener('click', function () { setView('lamp'); showViewInAddress('lamp'); });
    byId('view-instrument').addEventListener('click', function () { setView('instrument'); showViewInAddress('instrument'); });
  }

  function main() {
    var version = (document.querySelector('meta[name="hem-version"]') || {}).content || 'DEV';
    var params = new URLSearchParams(window.location.search);
    try {
      initViews(params);   // first: the switch works whatever happens to the data files, and never stops them loading
    } catch (error) {
      console.error(error);
    }
    var fellBack = false;
    Promise.all([
      fetchJson('data/config.json', version).catch(function () { return DEFAULT_CONFIG; }),
      fetchJson('data/labmt-lens.json', version).catch(function () { return null; }),
      fetchJson('data/day.json', version).catch(function () { return syntheticDay(); })
    ]).then(function (loaded) {
      start(loaded[0], loaded[1], loaded[2], params, version);
    }).catch(function (error) {
      // Valid JSON of the wrong shape: start once more with the built-in defaults instead of leaving a dead page.
      console.error(error);
      if (fellBack) { return; }
      fellBack = true;
      try {
        start(DEFAULT_CONFIG, null, syntheticDay(), params, version);
      } catch (again) {
        console.error(again);
      }
    });
  }

  main();
})();
