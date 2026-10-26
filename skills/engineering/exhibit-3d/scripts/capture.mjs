#!/usr/bin/env node
// capture.mjs: the qa-rubric §3 capture matrix for an exhibit, with metrics and a contact sheet.
//
//   node capture.mjs <url> --out <dir> [--shots all|01,06,12] [--allow-fallback] [--headed]
//
// Launches the installed Google Chrome through Playwright with WebGPU enabled, drives the exhibit
// through URL parameters and window.__exhibit, waits for `ready` plus 1.5 s, and writes:
//   <dir>/NN-name.png        the shots
//   <dir>/metrics.json       backend, requested canvas contexts, fps idle and in cinematic mode,
//                            console messages, page errors
//   <dir>/hud.txt, help.txt  the visible HUD text and the help sheet
//   <dir>/13-labels-off.png, 14-keyboard-focus.png, 15-20 orbit views (behind, east, west, above, Exploded
//   and Studio from behind), 21-compact-hud.png, tour-N.png (the opening tour from a plain load, one frame
//   every 6.5 s), 22-takeover.png (the HUD after one key press: the card back, the lesson's first request),
//   <dir>/a11y.json          accessible names, keyboard checks, visible focus, reduced motion
//                            (extras: with --shots all or --extras; view-switch frame times go in metrics.json)
//   <dir>/contact-sheet.html (and .png) the shots beside the four exemplars at the same scale
// Exits non-zero when the backend is not WebGPU (unless --allow-fallback) or the console has errors.
// Playwright resolves from the exhibit's node_modules (run it from the exhibit folder).

import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exemplarDir = resolve(here, '../references/exemplars');

// ---------- arguments ----------
const argv = process.argv.slice(2);
const VALUED = new Set(['--out', '--shots']);
const options = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUED.has(a)) options[a.slice(2)] = argv[++i];
  else if (a.startsWith('--')) options[a.slice(2)] = true;
  else positional.push(a);
}
const url = positional[0];
const opt = (name, fallback = null) => (typeof options[name] === 'string' ? options[name] : fallback);
const flag = (name) => options[name] === true;
if (!url || flag('help')) {
  console.log('usage: node capture.mjs <url> --out <dir> [--shots all|01,06,12] [--allow-fallback] [--headed] [--fps] [--extras]');
  process.exit(url ? 0 : 2);
}
const outDir = resolve(opt('out', 'qa'));
const allowFallback = flag('allow-fallback');
mkdirSync(outDir, { recursive: true });

async function loadPlaywright() {
  const tries = [join(process.cwd(), 'package.json'), join(here, 'package.json')];
  for (const base of tries) {
    try {
      const req = createRequire(base);
      const mod = await import(pathToFileURL(req.resolve('playwright')).href);
      return mod.chromium ? mod : mod.default;
    } catch { /* next */ }
  }
  console.error('capture.mjs: playwright not found. Run `npm i -D playwright` in the exhibit folder.');
  process.exit(2);
}
const { chromium } = await loadPlaywright();

// ---------- the matrix (qa-rubric §3) ----------
const DESKTOP = { width: 1600, height: 900, scale: 2 };
const MATRIX = [
  { id: '01', name: 'lab-default', params: {} },
  { id: '02', name: 'lab-preset-1', params: { preset: 1 } },
  { id: '03', name: 'lab-preset-2', params: { preset: 2 } },
  { id: '04', name: 'lab-preset-3', params: { preset: 3 } },
  { id: '05', name: 'lab-preset-4', params: { preset: 4 } },
  { id: '06', name: 'exploded', params: { view: 'exploded', labels: 1 } },
  { id: '07', name: 'studio', params: { view: 'studio' } },
  { id: '08', name: 'ui-hidden', params: { ui: 0 } },
  { id: '09', name: 'help', params: {}, help: true },
  { id: '10', name: 'phone', params: {}, viewport: { width: 390, height: 844, scale: 3 } },
  { id: '11', name: 'short-window', params: {}, viewport: { width: 1600, height: 760, scale: 2 } },
  { id: '12', name: 'closeup', params: { pose: 'closeup' } },
];
const pick = opt('shots', 'all');
const shots = pick === 'all' ? MATRIX : MATRIX.filter((s) => pick.split(',').some((k) => s.id === k.padStart(2, '0') || s.name === k));

