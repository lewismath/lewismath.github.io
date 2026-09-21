(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // Word happiness lookup. `scores` is a plain object {word: happiness}; a Map keeps Object.prototype names out of it.
  function LabMT(scores) {
    this.scores = new Map(Object.entries(scores));
  }

  // Sum and count of the scored words; every occurrence counts, exactly like hedoneggmeter.scoring.labmt.LabMT.
  LabMT.prototype.scoreWords = function (words) {
    var sum = 0;
    var count = 0;
    for (var i = 0; i < words.length; i++) {
      var score = this.scores.get(words[i]);
      if (score !== undefined) {
        sum += score;
        count += 1;
      }
    }
    return { sum: sum, count: count };
  };

  LabMT.prototype.scoreText = function (text) {
    return this.scoreWords(HEM.tokenize(text));
  };

  HEM.LabMT = LabMT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
