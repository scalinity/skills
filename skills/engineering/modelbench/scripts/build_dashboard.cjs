// Usage: node build_dashboard.cjs OUT
// Renders OUT/dashboard.html from OUT/metrics.json and assets/dashboard-template.html: one self-contained file,
// images embedded as JPEG data URIs so it opens offline from any folder.
// Images per run and view are looked up, first match wins:
//   OUT/assets/plates/<ID>-<view>.jpg (already prepared)
//   OUT/evidence/runtime/shots/<ID>-<view.shot or view.key>.png
//   OUT/evidence/runtime/shots/<ID>-<anything>-<view.key>.png   (run_plan names shots <ID>-<phase>-<name>.png)
// PNGs are converted with macOS sips (1440 px wide, quality 82) into OUT/assets/plates; without sips the PNG is embedded as is.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { readJson } = require('./lib/common.cjs');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node build_dashboard.cjs OUT'); process.exit(1); }
const M = readJson(path.join(OUT, 'metrics.json'));
const tpl = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard-template.html'), 'utf8');
const shots = path.join(OUT, 'evidence', 'runtime', 'shots'), plates = path.join(OUT, 'assets', 'plates');
fs.mkdirSync(plates, { recursive: true });
const shotFiles = fs.existsSync(shots) ? fs.readdirSync(shots) : [];
let sips = true; try { execFileSync('sips', ['--help'], { stdio: 'ignore' }); } catch { sips = false; }
const views = (M.notes.views && M.notes.views.length) ? M.notes.views : [{ key: 'default', label: 'Default', caption: '' }];
const IMG = {}, missing = [];
for (const id of M.order) for (const v of views) {
  const jpg = path.join(plates, id + '-' + v.key + '.jpg');
  let src = null;
  if (fs.existsSync(jpg)) src = jpg;
  else {
    const name = shotFiles.find(f => f === id + '-' + (v.shot || v.key) + '.png') || shotFiles.find(f => f.startsWith(id + '-') && f.endsWith('-' + v.key + '.png'));
    if (name) {
      const png = path.join(shots, name);
      if (sips) { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', '1440', png, '--out', jpg], { stdio: 'ignore' }); src = jpg; }
      else src = png;
    }
  }
  if (!src) { missing.push(id + '-' + v.key); continue; }
  IMG[id + '-' + v.key] = 'data:image/' + (src.endsWith('.png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(src).toString('base64');
}
const D = { meta: M.meta, generatedUtc: M.generatedUtc, environment: M.environment, inventory: M.inventory, scoresFrozen: M.scoresFrozen, rubric: M.rubric, totals: M.totals, craft: M.craft,
  notes: M.notes, views, showcaseView: M.notes.showcaseView || views[0].key, runs: M.order.map(id => M.runs[id]) };
// JSON inside <script> must not close the element early
const safe = (o) => JSON.stringify(o).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const html = tpl.replace('__TITLE__', () => esc(M.meta.title || 'Model benchmark')).replace('__IMGS__', () => safe(IMG)).replace('__DATA__', () => safe(D));
fs.writeFileSync(path.join(OUT, 'dashboard.html'), html);
console.log(JSON.stringify({ dashboard: path.join(OUT, 'dashboard.html'), mb: +(html.length / 1048576).toFixed(1), images: Object.keys(IMG).length, missing }, null, 1));
