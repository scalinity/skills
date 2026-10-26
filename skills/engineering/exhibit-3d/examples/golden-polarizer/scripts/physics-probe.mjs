// Drives the Polarizer bench through states with window.__exhibit and records what the HUD shows.
// Output: a markdown table of observations (no expected values: the judge computes those).
// usage: node scripts/physics-probe.mjs <url> <out.md>   (run from the exhibit folder)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
const req = createRequire(join(process.cwd(), 'package.json'));
const pw = await import(req.resolve('playwright'));
const chromium = (pw.chromium ?? pw.default.chromium);
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url + (url.includes('?') ? '&' : '?') + 'instant=1');
await page.waitForFunction(() => window.__exhibit && window.__exhibit.ready);
await page.evaluate(() => window.__exhibit.ready);
const states = [
  { analyzer: 0, middle: 'out' }, { analyzer: 30, middle: 'out' }, { analyzer: 45, middle: 'out' },
  { analyzer: 60, middle: 'out' }, { analyzer: 90, middle: 'out' }, { analyzer: 135, middle: 'out' },
  { analyzer: 180, middle: 'out' },
  { analyzer: 90, middle: 'in', middleAngle: 45 }, { analyzer: 90, middle: 'in', middleAngle: 0 },
  { analyzer: 90, middle: 'in', middleAngle: 90 }, { analyzer: 70, middle: 'in', middleAngle: 30 },
  { analyzer: 0, middle: 'in', middleAngle: 45 },
];
const rows = [];
const read = () => page.evaluate(() => ({
  stats: Object.fromEntries([...document.querySelectorAll('.stat')].map((e) => [e.querySelector('.k').textContent.trim(), e.querySelector('.v').innerText.replace(/\s+/g, ' ').trim()])),
  meter: [...document.querySelectorAll('.labels-layer .wl')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('Meter')) ?? '',
  caption: document.querySelector('.why')?.textContent?.trim() ?? '',
}));
for (const s of states) {
  await page.evaluate((st) => window.__exhibit.setState({ middleAngle: 45, ...st }, { instant: true }), s);
  await page.waitForTimeout(1300);
  rows.push({ s, r: await read() });
}
const sweep = [];
await page.evaluate(() => window.__exhibit.setState({ middle: 'out' }, { instant: true }));
for (let a = 0; a <= 90; a += 10) {
  await page.evaluate((v) => window.__exhibit.setState({ analyzer: v }, { instant: true }), a);
  await page.waitForTimeout(250);
  const r = await read();
  sweep.push(`${a}° → ${r.stats.Through ?? r.stats.THROUGH ?? JSON.stringify(r.stats)}`);
}
await browser.close();
const fmtState = (s) => `analyzer ${s.analyzer}°, middle ${s.middle}${s.middle === 'in' ? ` at ${s.middleAngle}°` : ''}`;
let md = '# Physics observations (displayed values, driven through window.__exhibit)\n\n';
md += 'Each row sets a state with `__exhibit.setState(…, { instant: true })` and reads the HUD readouts, the meter label and the caption as displayed.\n\n';
md += '| State | ANGLE | FACTOR | THROUGH | Meter label | Caption |\n|---|---|---|---|---|---|\n';
for (const { s, r } of rows) {
  const v = (k) => r.stats[k] ?? r.stats[k.toUpperCase()] ?? '';
  md += `| ${fmtState(s)} | ${v('Angle')} | ${v('Factor')} | ${v('Through')} | ${r.meter} | ${r.caption.replace(/\|/g, '/')} |\n`;
}
md += `\nSweep with the middle filter out (analyzer angle → THROUGH): ${sweep.join(' · ')}\n`;
writeFileSync(out, md);
console.log(md.split('\n').slice(4, 18).join('\n'));
