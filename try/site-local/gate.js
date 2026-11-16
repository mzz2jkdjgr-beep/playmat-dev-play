/*
 * The "in testing" password gate. Every page of the site loads this first (the deploy tool puts it at the top of
 * each page's <head>, the games' pages included); a visitor who has not entered the password on this device is
 * sent to gate/ before anything is shown.
 *
 * BE HONEST ABOUT WHAT THIS IS: a doorbell, not a lock. The site is static files on GitHub Pages, so there is
 * nothing on the server to refuse a request: anyone who knows how can read the files directly, or skip this
 * script. It keeps casual visitors and search engines out while friends test. It protects nothing secret, and
 * nothing secret may be put behind it. (Real protection needs a host that checks the visitor before it serves
 * the files: see the report of 2026-11-11 for the options.)
 *
 * Only a salted hash of the password is here, never the word itself, so the word is not sitting in the page for
 * anyone who views the source. The hash comes from site.config.json at build time.
 */
var PlaymaticGate = (function () {
  var HASH = '55e7831ed8edea5072b38bdb682b2e40008f334ce0532542364194346cad7984';
  var KEY = 'playmatic.gate';

  /** SHA-256 of a string, as hex. Plain JavaScript, so it also works where crypto.subtle is not offered. */
  function sha256(str) {
    var bytes = unescape(encodeURIComponent(str));
    var bits = bytes.length * 8;
    var words = [];
    var k = [];
    var h = [];
    var composite = {};
    var i;
    var j;
    // the constants are the fractional parts of the square and cube roots of the first primes
    for (var c = 2; k.length < 64; c++) {
      if (composite[c]) continue;
      for (i = c * c; i < 320; i += c) composite[i] = 1;
      if (h.length < 8) h.push((Math.pow(c, 0.5) * 4294967296) | 0);
      k.push((Math.pow(c, 1 / 3) * 4294967296) | 0);
    }
    bytes += '\x80';
    while (bytes.length % 64 !== 56) bytes += '\x00';
    for (i = 0; i < bytes.length; i++) words[i >> 2] |= bytes.charCodeAt(i) << ((3 - (i % 4)) * 8);
    words.push((bits / 4294967296) | 0);
    words.push(bits | 0);
    function rot(x, n) {
      return (x >>> n) | (x << (32 - n));
    }
    for (j = 0; j < words.length; j += 16) {
      var w = words.slice(j, j + 16);
      var a = h.slice(0);
      for (i = 0; i < 64; i++) {
        if (i >= 16) {
          var x = w[i - 15];
          var y = w[i - 2];
          w[i] = (w[i - 16] + (rot(x, 7) ^ rot(x, 18) ^ (x >>> 3)) + w[i - 7] + (rot(y, 17) ^ rot(y, 19) ^ (y >>> 10))) | 0;
        }
        var t1 = (a[7] + (rot(a[4], 6) ^ rot(a[4], 11) ^ rot(a[4], 25)) + ((a[4] & a[5]) ^ (~a[4] & a[6])) + k[i] + (w[i] | 0)) | 0;
        var t2 = ((rot(a[0], 2) ^ rot(a[0], 13) ^ rot(a[0], 22)) + ((a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]))) | 0;
        a = [(t1 + t2) | 0, a[0], a[1], a[2], (a[3] + t1) | 0, a[4], a[5], a[6]];
      }
      for (i = 0; i < 8; i++) h[i] = (h[i] + a[i]) | 0;
    }
    var hex = '';
    for (i = 0; i < 8; i++)
      for (j = 3; j >= 0; j--) {
        var b = (h[i] >> (j * 8)) & 255;
        hex += (b < 16 ? '0' : '') + b.toString(16);
      }
    return hex;
  }

  /** The password is one word and case does not matter: capitals and stray spaces are forgiven. */
  function tidy(word) {
    return String(word).toLowerCase().replace(/\s+/g, '');
  }

  function matches(word) {
    return sha256('playmatic:' + tidy(word)) === HASH;
  }

  function stored() {
    try {
      var v = window.localStorage.getItem(KEY);
      if (v) return v;
    } catch (e) {
      /* storage blocked: try the session's */
    }
    try {
      return window.sessionStorage.getItem(KEY);
    } catch (e2) {
      return null;
    }
  }

  /** Has the password been entered on this device? */
  function open() {
    return stored() === HASH;
  }

  /** Remember this device (until its site data is cleared). */
  function remember() {
    try {
      window.localStorage.setItem(KEY, HASH);
    } catch (e) {
      /* private mode: the session will have to do */
    }
    try {
      window.sessionStorage.setItem(KEY, HASH);
    } catch (e2) {
      /* nothing more to try */
    }
  }

  return { sha256: sha256, matches: matches, open: open, remember: remember };
})();

// ---- on every page but the gate's own: not opened on this device yet? Go to the gate, and come back after.
(function () {
  if (window.PLAYMATIC_GATE_PAGE || PlaymaticGate.open()) return;
  var here = document.currentScript && document.currentScript.src;
  var root = here ? new URL('.', here).href : './';
  var next = location.pathname + location.search + location.hash;
  location.replace(root + 'gate/?next=' + encodeURIComponent(next));
})();
