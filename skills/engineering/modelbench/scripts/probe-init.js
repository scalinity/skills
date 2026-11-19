
// In-page frame probe (init script). Wraps requestAnimationFrame so that right after each
// application frame callback, the main WebGL canvas is downsampled (the drawing buffer is still
// valid inside the same task) and per-frame luminance change is recorded with its frame time.
(() => {
  const W = 240, H = 150, SW = 360, SH = 225;
  const P = window.__probe = { on: false, frames: [], snaps: [], wantSnaps: 0, lastT: -1, prev: null, renders: 0 };
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const big = document.createElement('canvas'); big.width = SW; big.height = SH;
  const bctx = big.getContext('2d', { willReadFrequently: true });
  const main = () => { let best = null, area = 0; for (const c of document.querySelectorAll('canvas')) { const a = c.width * c.height; if (a > area) { area = a; best = c; } } return best; };
  P.post = (t) => {
    if (!P.on || t === P.lastT) return;
    const dtFrame = P.lastT < 0 ? 0 : t - P.lastT; P.lastT = t;
    const c = main(); if (!c) return;
    octx.drawImage(c, 0, 0, W, H);
    const d = octx.getImageData(0, 0, W, H).data;
    const g = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    let m = 0, n = 0;
    if (P.prev) { for (let y = Math.floor(H * 0.15); y < Math.floor(H * 0.8); y++) for (let x = Math.floor(W * 0.2); x < Math.floor(W * 0.8); x++) { m += Math.abs(g[y * W + x] - P.prev[y * W + x]); n++; } m /= n; }
    P.prev = g;
    P.frames.push([+t.toFixed(2), +dtFrame.toFixed(2), +m.toFixed(4)]);
    if (P.wantSnaps > 0) {
      bctx.drawImage(c, 0, 0, SW, SH); const bd = bctx.getImageData(0, 0, SW, SH).data; const s = new Array(SW * SH);
      for (let i = 0; i < SW * SH; i++) s[i] = Math.round(0.2126 * bd[i * 4] + 0.7152 * bd[i * 4 + 1] + 0.0722 * bd[i * 4 + 2]);
      P.snaps.push({ t, w: SW, h: SH, g: s }); P.wantSnaps--;
    }
  };
  document.addEventListener('DOMContentLoaded', () => { for (const el of document.querySelectorAll('input')) el.dataset.mbDefault = el.value; });
  P.start = () => { P.frames = []; P.prev = null; P.lastT = -1; P.on = true; };
  P.stop = () => { P.on = false; return P.frames; };
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) { return orig(function (t) { cb(t); try { P.post(t); } catch (e) { P.err = String(e); } }); };
})();