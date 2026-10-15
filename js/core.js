/* ExoSphere core: namespace, random, noise, formatting, events */
'use strict';
(function (root) {
  const G = root.G = root.G || {};

  G.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  G.hash = function (a, b) {
    let h = (a | 0) * 374761393 + (b | 0) * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  };
  G.pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;

  /* 3D value noise with fBm, from the original ExoSphere renderer */
  G.makeNoise = function (seed, oct) {
    const r = G.rng(seed), b = Array.from({ length: 256 }, (_, i) => i), p = new Uint8Array(512), v = new Float32Array(256);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    for (let i = 0; i < 512; i++) p[i] = b[i & 255];
    for (let i = 0; i < 256; i++) v[i] = r() * 2 - 1;
    const f = t => t * t * (3 - 2 * t), l = (a, c, t) => a + (c - a) * t, h = (x, y, z) => v[p[p[p[x & 255] + (y & 255)] + (z & 255)]];
    const n = (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = f(x - xi), yf = f(y - yi), zf = f(z - zi);
      return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
        l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
    };
    const O = oct || 5;
    return (x, y, z) => { let a = 1, fr = 1.3, s = 0, w = 0; for (let o = 0; o < O; o++) { s += n(x * fr, y * fr, z * fr) * a; w += a; a *= .5; fr *= 2.1; } return s / w; };
  };

  G.fmt = function (n) {
    if (!isFinite(n)) return '0';
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e15) return s + (a / 1e15).toFixed(2) + 'Q';
    if (a >= 1e12) return s + (a / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return s + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return s + (a / 1e3).toFixed(1) + 'k';
    if (a >= 100) return s + Math.floor(a);
    if (a >= 10) return s + a.toFixed(a % 1 ? 1 : 0);
    return s + (Math.floor(a * 10) / 10);
  };
  G.fmtRate = n => (n >= 0 ? '+' : '') + (Math.abs(n) < 10 ? n.toFixed(1) : G.fmt(n));
  G.fmtTime = function (s) {
    s = Math.max(0, Math.ceil(s));
    if (s >= 3600) return Math.floor(s / 3600) + 'h ' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'm';
    if (s >= 60) return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
    return s + 's';
  };

  const L = {};
  G.on = (e, f) => (L[e] = L[e] || []).push(f);
  G.emit = (e, d) => (L[e] || []).forEach(f => { try { f(d); } catch (err) { console.error(err); } });
})(typeof window !== 'undefined' ? window : globalThis);