const ARGS = ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=WebGPU'];
if (process.platform === 'darwin') ARGS.push('--use-angle=metal');
if (process.platform === 'linux') ARGS.push('--enable-features=Vulkan');

// Runs before any page script: records requested canvas contexts and counts frames.
const PROBE = () => {
  window.__contexts = [];
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type !== '2d') window.__contexts.push(type);
    return orig.call(this, type, ...rest);
  };
  window.__raf = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__raf++; cb(t); });
};

const withParams = (base, params, o = { instant: true }) => {
  const u = new URL(base);
  if (o.instant) u.searchParams.set('instant', '1');
  // A plain load plays the opening tour (cinematic.ts): every page but the opening's own opens still.
  if (!o.opening) u.searchParams.set('cinematic', '0');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
};

async function launch(headed) {
  return chromium.launch({ channel: 'chrome', headless: !headed, args: ARGS });
}

const consoleLog = [];
const pageErrors = [];
let backend = 'unknown';
let contexts = [];

async function openPage(browser, vp, target, o = {}) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale, reducedMotion: o.reducedMotion ?? 'no-preference' });
  await context.addInitScript(PROBE);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'debug' || m.text().startsWith('[vite]')) return;
    consoleLog.push({ type: m.type(), text: m.text() });
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(target, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.ready, null, { timeout: 60_000 });
  await page.evaluate(() => window.__exhibit.ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  return { page, context };
}

