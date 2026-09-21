(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  // Python's \s exactly. JavaScript's own \s differs (it includes U+FEFF and lacks U+001C-001F and U+0085).
  var WHITESPACE_CLASS = '\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';

  // U+2018 and U+2019 (built from a string with a doubled backslash so no file tool can turn it into a literal character).
  var CURLY_APOSTROPHES = new RegExp('[\\u2018\\u2019]', 'g');
  var URL_RE = new RegExp('https?://[^' + WHITESPACE_CLASS + ']+|www\\.[^' + WHITESPACE_CLASS + ']+', 'gi');
  // Python's \w is letters, digits and underscore in any script.
  var MENTION_RE = /@[\p{L}\p{N}_.\-]+/gu;
  // Runs of letters and digits joined by single internal apostrophes or hyphens (can't, well-known).
  var WORD_RE = /[\p{L}\p{N}]+(?:['\-][\p{L}\p{N}]+)*/gu;

  // Text -> lower-case words, the same words hedoneggmeter.scoring.tokenize.tokenize returns.
  function tokenize(text) {
    var s = String(text).replace(CURLY_APOSTROPHES, "'");
    s = s.replace(URL_RE, ' ').replace(MENTION_RE, ' ');
    return s.toLowerCase().match(WORD_RE) || [];
  }

  HEM.WHITESPACE_CLASS = WHITESPACE_CLASS;
  HEM.tokenize = tokenize;
})(typeof globalThis !== 'undefined' ? globalThis : this);
