// Usage: node perf_trial.cjs PLAN.json OUT_JSON TRIAL_NO [ID ...]
// One performance trial per submission, sequentially: fresh profile and load; rendering begins at the first observed
// WebGL draw call; warm-up (plan.perf.warmupMs, default 5000); measurement (plan.perf.measureMs, default 20000) by an
// independent rAF monitor. Screenshots only before warm-up and after measurement (to confirm ongoing animation).
// Run three trials, rotating the ID order by a third each time. Results merge into OUT_JSON under trial<N>.
const fs = require('fs'), path = require('path'), os = require('os');
const { open, url, readJson, writeJson, sleep, q } = require('./lib/common.cjs');
const { meanDiff } = require('./lib/imgdiff.cjs');
const MON = fs.readFileSync(path.join(__dirname, 'monitor-init.js'), 'utf8');
const [PLAN, OUT_JSON, TRIAL, ...only] = process.argv.slice(2);
if (!PLAN || !OUT_JSON || !TRIAL) { console.error('usage: node perf_trial.cjs PLAN.json OUT_JSON TRIAL_NO [ID ...]'); process.exit(1); }
const plan = readJson(PLAN); const WARM = (plan.perf && plan.perf.warmupMs) || 5000, MEAS = (plan.perf && plan.perf.measureMs) || 20000;
(async () => {
  const all = readJson(OUT_JSON, {});
  for (const id of (only.length ? only : Object.keys(plan.submissions))) {
    const sub = plan.submissions[id];
    const { ctx, page, log } = await open(path.join(os.tmpdir(), 'modelbench-profiles', 'perf-' + TRIAL + '-' + id), { width: (plan.viewport || [1440])[0], height: (plan.viewport || [0, 900])[1] });
    await page.addInitScript(MON);
    const t0 = Date.now();
    await page.goto(sub.url || url(sub.folder, sub.entry), { waitUntil: 'load', timeout: 45000 });
    const drew = await page.waitForFunction(() => window.__mon && window.__mon.first !== null, null, { timeout: 30000 }).then(() => true, () => false);
    const firstDraw = drew ? await page.evaluate(() => window.__mon.first) : null;
    const before = await page.screenshot();
    await sleep(WARM);
    const buf = () => page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; return c ? [c.width, c.height] : null; });
    const buf0 = await buf();
    await page.evaluate(() => window.__mon.start()); await sleep(MEAS);
    const m = await page.evaluate(() => window.__mon.stop());
    const buf1 = await buf(); const after = await page.screenshot();
    const iv = m.t.slice(1).map((t, i) => t - m.t[i]); const span = m.t[m.t.length - 1] - m.t[0];
    all[id] = all[id] || {};
    all[id]['trial' + TRIAL] = { folder: sub.folder, startedUtc: new Date(t0).toISOString(), warmupMs: WARM, measureMs: MEAS, firstDrawMsAfterNavStart: firstDraw == null ? null : Math.round(firstDraw), noDrawObserved: !drew,
      frames: m.t.length, fps: +((m.t.length - 1) / (span / 1000)).toFixed(2), p50IntervalMs: +q(iv, 0.5).toFixed(2), p95IntervalMs: +q(iv, 0.95).toFixed(2), maxIntervalMs: +Math.max(...iv).toFixed(2), pctOver33ms: +(100 * iv.filter(x => x > 33.3).length / iv.length).toFixed(3),
      appDrawFramesPct: +(100 * m.drawsAt.filter(d => d > 0).length / Math.max(1, m.drawsAt.length)).toFixed(2), drawCallsPerFrameMedian: q(m.drawsAt.filter(d => d > 0), 0.5), maxPointsDrawnPerFrame: m.maxPointsPerFrame,
      canvasBufferStart: buf0, canvasBufferEnd: buf1, animatingCheck: meanDiff(before, after, [0.2, 0.15, 0.8, 0.8]), pageErrors: log.pageErrors.length, consoleErrors: log.console.filter(x => x.type === 'error').length };
    writeJson(OUT_JSON, all); await ctx.close();
    console.log(JSON.stringify({ trial: TRIAL, id, fps: all[id]['trial' + TRIAL].fps, p95: all[id]['trial' + TRIAL].p95IntervalMs }));
  }
})().catch(e => { console.error(e); process.exit(1); });
