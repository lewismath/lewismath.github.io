(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  var WORDS = ['Heavy', 'Subdued', 'Even', 'Bright', 'Radiant'];
  var SENTENCES = [
    'a heavier stretch than usual',
    'a little quieter than usual',
    'about as bright as usual',
    'a little brighter than usual',
    'unusually bright right now'
  ];

  // bands = [p10, p35, p65, p90] of the recorded window scores, ascending.
  function mood(score, bands) {
    var index = 0;
    while (index < bands.length && score >= bands[index]) {
      index += 1;
    }
    index = Math.min(index, WORDS.length - 1);
    return { index: index, word: WORDS[index], sentence: SENTENCES[index] };
  }

  HEM.MOOD_WORDS = WORDS;
  HEM.MOOD_SENTENCES = SENTENCES;
  HEM.mood = mood;
})(typeof globalThis !== 'undefined' ? globalThis : this);
