// Usage: node run_plan.cjs PLAN.json RESULTS_DIR [ID ...]
// Executes a runtime test plan (see references/runtime-plans.md) against each submission, one at a time.
// Writes RESULTS_DIR/<ID>.json and screenshots RESULTS_DIR/shots/<ID>-<phase>-<name>.png.
// Non-timed phases inject the frame probe (per-frame canvas change); timed phases inject only the rAF monitor
// and refuse screenshots, so measurements are never disturbed by capture.
const fs = require('fs'), path = require('path');
const { open, url, summarizeLog, sleep, readJson, writeJson, q } = require('./lib/common.cjs');
const { meanDiff, darkFrac } = require('./lib/imgdiff.cjs');
const [PLAN, RES, ...only] = process.argv.slice(2);
if (!PLAN || !RES) { console.error('usage: node run_plan.cjs PLAN.json RESULTS_DIR [ID ...]'); process.exit(1); }
const plan = readJson(PLAN); const PROBE = fs.readFileSync(path.join(__dirname, 'probe-init.js'), 'utf8'); const MON = fs.readFileSync(path.join(__dirname, 'monitor-init.js'), 'utf8');
const shotDir = path.join(RES, 'shots'); fs.mkdirSync(shotDir, { recursive: true });
const ids = only.length ? only : Object.keys(plan.submissions);
const rate = (fr) => { let m = 0, t = 0; for (const f of fr.slice(1)) { m += f[2]; t += f[1]; } return t > 0 ? +(1000 * m / t).toFixed(3) : null; };
function sel(id, s) { if (typeof s !== 'string' || !s.startsWith('@')) return s; const c = (plan.controls && plan.controls[id]) || {}; const v = c[s.slice(1)]; if (!v) throw new Error('control ' + s + ' not mapped for ' + id); return v; }
(async () => {
  for (const id of ids) {
    const sub = plan.submissions[id]; if (!sub) { console.error('unknown id ' + id); continue; }
    const R = { id, folder: sub.folder, planFile: path.resolve(PLAN), startedUtc: new Date().toISOString(), phases: {} };
    for (const ph of plan.phases) {
      const P = R.phases[ph.name] = { shots: {}, probes: {}, monitors: {}, layouts: {}, states: {}, snaps: {}, diffs: {}, marks: {}, defaults: {}, notes: [] };
      const vp = ph.viewport || plan.viewport || [1440, 900];
      const { ctx, page, log } = await open(path.join(require('os').tmpdir(), 'modelbench-profiles', id + '-' + ph.name), { width: vp[0], height: vp[1] });
      await page.addInitScript(ph.timed ? MON : PROBE);
      const buffers = {};
      try {
        await page.goto(sub.url || url(sub.folder, sub.entry), { waitUntil: 'load', timeout: 45000 });
        P.defaults = await page.evaluate((m) => Object.fromEntries(Object.entries(m || {}).map(([k, s]) => { const el = document.querySelector(s); return [k, el ? { value: el.value ?? null, min: el.min ?? null, max: el.max ?? null, tag: el.tagName, found: true } : { found: false }]; })), (plan.controls || {})[id]);
        for (const st of ph.steps) {
          const [op] = Object.keys(st).filter(k => !['as', 'steps', 'stepMs', 'times', 'interval', 'at', 'crop'].includes(k));
          const v = st[op];
          if (op === 'wait') await sleep(v);
          else if (op === 'shot') { if (ph.timed) throw new Error('screenshots are not allowed in timed phases'); const p = path.join(shotDir, id + '-' + ph.name + '-' + v + '.png'); buffers[v] = await page.screenshot({ path: p }); P.shots[v] = path.relative(RES, p); }
          else if (op === 'drag') { const [x, y, dx, dy] = v, n = st.steps || 12; await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= n; i++) { await page.mouse.move(x + dx * i / n, y + dy * i / n); await sleep(st.stepMs ?? 16); } await page.mouse.up(); }
          else if (op === 'wheel') { if (st.at) await page.mouse.move(st.at[0], st.at[1]); for (let i = 0; i < (st.times || 1); i++) { await page.mouse.wheel(v[0], v[1]); await sleep(st.interval ?? 40); } }
          else if (op === 'click') await page.click(sel(id, v));
          else if (op === 'key') await page.keyboard.press(v);
          else if (op === 'set') { const s = sel(id, v[0]); const want = v[1]; await page.evaluate(([s, want]) => { const el = document.querySelector(s); const val = want === 'min' ? el.min : want === 'max' ? el.max : want === 'default' ? (el.dataset.mbDefault ?? el.defaultValue) : String(want); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [s, want]); }
          else if (op === 'viewport') await page.setViewportSize({ width: v[0], height: v[1] });
          else if (op === 'mark') P.marks[v] = await page.evaluate(() => performance.now());
          else if (op === 'probe') { if (ph.timed) throw new Error('probe is not available in timed phases'); if (v === 'start') await page.evaluate(() => window.__probe.start()); else { const fr = await page.evaluate(() => window.__probe.stop()); const per = fr.slice(1).map(f => f[2]); P.probes[st.as || 'probe'] = { motionRatePerSec: rate(fr), frames: fr.length, meanFrameMs: fr.length > 1 ? +(fr.slice(1).reduce((s, f) => s + f[1], 0) / (fr.length - 1)).toFixed(2) : null, maxFrameMotion: per.length ? Math.max(...per) : null, medianFrameMotion: q(per, 0.5), series: st.keepSeries ? fr : undefined }; } }
          else if (op === 'snaps') { if (ph.timed) throw new Error('snaps are not available in timed phases'); await page.evaluate(() => { window.__probe.snaps = []; window.__probe.start(); }); for (let i = 0; i < (v.count || 2); i++) { await page.evaluate(() => { window.__probe.wantSnaps = 1; }); await sleep(v.interval || 250); } await page.evaluate(() => window.__probe.stop()); const snaps = await page.evaluate(() => window.__probe.snaps); const p = path.join(RES, id + '-' + ph.name + '-' + (st.as || 'snaps') + '.json'); fs.writeFileSync(p, JSON.stringify(snaps)); P.snaps[st.as || 'snaps'] = { file: path.relative(RES, p), times: snaps.map(s => +s.t.toFixed(1)) }; }
          else if (op === 'monitor') { if (v === 'start') await page.evaluate(() => window.__mon.start()); else { const m = await page.evaluate(() => window.__mon.stop()); const iv = m.t.slice(1).map((t, i) => t - m.t[i]); const span = m.t[m.t.length - 1] - m.t[0]; P.monitors[st.as || 'monitor'] = { frames: m.t.length, fps: +((m.t.length - 1) / (span / 1000)).toFixed(2), p50IntervalMs: q(iv, 0.5), p95IntervalMs: +q(iv, 0.95).toFixed(2), p99IntervalMs: +q(iv, 0.99).toFixed(2), maxIntervalMs: +Math.max(...iv).toFixed(2), over33ms: iv.filter(x => x > 33.3).length, over50ms: iv.filter(x => x > 50).length, over100ms: iv.filter(x => x > 100).length, drawFramesPct: +(100 * m.drawsAt.filter(d => d > 0).length / Math.max(1, m.drawsAt.length)).toFixed(1), maxPointsPerFrame: m.maxPointsPerFrame }; } }
          else if (op === 'state') P.states[st.as || v] = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return { found: false }; return { found: true, text: (el.innerText || el.value || '').trim().slice(0, 120), ariaPressed: el.getAttribute('aria-pressed'), ariaLabel: el.getAttribute('aria-label'), title: el.title || null, value: el.value ?? null }; }, sel(id, v));
          else if (op === 'layout') P.layouts[v] = await page.evaluate((m) => { const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1)); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, hitTestable: !!hit && (hit === el || el.contains(hit) || (hit.closest && !!hit.closest('label') && hit.closest('label').contains(el))) }; }; const cv = [...document.querySelectorAll('canvas')].map(k => { const r = k.getBoundingClientRect(); return { cssW: Math.round(r.width), cssH: Math.round(r.height), bufW: k.width, bufH: k.height }; }); return { inner: [innerWidth, innerHeight], overflowX: document.documentElement.scrollWidth - innerWidth, overflowY: document.documentElement.scrollHeight - innerHeight, canvases: cv, controls: Object.fromEntries(Object.entries(m || {}).map(([k, s]) => [k, vis(document.querySelector(s))])) }; }, (plan.controls || {})[id]);
          else if (op === 'diff') { const [a, b] = v; if (buffers[a] && buffers[b]) P.diffs[st.as || a + '~' + b] = { ...meanDiff(buffers[a], buffers[b], st.crop || [0.2, 0.15, 0.8, 0.8]), darkPctA: darkFrac(buffers[a]), darkPctB: darkFrac(buffers[b]) }; else P.notes.push('diff skipped: missing shot ' + (buffers[a] ? b : a)); }
          else if (op === 'note') P.notes.push(v);
          else throw new Error('unknown step ' + JSON.stringify(st));
        }
      } catch (e) { P.error = String(e.message || e).slice(0, 500); }
      P.log = summarizeLog(log); await ctx.close();
    }
    writeJson(path.join(RES, id + '.json'), R);
    console.log(JSON.stringify({ id, phases: Object.fromEntries(Object.entries(R.phases).map(([k, p]) => [k, { error: p.error || null, shots: Object.keys(p.shots).length, probes: p.probes, monitors: p.monitors, diffs: p.diffs, pageErrors: p.log.pageErrors.length, consoleErrors: p.log.consoleErrors.length, failed: p.log.failed.length }])) }));
  }
})().catch(e => { console.error(e); process.exit(1); });
