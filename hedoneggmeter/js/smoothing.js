(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // Fraction of the gap to close after dt seconds with time constant tau (tau <= 0 closes it all at once).
  function blend(dt, tau) {
    return tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
  }

  // Exponential smoothing of the window score, as in hedoneggmeter.mapping.renderer.Renderer.
  function Smoother(tauSeconds) {
    this.tau = tauSeconds;
    this.value = null;
    this.last = null;
  }

  Smoother.prototype.step = function (now, score) {
    var dt = this.last === null ? 0 : Math.max(0, now - this.last);
    this.last = now;
    if (score !== null && score !== undefined) {
      if (this.value === null) {
        this.value = score;
      } else {
        this.value += blend(dt, this.tau) * (score - this.value);
      }
    }
    return this.value;
  };

  HEM.Smoother = Smoother;
})(typeof globalThis !== 'undefined' ? globalThis : this);
