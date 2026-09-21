(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // The scoring pipeline behind the page: posts -> window -> smoothing -> colour, mood word and rate.
  // `cfg` has the shape of config.json; `lens` is a HEM.LabMT; `palette` has colourAt(t). Times are in milliseconds.
  function Model(cfg, lens, palette) {
    this.cfg = cfg;
    this.lens = lens;
    this.palette = palette;
    this.reset();
  }

  // Forget every post and the smoothed value (a paused tab or the recorded-day fallback just ended).
  Model.prototype.reset = function () {
    this.window = new HEM.SlidingWindow(this.cfg.window_seconds, this.cfg.min_words);
    this.smoother = new HEM.Smoother(this.cfg.smoothing_seconds);
    this.firstPostAt = null;
  };

  Model.prototype.addPost = function (text, nowMs) {
    var scored = this.lens.scoreText(text);
    this.window.add(nowMs / 1000, scored.sum, scored.count);
    if (this.firstPostAt === null) { this.firstPostAt = nowMs; }
  };

  Model.prototype.postsPerMinute = function (nowMs) {
    var posts = this.window.posts();
    if (this.firstPostAt === null || posts === 0) { return 0; }
    var elapsed = Math.min(this.cfg.window_seconds, Math.max(5, (nowMs - this.firstPostAt) / 1000));
    return Math.round(posts * 60 / elapsed);
  };

  // rawOverride: a score to use instead of the window's (the recorded-day fallback), or undefined.
  Model.prototype.view = function (nowMs, rawOverride) {
    var nowSeconds = nowMs / 1000;
    this.window.expire(nowSeconds);
    var raw = (rawOverride !== undefined && rawOverride !== null) ? rawOverride : this.window.score(nowSeconds);
    var smoothed = this.smoother.step(nowSeconds, raw);
    var rate = this.postsPerMinute(nowMs);
    if (smoothed === null) {
      return { listening: true, score: null, raw: raw, t: null, colour: null, mood: null, postsPerMinute: rate };
    }
    var t = HEM.scoreToT(smoothed, this.cfg.midpoint, this.cfg.range);
    return {
      listening: false,
      score: smoothed,
      raw: raw,
      t: t,
      colour: this.palette.colourAt(t),
      mood: HEM.mood(smoothed, this.cfg.bands),
      postsPerMinute: rate
    };
  };

  // Recent smoothed scores for the sparkline: at most one point every `everyMs`, none older than `spanMs`.
  function History(spanMs, everyMs) {
    this.spanMs = spanMs;
    this.everyMs = everyMs;
    this.points = [];
    this.lastAt = null;
  }

  History.prototype.add = function (nowMs, score) {
    if (score === null || score === undefined) { return; }
    if (this.lastAt !== null && nowMs - this.lastAt < this.everyMs) { return; }
    this.points.push([nowMs, score]);
    this.lastAt = nowMs;
    while (this.points.length > 0 && this.points[0][0] < nowMs - this.spanMs) {
      this.points.shift();
    }
  };

  HEM.Model = Model;
  HEM.History = History;
})(typeof globalThis !== 'undefined' ? globalThis : this);
