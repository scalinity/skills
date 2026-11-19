// PNG luminance helpers (pngjs). Crops are fractions [x0,y0,x1,y1].
const { req } = require('./common.cjs');
const { PNG } = req('pngjs');
const decode = (buf) => PNG.sync.read(buf);
const lum = (img, x, y) => { const i = (y * img.width + x) * 4; return 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]; };
function box(img, crop) { return [Math.floor(crop[0] * img.width), Math.floor(crop[1] * img.height), Math.floor(crop[2] * img.width), Math.floor(crop[3] * img.height)]; }
function meanDiff(a, b, crop = [0, 0, 1, 1]) { const A = decode(a), B = decode(b); const [x0, y0, x1, y1] = box(A, crop); let s = 0, n = 0, big = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const d = Math.abs(lum(A, x, y) - lum(B, x, y)); s += d; n++; if (d > 24) big++; } return { mean: +(s / n).toFixed(3), changedPct: +(100 * big / n).toFixed(2) }; }
function darkFrac(a, crop = [0.3, 0.2, 0.7, 0.8], thr = 6) { const A = decode(a); const [x0, y0, x1, y1] = box(A, crop); let d = 0, n = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { if (lum(A, x, y) < thr) d++; n++; } return +(100 * d / n).toFixed(2); }
module.exports = { decode, meanDiff, darkFrac, PNG };
