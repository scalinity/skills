
// Differential-rotation estimate from two downsampled top-down frames.
// node diffrot.cjs <snaps.json>  -> JSON with per-band angular velocity (deg/s)
const fs = require('fs');
const snaps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
function analyze(A, B) {
  const w = A.w, h = A.h, g = A.g, g2 = B.g, dt = (B.t - A.t) / 1000;
  // center: centroid of dark pixels in the central region
  let sx = 0, sy = 0, n = 0;
  for (let y = Math.floor(h * 0.3); y < h * 0.7; y++) for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) if (g[y * w + x] < (+process.env.DARK_THR || 10)) { sx += x; sy += y; n++; }
  if (n < 20) return { error: 'no dark center found', darkPixels: n };
  const cx = sx / n, cy = sy / n;
  const sample = (img, x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y); if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return null; const fx = x - x0, fy = y - y0; const i = y0 * w + x0; return (img[i] * (1 - fx) + img[i + 1] * fx) * (1 - fy) + (img[i + w] * (1 - fx) + img[i + w + 1] * fx) * fy; };
  const rMax = Math.min(cx, cy, w - cx, h - cy) - 2;
  const NA = 720;
  const prof = [];
  for (let r = 1; r < rMax; r++) { let s = 0, k = 0; for (let a = 0; a < NA; a += 4) { const v = sample(g, cx + r * Math.cos(a / NA * 2 * Math.PI), cy + r * Math.sin(a / NA * 2 * Math.PI)); if (v !== null) { s += v; k++; } } prof.push(k ? s / k : 0); }
  const peak = Math.max(...prof); const rIn = prof.findIndex(v => v > 0.25 * peak) + 1;
  let rOut = rIn; for (let r = prof.length; r > rIn; r--) if (prof[r - 1] > 0.12 * peak) { rOut = r; break; }
  const d = rOut - rIn; if (d < 12) return { error: 'disk annulus too narrow', rIn, rOut };
  const bands = [[0.08, 0.3], [0.38, 0.6], [0.68, 0.92]].map(([a, b]) => [Math.round(rIn + a * d), Math.round(rIn + b * d)]);
  const res = bands.map(([r0, r1]) => {
    const rowsA = [], rowsB = [];
    for (let r = r0; r <= r1; r++) { const ra = [], rb = []; for (let a = 0; a < NA; a++) { const th = a / NA * 2 * Math.PI; ra.push(sample(g, cx + r * Math.cos(th), cy + r * Math.sin(th)) ?? 0); rb.push(sample(g2, cx + r * Math.cos(th), cy + r * Math.sin(th)) ?? 0); } const ma = ra.reduce((s, v) => s + v, 0) / NA, mb = rb.reduce((s, v) => s + v, 0) / NA; rowsA.push(ra.map(v => v - ma)); rowsB.push(rb.map(v => v - mb)); }
    const maxShift = 180; let best = -Infinity, bestS = 0; const scores = {};
    for (let s = -maxShift; s <= maxShift; s++) { let c = 0, na = 0, nb = 0; for (let k = 0; k < rowsA.length; k++) { const A1 = rowsA[k], B1 = rowsB[k]; for (let a = 0; a < NA; a++) { const bv = B1[(a + s + NA) % NA]; c += A1[a] * bv; na += A1[a] * A1[a]; nb += bv * bv; } } const sc = c / Math.sqrt(na * nb + 1e-9); scores[s] = sc; if (sc > best) { best = sc; bestS = s; } }
    const l = scores[bestS - 1] ?? best, rr = scores[bestS + 1] ?? best; const den = l - 2 * best + rr; const sub = den !== 0 ? 0.5 * (l - rr) / den : 0;
    const shiftDeg = (bestS + sub) * 360 / NA;
    return { radiusPx: [r0, r1], meanRadiusPx: (r0 + r1) / 2, shiftDeg: +shiftDeg.toFixed(3), omegaDegPerSec: +(shiftDeg / dt).toFixed(2), peakCorr: +best.toFixed(3), zeroShiftCorr: +scores[0].toFixed(3) };
  });
  const kepler = (res[2].meanRadiusPx / res[0].meanRadiusPx) ** 1.5;
  return { dtSec: +dt.toFixed(3), center: [+cx.toFixed(1), +cy.toFixed(1)], rIn, rOut, bands: res, innerOverOuter: res[2].omegaDegPerSec !== 0 ? +(res[0].omegaDegPerSec / res[2].omegaDegPerSec).toFixed(2) : null, keplerReferenceRatio: +kepler.toFixed(2) };
}
const out = { pair01: analyze(snaps[0], snaps[1]), pair02: snaps[2] ? analyze(snaps[0], snaps[2]) : null };
process.stdout.write(JSON.stringify(out));
