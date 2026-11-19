
// Usage: node crop.cjs in.png out.png x y w h — crops a region (pixels) for close inspection, e.g. lensing near the shadow.
const { PNG } = require('./lib/common.cjs').req('pngjs'); const fs = require('fs');
const [,, inp, outp, xs, ys, ws, hs] = process.argv; const x0 = +xs, y0 = +ys, w = +ws, h = +hs;
const img = PNG.sync.read(fs.readFileSync(inp)); const o = new PNG({ width: w, height: h });
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = ((y0 + y) * img.width + x0 + x) * 4, di = (y * w + x) * 4; for (let k = 0; k < 4; k++) o.data[di + k] = img.data[si + k]; }
fs.writeFileSync(outp, PNG.sync.write(o));