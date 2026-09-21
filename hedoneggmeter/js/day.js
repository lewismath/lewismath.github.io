(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // A recorded day of mood: `scores` has one slot per `step_seconds` of the UTC day (null where there is a gap).
  function Day(payload) {
    this.step = payload.step_seconds;
    this.scores = payload.scores;
    this.n = this.scores.length;
  }

  Day.prototype.slot = function (utcMs) {
    var secondOfDay = (((utcMs / 1000) % 86400) + 86400) % 86400;
    return Math.floor(secondOfDay / this.step) % this.n;
  };

  // The slot's score, or the nearest earlier non-null one (wrapping around the day); null if there is none at all.
  Day.prototype.scoreAt = function (utcMs) {
    var i = this.slot(utcMs);
    for (var k = 0; k < this.n; k++) {
      var value = this.scores[(i - k + this.n) % this.n];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return null;
  };

  // `points` evenly spaced scores from utcMs - spanMs up to utcMs (inclusive).
  Day.prototype.trace = function (utcMs, spanMs, points) {
    if (points <= 1) {
      return [this.scoreAt(utcMs)];
    }
    var out = [];
    for (var j = 0; j < points; j++) {
      out.push(this.scoreAt(utcMs - spanMs + (spanMs * j) / (points - 1)));
    }
    return out;
  };

  HEM.Day = Day;
})(typeof globalThis !== 'undefined' ? globalThis : this);
