(function (root) {
  'use strict';
  var HEM = root.HEM = root.HEM || {};

  var COLLECTION = 'app.bsky.feed.post';
  var BLANK_RE = new RegExp('^[' + HEM.WHITESPACE_CLASS + ']*$'); // Python's str.strip() whitespace

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // The text of a newly created English post, or null for anything else (or anything malformed).
  // A port of hedoneggmeter.source.jetstream.parse_post_text.
  function parsePostText(raw) {
    var event;
    try {
      event = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (!isObject(event) || event.kind !== 'commit') { return null; }
    var commit = event.commit;
    if (!isObject(commit)) { return null; }
    if (commit.operation !== 'create' || commit.collection !== COLLECTION) { return null; }
    var record = commit.record;
    if (!isObject(record)) { return null; }
    var langs = record.langs;
    if (!Array.isArray(langs)) { return null; }
    var english = langs.some(function (lang) {
      return typeof lang === 'string' && lang.toLowerCase().split('-')[0] === 'en';
    });
    if (!english) { return null; }
    var text = record.text;
    if (typeof text !== 'string' || BLANK_RE.test(text)) { return null; }
    return text;
  }

  HEM.COLLECTION = COLLECTION;
  HEM.parsePostText = parsePostText;
})(typeof globalThis !== 'undefined' ? globalThis : this);
