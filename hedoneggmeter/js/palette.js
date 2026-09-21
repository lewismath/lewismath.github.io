(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // Tide to sunrise: deep blue, teal, seafoam, gold, coral.
  var TIDE_STOPS = [[44, 66, 158], [32, 146, 166], [128, 214, 184], [255, 210, 102], [255, 118, 104]];

  function lin(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function delin(x) {
    x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(255 * Math.min(1, Math.max(0, x)));
  }

  // sRGB <-> OKLab (Bjorn Ottosson's matrices): blending in OKLab avoids muddy in-between colours.
  function toLab(rgb) {
    var r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function fromLab(lab) {
    var L = lab[0], A = lab[1], B = lab[2];
    var l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    var m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    var s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
    return [
      delin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      delin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      delin(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    ];
  }

  function mix(a, b, t) {
    return a.map(function (v, i) { return v + (b[i] - v) * t; });
  }

  function makePalette(stops) {
    var lab = stops.map(toLab);
    return {
      colourAt: function (t) {
        if (t !== t) { t = 0; } // NaN
        t = Math.min(1, Math.max(0, t));
        var n = lab.length - 1;
        var x = t * n;
        var i = Math.min(n - 1, Math.floor(x));
        return fromLab(mix(lab[i], lab[i + 1], x - i));
      }
    };
  }

  // Where a score sits along the gradient: 0 at the low end of the calibrated range, 1 at the high end.
  function scoreToT(score, midpoint, range) {
    return Math.min(1, Math.max(0, (score - (midpoint - range / 2)) / range));
  }

  HEM.TIDE_STOPS = TIDE_STOPS;
  HEM.makePalette = makePalette;
  HEM.palette = makePalette(TIDE_STOPS);
  HEM.scoreToT = scoreToT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
