(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // Mean word happiness over the last `seconds` seconds, kept as running sums
  // (a port of hedoneggmeter.window.Window). Times are in seconds and must be added in non-decreasing order.
  function SlidingWindow(seconds, minWords) {
    if (!(seconds > 0)) {
      throw new Error('seconds must be positive');
    }
    this.seconds = seconds;
    this.minWords = minWords === undefined ? 1 : minWords;
    this.entries = [];
    this.sum = 0;
    this.wordCount = 0;
  }

  SlidingWindow.prototype.add = function (time, sum, count) {
    this.entries.push({ time: time, sum: sum, count: count });
    this.sum += sum;
    this.wordCount += count;
  };

  SlidingWindow.prototype.expire = function (now) {
    var cutoff = now - this.seconds;
    var drop = 0;
    while (drop < this.entries.length && this.entries[drop].time <= cutoff) {
      this.sum -= this.entries[drop].sum;
      this.wordCount -= this.entries[drop].count;
      drop += 1;
    }
    if (drop > 0) {
      this.entries.splice(0, drop);
    }
    if (this.entries.length === 0) {
      this.sum = 0; // avoid accumulated floating-point drift
      this.wordCount = 0;
    }
  };

  SlidingWindow.prototype.score = function (now) {
    this.expire(now);
    if (this.wordCount < this.minWords || this.wordCount === 0) {
      return null;
    }
    return this.sum / this.wordCount;
  };

  SlidingWindow.prototype.posts = function () {
    return this.entries.length;
  };

  SlidingWindow.prototype.words = function () {
    return this.wordCount;
  };

  HEM.SlidingWindow = SlidingWindow;
})(typeof globalThis !== 'undefined' ? globalThis : this);