async function probeBackend(headed) {
  const browser = await launch(headed);
  try {
    const { page, context } = await openPage(browser, DESKTOP, withParams(url, {}));
    const b = await page.evaluate(() => window.__exhibit.backend);
    const c = await page.evaluate(() => window.__contexts);
    await context.close();
    return { browser, backend: b, contexts: c };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

// Headless first; rerun headed if WebGPU is not active.
let headed = flag('headed');
let probe = await probeBackend(headed);
if (probe.backend !== 'webgpu' && !headed) {
  console.log('capture: headless did not get WebGPU, rerunning headed');
  await probe.browser.close();
  headed = true;
  probe = await probeBackend(true);
}
const browser = probe.browser;
backend = probe.backend;
contexts = probe.contexts;
console.log(`capture: backend ${backend} (${headed ? 'headed' : 'headless'}), contexts ${JSON.stringify(contexts)}`);

const written = [];
for (const s of shots) {
  const vp = s.viewport ?? DESKTOP;
  const { page, context } = await openPage(browser, vp, withParams(url, s.params));
  if (s.help) {
    await page.click('[data-tool="help"]');
    await page.waitForTimeout(500);
  }
  const file = `${s.id}-${s.name}.png`;
  await page.screenshot({ path: join(outDir, file) });
  // What the HUD displays in this state: evidence for the physics checks without reading code.
  const shown = await page.evaluate(() => ({
    stats: [...document.querySelectorAll('.stat')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
    caption: document.querySelector('.why')?.textContent?.trim() ?? '',
    labels: [...document.querySelectorAll('.labels-layer .wl')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
  }));
  written.push({ ...s, file, viewport: vp, shown });
  if (s.id === '01') {
    const text = await page.evaluate(() => window.__exhibit.text?.() ?? { hud: '', help: '' });
    writeFileSync(join(outDir, 'hud.txt'), text.hud + '\n');
    writeFileSync(join(outDir, 'help.txt'), text.help + '\n');
  }
  await context.close();
  console.log(`capture: ${file}`);
}

// ---------- frame rate: 5 s idle, 5 s cinematic ----------
let perf = null;
if (pick === 'all' || flag('fps')) {
  const { page, context } = await openPage(browser, DESKTOP, withParams(url, {}));
  const measure = async () => {
    const r0 = await page.evaluate(() => window.__raf);
    await page.waitForTimeout(5000);
    const r1 = await page.evaluate(() => window.__raf);
    const stats = await page.evaluate(() => window.__exhibit.fpsStats(5000));
    return { avg: +stats.avg.toFixed(1), min: +stats.min.toFixed(1), rafPerSec: +((r1 - r0) / 5).toFixed(1) };
  };
  const idle = await measure();
  await page.evaluate(() => window.__exhibit.cinematic(true));
  await page.waitForTimeout(800);
  const cinematic = await measure();
  await page.evaluate(() => window.__exhibit.cinematic(false));
  perf = { viewport: '1600x900@2', idle, cinematic, note: headed ? 'headed: display refresh rate' : 'headless Chrome caps requestAnimationFrame at 60 Hz' };
  await context.close();
}

// ---------- extras: what the matrix cannot show ----------
// The label toggle on its own, keyboard focus and accessible names, reduced motion, frame times
// across view switches, and the cinematic tour itself. Pages load without `instant` where motion
// is the evidence.
const extraShots = [];
const orbitShots = [];
const tourShots = [];
let opening = null;
let viewSwitch = null;
const HOUSE_VIEWS = ['lab', 'exploded', 'studio', 'assembled'];
if (pick === 'all' || flag('extras')) {
  // 13: labels off with the interface on.
  {
    const { page, context } = await openPage(browser, DESKTOP, withParams(url, { labels: 0 }));
    await page.screenshot({ path: join(outDir, '13-labels-off.png') });
    extraShots.push({ file: '13-labels-off.png', note: 'labels off, interface on' });
    await context.close();
    console.log('capture: 13-labels-off.png');
  }
  // 14 and a11y.json: accessible names, house keys, visible focus.
  const a11y = {};
  {
    const { page, context } = await openPage(browser, DESKTOP, withParams(url, {}));
    a11y.controls = await page.evaluate(() => {
      const named = (e) => {
        const by = e.getAttribute('aria-labelledby');
        const text = e.getAttribute('aria-label') || (by && document.getElementById(by)?.textContent) || e.textContent || e.getAttribute('title') || '';
        return text.replace(/\s+/g, ' ').trim();
      };
      const els = [...document.querySelectorAll('#app button, #app input, #app [role="slider"], #app [role="button"]')];
      return els.filter((e) => e.getClientRects().length > 0).map((e) => ({
        tag: e.tagName.toLowerCase(), role: e.getAttribute('role') ?? '', name: named(e), tabIndex: e.tabIndex,
        pressed: e.getAttribute('aria-pressed'), valuetext: e.getAttribute('aria-valuetext'),
      }));
    });
    a11y.unnamed = a11y.controls.filter((c) => !c.name).length;
    // House keys (exhibit-design §7): 1-4 jump to setups, / hides the interface.
    const keyCheck = async (key, read) => { await page.keyboard.press(key); await page.waitForTimeout(250); return page.evaluate(read); };
    a11y.keys = {
      '2 -> preset': await keyCheck('2', () => window.__exhibit.getState().preset),
      '1 -> preset': await keyCheck('1', () => window.__exhibit.getState().preset),
      '/ -> interface hidden': await keyCheck('/', () => document.getElementById('app').classList.contains('ui-off')),
      '/ again -> interface back': await keyCheck('/', () => !document.getElementById('app').classList.contains('ui-off')),
    };
    // Tab into the control card and record what the focus looks like.
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => !!document.activeElement?.closest('.ctl'))) break;
    }
    await page.waitForTimeout(700);
    a11y.focus = await page.evaluate(() => {
      const e = document.activeElement;
      const cs = getComputedStyle(e);
      return { element: `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)}"`, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, outlineOffset: cs.outlineOffset };
    });
    await page.screenshot({ path: join(outDir, '14-keyboard-focus.png') });
    extraShots.push({ file: '14-keyboard-focus.png', note: `keyboard focus: ${a11y.focus.element}` });
    console.log('capture: 14-keyboard-focus.png');
    // View switches: frame times across every view, then back to the first.
    const views = [];
    for (const v of HOUSE_VIEWS) {
      await page.evaluate((name) => window.__exhibit.setView(name, { instant: true }), v);
      if ((await page.evaluate(() => window.__exhibit.getState().view)) === v) views.push(v);
    }
    await page.evaluate((name) => window.__exhibit.setView(name, { instant: true }), views[0]);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.__frames = [];
      const loop = (t) => { window.__frames.push(t); if (window.__frames.length < 4000) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
    for (const v of [...views.slice(1), views[0]]) {
      await page.evaluate((name) => window.__exhibit.setView(name, { instant: false }), v);
      await page.waitForTimeout(1800);
    }
    const frames = await page.evaluate(() => window.__frames);
    const gaps = frames.slice(1).map((t, i) => t - frames[i]);
    const worst = Math.max(...gaps);
    const span = frames[frames.length - 1] - frames[0];
    viewSwitch = {
      views, switches: views.length, frames: frames.length, avgFps: +(((frames.length - 1) * 1000) / span).toFixed(1),
      worstFrameMs: +worst.toFixed(1), framesOver33ms: gaps.filter((g) => g > 33.4).length,
    };
    await context.close();
  }
  // Reduced motion: a view switch should cut, with no veil fade.
  {
    const peak = async (reducedMotion) => {
      const { page, context } = await openPage(browser, { ...DESKTOP, scale: 1 }, withParams(url, {}, { instant: false }), { reducedMotion });
      const v = viewSwitch?.views?.[1] ?? 'exploded';
      const max = await page.evaluate(async (name) => {
        let m = 0;
        const veil = document.getElementById('veil');
        const t0 = performance.now();
        window.__exhibit.setView(name);
        while (performance.now() - t0 < 900) {
          m = Math.max(m, parseFloat(veil ? getComputedStyle(veil).opacity : '0') || 0);
          await new Promise((r) => requestAnimationFrame(r));
        }
        return m;
      }, v);
      const mediaMatches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      await context.close();
      return { mediaMatches, veilPeakOpacity: +max.toFixed(2) };
    };
    a11y.reducedMotion = { normal: await peak('no-preference'), reduced: await peak('reduce') };
  }
  writeFileSync(join(outDir, 'a11y.json'), JSON.stringify(a11y, null, 2) + '\n');
  console.log(`capture: a11y.json (${a11y.controls.length} controls, ${a11y.unnamed} unnamed)`);
  // 15 to 20: the sets from every side (free orbit), and 21: the compact HUD.
  for (const [file, params, note] of [
    ['15-lab-behind.png', { orbit: '180,8' }, 'Lab from behind'],
    ['16-lab-east.png', { orbit: '90,8' }, 'Lab from the east'],
    ['17-lab-west.png', { orbit: '-90,8' }, 'Lab from the west'],
    ['18-lab-above.png', { orbit: '0,70' }, 'Lab from above'],
    ['19-exploded-behind.png', { view: 'exploded', orbit: '180,6' }, 'Exploded from behind'],
    ['20-studio-behind.png', { view: 'studio', orbit: '150,10' }, 'Studio from behind'],
    ['21-compact-hud.png', { compact: 1 }, 'compact HUD'],
  ]) {
    const { page, context } = await openPage(browser, DESKTOP, withParams(url, params));
    await page.screenshot({ path: join(outDir, file) });
    (file.startsWith('21') ? extraShots : orbitShots).push({ file, note });
    await context.close();
    console.log(`capture: ${file}`);
  }
  // The opening: a plain load plays the cinematic tour with the control card faded away. One frame every
  // 6.5 s, long enough for a room circle and the close-ups; the veil watched throughout to count the
  // dissolves; then one key press, which should bring the card back and start the lesson.
  {
    const { page, context } = await openPage(browser, { ...DESKTOP, scale: 1 }, withParams(url, {}, { instant: false, opening: true }));
    const hudState = () => page.evaluate(() => ({
      presenting: document.getElementById('app')?.classList.contains('presenting') ?? false,
      tour: document.querySelector('[data-tool="cinematic"]')?.getAttribute('aria-pressed') === 'true',
      lesson: document.querySelector('[data-tool="lesson"]')?.getAttribute('aria-pressed') === 'true',
      caption: document.querySelector('.why')?.innerText.trim() ?? '',
    }));
    opening = { atLoad: await hudState() };
    await page.evaluate(() => {
      const veil = document.getElementById('veil');
      const w = (window.__veil = { dissolves: 0, max: 0, up: false });
      const tick = () => {
        const o = Number(veil?.style.opacity || 0);
        w.max = Math.max(w.max, o);
        if (o > 0.95 && !w.up) { w.dissolves++; w.up = true; }
        if (o < 0.05) w.up = false;
        requestAnimationFrame(tick);
      };
      tick();
    });
    for (let i = 1; i <= 12; i++) {
      await page.waitForTimeout(i === 1 ? 1000 : 6500);
      const file = `tour-${i}.png`;
      await page.screenshot({ path: join(outDir, file) });
      tourShots.push({ file, note: `opening +${2.5 + (i - 1) * 6.5} s` });
    }
    const veil = await page.evaluate(() => window.__veil);
    opening.dissolves = veil.dissolves;
    opening.veilMax = +veil.max.toFixed(2);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    opening.afterKey = await hudState();
    await page.screenshot({ path: join(outDir, '22-takeover.png') });
    extraShots.push({ file: '22-takeover.png', note: 'one key press during the opening' });
    await context.close();
    console.log(`capture: ${tourShots.length} opening frames, ${opening.dissolves} dissolves, takeover`);
  }
}
await browser.close();

// ---------- metrics ----------
const errors = consoleLog.filter((m) => m.type === 'error');
const warnings = consoleLog.filter((m) => m.type === 'warning');
const metrics = {
  url, date: new Date().toISOString(), headed, backend, contexts,
  webgpu: backend === 'webgpu' && contexts.includes('webgpu'),
  fps: perf, viewSwitch, opening, consoleErrors: errors, consoleWarnings: warnings, pageErrors,
  shots: written.map((s) => ({ file: s.file, params: s.params, viewport: `${s.viewport.width}x${s.viewport.height}@${s.viewport.scale}`, shown: s.shown })),
};
writeFileSync(join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');

// ---------- contact sheet ----------
mkdirSync(join(outDir, 'exemplars'), { recursive: true });
const exemplars = ['01-prism-room-lab.png', '02-prism-room-exploded.png', '03-root-finder-lab.png', '04-plane-of-focus-exploded.png'];
for (const e of exemplars) if (existsSync(join(exemplarDir, e))) copyFileSync(join(exemplarDir, e), join(outDir, 'exemplars', e));
const cell = (src, label) => `<figure><img src="${src}" alt="${label}"><figcaption>${label}</figcaption></figure>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Contact sheet</title>
<style>
:root{color-scheme:dark}body{margin:0;padding:24px;background:#0b0f1a;color:#c7cee0;font:500 12px ui-monospace,Menlo,monospace}
h2{font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8d97b3;margin:18px 0 10px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}
img{display:block;width:100%;height:auto;border-radius:6px;background:#000}figcaption{margin-top:5px;color:#9ea8c2}
.meta{color:#9ea8c2;line-height:1.6}
</style></head><body>
<div class="meta">${url} · backend <b>${backend}</b> · fps idle ${perf ? `${perf.idle.avg} (min ${perf.idle.min})` : 'n/a'} · cinematic ${perf ? `${perf.cinematic.avg} (min ${perf.cinematic.min})` : 'n/a'} · console errors ${errors.length}</div>
<h2>Exemplars</h2><div class="grid">${exemplars.map((e) => cell(`exemplars/${e}`, e)).join('')}</div>
<h2>Build</h2><div class="grid">${written.map((s) => cell(s.file, s.file)).join('')}</div>
${extraShots.length ? `<h2>Extras</h2><div class="grid">${extraShots.map((s) => cell(s.file, `${s.file} · ${s.note}`)).join('')}</div>` : ''}
${orbitShots.length ? `<h2>Orbit · the sets from every side</h2><div class="grid">${orbitShots.map((s) => cell(s.file, `${s.file} · ${s.note}`)).join('')}</div>` : ''}
${tourShots.length ? `<h2>Opening tour · one frame every 6.5 s</h2><div class="grid">${tourShots.map((s) => cell(s.file, s.note)).join('')}</div>` : ''}
</body></html>`;
writeFileSync(join(outDir, 'contact-sheet.html'), html);

// Render the sheet to a PNG so a reviewer that reads images can see it.
const sheetBrowser = await chromium.launch({ channel: 'chrome', headless: true });
const sheetPage = await sheetBrowser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
await sheetPage.goto(pathToFileURL(join(outDir, 'contact-sheet.html')).href);
await sheetPage.waitForTimeout(300);
await sheetPage.screenshot({ path: join(outDir, 'contact-sheet.png'), fullPage: true });
await sheetBrowser.close();

console.log(`capture: ${written.length} shots, metrics.json, contact-sheet.html in ${outDir}`);
if (perf) console.log(`capture: fps idle ${perf.idle.avg} avg / ${perf.idle.min} min, cinematic ${perf.cinematic.avg} / ${perf.cinematic.min}`);
let code = 0;
if (backend !== 'webgpu' && !allowFallback) {
  console.error(`capture: FAIL backend is ${backend}, not webgpu`);
  code = 1;
}
if (errors.length || pageErrors.length) {
  console.error(`capture: FAIL ${errors.length} console errors, ${pageErrors.length} page errors`);
  for (const e of [...errors.map((x) => x.text), ...pageErrors].slice(0, 10)) console.error('  ' + e.slice(0, 300));
  code = 1;
}
process.exit(code);
