
// CPU-only contact sheet: node compose.cjs out.png cols cellW img1 img2 ... (box-filter downsample; '-' = blank)
const { PNG } = require('./lib/common.cjs').req('pngjs'); const fs = require('fs');
const [,, outPng, colsS, cellWS, ...imgs] = process.argv; const cols = +colsS, cw = +cellWS;
const decoded = imgs.map(p => p === '-' || !fs.existsSync(p) ? null : PNG.sync.read(fs.readFileSync(p)));
const first = decoded.find(Boolean); const ch = Math.round(cw * first.height / first.width);
const rows = Math.ceil(imgs.length / cols), gap = 4;
const W = cols * cw + (cols - 1) * gap, H = rows * ch + (rows - 1) * gap;
const out = new PNG({ width: W, height: H }); out.data.fill(255);
decoded.forEach((img, k) => {
  const ox = (k % cols) * (cw + gap), oy = Math.floor(k / cols) * (ch + gap);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const o = ((oy + y) * W + ox + x) * 4;
    if (!img) { out.data[o] = out.data[o+1] = out.data[o+2] = 60; out.data[o+3] = 255; continue; }
    const sx0 = Math.floor(x * img.width / cw), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * img.width / cw));
    const sy0 = Math.floor(y * img.height / ch), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * img.height / ch));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = sy0; yy < sy1; yy++) for (let xx = sx0; xx < sx1; xx++) { const i = (yy * img.width + xx) * 4; r += img.data[i]; g += img.data[i+1]; b += img.data[i+2]; n++; }
    out.data[o] = r / n; out.data[o+1] = g / n; out.data[o+2] = b / n; out.data[o+3] = 255;
  }
});
fs.writeFileSync(outPng, PNG.sync.write(out));