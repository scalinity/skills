// Usage: node verify_outputs.cjs OUT
// Final gate. Writes OUT/evidence/verify.json and exits 1 when any check fails.
//  1. Integrity: manifest/hashes-after.sha256 exists and equals hashes-before (run inventory.cjs ROOT OUT --after first).
//  2. Reconciliation: metrics.json = leaderboard.csv = report.md final leaderboard = data embedded in dashboard.html.
//  3. Dashboard, from a standalone copy at OUT/.cache/verify/dashboard.html served by the local server (MODELBENCH_BASE_URL,
//     serving MODELBENCH_SERVE_ROOT or the benchmark root): no errors or outside requests, every image decodes, sorting,
//     filters, reset, theme, lightbox, both exports, code craft, no overflow at 1440 and 390 wide, no NaN/undefined text.
//     Full-page screenshots land in OUT/.cache/verify/ to look at; delete them afterwards.
const fs = require('fs'), path = require('path');
const { readJson, writeJson, open, summarizeLog, BASE, sleep } = require('./lib/common.cjs');
const OUT = path.resolve(process.argv[2] || ''); if (!process.argv[2]) { console.error('usage: node verify_outputs.cjs OUT'); process.exit(1); }
const checks = []; const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail === undefined ? null : detail });
const M = readJson(path.join(OUT, 'metrics.json')); const R = M.order.map(id => M.runs[id]);
// 1. integrity
const hb = path.join(OUT, 'manifest', 'hashes-before.sha256'), ha = path.join(OUT, 'manifest', 'hashes-after.sha256');
ok('after-hashes recorded', fs.existsSync(ha), fs.existsSync(ha) ? null : 'run inventory.cjs ROOT OUT --after');
if (fs.existsSync(ha)) ok('submission files unchanged', fs.readFileSync(hb, 'utf8') === fs.readFileSync(ha, 'utf8'));
// 2. reconciliation
const parseCsv = (s) => { const rows = []; let row = [], f = '', q = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else f += c; } if (f || row.length) { row.push(f); rows.push(row); } return rows; };
const csv = parseCsv(fs.readFileSync(path.join(OUT, 'leaderboard.csv'), 'utf8')); const H = csv[0]; const col = (r, k) => r[H.indexOf(k)];
const csvRuns = csv.slice(1).filter(r => col(r, 'id'));
const near = (a, b) => (a === '' || a == null) ? b == null : Math.abs(+a - b) < 1e-6;
ok('csv has every run in rank order', csvRuns.map(r => col(r, 'id')).join() === M.order.join(), csvRuns.map(r => col(r, 'id')).join());
ok('csv scores, ranks and costs match metrics', csvRuns.every(r => { const m = M.runs[col(r, 'id')]; return +col(r, 'quality_score') === m.quality.total && +col(r, 'quality_rank') === m.rank && near(col(r, 'session_cost_usd'), m.cost.client ?? m.cost.apiFull); }));
ok('csv lists missing models', csv.some(r => r.join(',').includes('Missing expected models')));
const md = fs.readFileSync(path.join(OUT, 'report.md'), 'utf8'); const lb = md.slice(md.lastIndexOf('## Final leaderboard'));
ok('report ends with the final leaderboard', md.lastIndexOf('## Final leaderboard') > 0 && !lb.slice(20).includes('\n## '));
ok('report leaderboard row per run with its score', R.every(r => lb.split('\n').some(l => l.includes('(' + r.id + ', ') && l.includes(r.quality.total + '/'))));
ok('report has a Code craft section', !M.craft || md.includes('## Code craft'));
const html = fs.readFileSync(path.join(OUT, 'dashboard.html'), 'utf8');
const D = JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
ok('dashboard data matches metrics', D.runs.map(r => r.id + ':' + r.quality.total).join() === R.map(r => r.id + ':' + r.quality.total).join() && JSON.stringify(D.totals) === JSON.stringify(M.totals));
// 3. dashboard in the browser
(async () => {
  const dir = path.join(OUT, '.cache', 'verify'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const copy = path.join(dir, 'dashboard.html'); fs.copyFileSync(path.join(OUT, 'dashboard.html'), copy);
  const serveRoot = path.resolve(process.env.MODELBENCH_SERVE_ROOT || readJson(path.join(OUT, 'manifest', 'inventory.json')).root);
  const rel = path.relative(serveRoot, copy); if (rel.startsWith('..')) throw new Error('OUT is outside the served folder ' + serveRoot + '; set MODELBENCH_SERVE_ROOT and MODELBENCH_BASE_URL');
  const u = BASE + '/' + rel.split(path.sep).map(encodeURIComponent).join('/');
  const { ctx, page, log } = await open(path.join(OUT, '.cache', 'verify-profile'));
  await page.goto(u, { waitUntil: 'load' }); await sleep(1500);
  const imgs = await page.evaluate(() => [...document.querySelectorAll('img[src]')].map(i => ({ ok: i.complete && i.naturalWidth > 0, alt: i.alt })));
  ok('every image decodes', imgs.length > 0 && imgs.every(i => i.ok), imgs.length + ' images; broken: ' + imgs.filter(i => !i.ok).map(i => i.alt).join(', '));
  const rows = await page.$$eval('#lb tbody tr', t => t.length); ok('leaderboard shows every run plus the missing row', rows === R.length + 1, rows);
  await page.click('#lb thead button[data-k="total"]'); const first = await page.$eval('#lb tbody tr td:nth-child(2) .runname', e => e.textContent.trim());
  await page.click('#lb thead button[data-k="total"]'); const firstAsc = await page.$eval('#lb tbody tr td:nth-child(2) .runname', e => e.textContent.trim());
  const best = R.reduce((a, b) => b.quality.total > a.quality.total ? b : a), worst = R.reduce((a, b) => b.quality.total < a.quality.total ? b : a);
  ok('sorting by quality works both ways', first === best.model && firstAsc === worst.model, first + ' / ' + firstAsc);
  const vend = await page.$$eval('#fVendor option', o => o.map(x => x.value).filter(Boolean));
  if (vend.length > 1) { await page.selectOption('#fVendor', vend[0]); const c = await page.$eval('#fCount', e => e.textContent); ok('vendor filter narrows the table', !c.startsWith('Showing ' + R.length + ' '), c); }
  await page.click('#fReset'); const c2 = await page.$eval('#fCount', e => e.textContent); ok('reset restores every run', c2.startsWith('Showing ' + R.length + ' of ' + R.length), c2);
  await page.click('#theme'); const th1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme')); await page.click('#theme'); const th2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  ok('theme toggles light and dark', th1 === 'light' && th2 === 'dark', th1 + ',' + th2);
  await page.screenshot({ path: path.join(dir, 'dark-1440.png'), fullPage: true }); await page.click('#theme');
  const zoom = await page.$('#showcaseGrid button.zoom');
  if (zoom) { await zoom.click(); await sleep(300); const lbx = await page.evaluate(() => ({ on: document.getElementById('lightbox').classList.contains('on'), w: document.getElementById('lbImg').naturalWidth })); await page.keyboard.press('Escape'); const off = await page.evaluate(() => !document.getElementById('lightbox').classList.contains('on')); ok('lightbox opens at full resolution and closes', lbx.on && lbx.w >= 1000 && off, lbx); }
  else ok('showcase has images', false, 'no showcase images');
  for (const [btn, ext] of [['#exportCsv', '.csv'], ['#exportJson', '.json']]) { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click(btn)]); ok('export ' + ext, dl && dl.suggestedFilename().endsWith(ext), dl && dl.suggestedFilename()); }
  if (M.craft) ok('code craft section rendered', (await page.$$eval('#craftSup article', a => a.length)) === (M.craft.superlatives || []).length);
  // table cells are tab-separated in innerText; evidence prose may mention NaN legitimately, so look for rendered values only
  const text = await page.evaluate(() => document.body.innerText); const bad = text.match(/\$NaN|NaN(%| ?(min|ms|s|KiB|FPS)\b)|(^|\t)(NaN|undefined|null)(?=\t|$)|\[object Object\]/gm);
  ok('no NaN, undefined or [object Object] text', !bad, bad);
  for (const [w, h] of [[1440, 900], [390, 844]]) { await page.setViewportSize({ width: w, height: h }); await sleep(400); const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok('no horizontal overflow at ' + w, ov <= 1, ov); await page.screenshot({ path: path.join(dir, 'light-' + w + '.png'), fullPage: true }); }
  const L = summarizeLog(log);
  ok('no console errors, page errors or failed requests', !L.pageErrors.length && !L.consoleErrors.length && !L.failed.filter(f => !/^blob:/.test(f.url)).length, { pageErrors: L.pageErrors, consoleErrors: L.consoleErrors, failed: L.failed });
  ok('no requests leave the local server', !L.external.length, L.external);
  await ctx.close();
  const failed = checks.filter(c => !c.pass);
  writeJson(path.join(OUT, 'evidence', 'verify.json'), { verifiedUtc: new Date().toISOString(), passed: checks.length - failed.length, failed: failed.length, checks, screenshots: dir });
  console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.map(f => f.name + ': ' + JSON.stringify(f.detail)), screenshots: dir }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
