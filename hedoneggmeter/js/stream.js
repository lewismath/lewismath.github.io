(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  var DEFAULTS = {
    stall_seconds: 45,
    fallback_after_seconds: 12,
    failed_attempts_before_fallback: 4,
    hidden_pause_seconds: 60,
    backoff_start_seconds: 1,
    backoff_max_seconds: 30
  };

  // Connection manager for Bluesky's Jetstream. Everything it touches (WebSocket, clock, timers) is injected.
  function Stream(opts) {
    this.hosts = opts.hosts;
    this.cfg = Object.assign({}, DEFAULTS, opts.config || {});
    this.WebSocketCtor = opts.WebSocket;
    this.now = opts.now;
    this.setTimer = opts.setTimeout;
    this.clearTimer = opts.clearTimeout;
    this.onPost = opts.onPost;
    this.onState = opts.onState || function () {};
    this.running = false;
    this.paused = false;
    this.state = null;
    this.hostIndex = 0;
    this.backoff = this.cfg.backoff_start_seconds;
    this.failedAttempts = 0;
    this.gotEnglish = false;
    this.inFallback = false;
    this.delivered = false;
    this.ws = null;
    this.timers = { stall: null, backoff: null, fallback: null, hidden: null };
  }

  Stream.prototype._emit = function (state) {
    if (state !== this.state) {
      this.state = state;
      this.onState(state);
    }
  };

  Stream.prototype._arm = function (name, ms, fn) {
    this._disarm(name);
    this.timers[name] = this.setTimer(fn, ms);
  };

  Stream.prototype._disarm = function (name) {
    if (this.timers[name] !== null) {
      this.clearTimer(this.timers[name]);
      this.timers[name] = null;
    }
  };

  Stream.prototype._dropSocket = function () {
    var ws = this.ws;
    this.ws = null;
    this._disarm('stall');
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (e) { /* already closed */ }
    }
  };

  Stream.prototype.start = function () {
    if (this.running) { return; }
    var self = this;
    this.running = true;
    this.paused = false;
    this._emit('connecting');
    this._arm('fallback', this.cfg.fallback_after_seconds * 1000, function () {
      if (!self.gotEnglish) { self._enterFallback(); }
    });
    this._connect();
  };

  Stream.prototype.stop = function () {
    this.running = false;
    this._disarm('backoff');
    this._disarm('fallback');
    this._disarm('hidden');
    this._dropSocket();
  };

  Stream.prototype._connect = function () {
    if (!this.running || this.paused) { return; }
    var self = this;
    var host = this.hosts[this.hostIndex % this.hosts.length];
    var url = 'wss://' + host + '/subscribe?wantedCollections=' + HEM.COLLECTION;
    this.delivered = false;
    var ws;
    try {
      ws = new this.WebSocketCtor(url);
    } catch (e) {
      this._failed();
      return;
    }
    this.ws = ws;
    this._armStall();
    ws.onopen = function () { if (self.ws === ws) { self._armStall(); } };
    ws.onmessage = function (event) { if (self.ws === ws) { self._onMessage(event.data); } };
    ws.onerror = function () { /* a close follows */ };
    ws.onclose = function () {
      if (self.ws === ws) {
        self.ws = null;
        self._disarm('stall');
        self._failed();
      }
    };
  };

  Stream.prototype._armStall = function () {
    var self = this;
    this._arm('stall', this.cfg.stall_seconds * 1000, function () {
      self._dropSocket();
      self._failed();
    });
  };

  Stream.prototype._onMessage = function (data) {
    this._armStall();
    if (!this.delivered) {
      this.delivered = true;
      this.backoff = this.cfg.backoff_start_seconds;
      this.failedAttempts = 0;
    }
    var text = HEM.parsePostText(data);
    if (text === null) { return; }
    this.gotEnglish = true;
    this._disarm('fallback');
    this.inFallback = false;
    this._emit('live');
    this.onPost(text, this.now());
  };

  // A connection ended (closed, stalled, or could not be created): try the next host after a backoff.
  Stream.prototype._failed = function () {
    var self = this;
    if (!this.running || this.paused) { return; }
    if (!this.delivered) { this.failedAttempts += 1; }
    this.hostIndex += 1;
    if (this.failedAttempts >= this.cfg.failed_attempts_before_fallback) {
      this._enterFallback();
    } else if (!this.inFallback) {
      this._emit(this.gotEnglish ? 'reconnecting' : 'connecting');
    }
    var delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, this.cfg.backoff_max_seconds);
    this._arm('backoff', delay * 1000, function () { self._connect(); });
  };

  Stream.prototype._enterFallback = function () {
    if (this.inFallback) { return; }
    this.inFallback = true;
    this._emit('fallback');
  };

  Stream.prototype.setVisible = function (visible) {
    var self = this;
    if (!this.running) { return; }
    if (!visible) {
      this._arm('hidden', this.cfg.hidden_pause_seconds * 1000, function () { self._pause(); });
    } else {
      this._disarm('hidden');
      if (this.paused) { this._resume(); }
    }
  };

  Stream.prototype._pause = function () {
    this.paused = true;
    this._disarm('backoff');
    this._disarm('fallback');
    this._disarm('hidden');
    this._dropSocket();
    this._emit('paused');
  };

  Stream.prototype._resume = function () {
    this.paused = false;
    this.backoff = this.cfg.backoff_start_seconds;
    this.failedAttempts = 0;
    this._emit(this.inFallback ? 'fallback' : 'connecting');
    this._connect();
  };

  HEM.Stream = Stream;
})(typeof globalThis !== 'undefined' ? globalThis : this);
