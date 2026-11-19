// Shared helpers for modelbench scripts.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const HOME = process.env.MODELBENCH_HOME || path.join(os.homedir(), '.cache', 'modelbench');
function req(name) { return require(require.resolve(name, { paths: [path.join(HOME, 'node_modules'), __dirname] })); }
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = (process.env.MODELBENCH_BASE_URL || 'http://127.0.0.1:8731').replace(/\/$/, '');
const HEADLESS = process.env.MODELBENCH_HEADLESS === '1';
const ARGS = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function url(folder, entry = 'index.html') { if (/^https?:/.test(entry)) return entry; return BASE + '/' + [...folder.split('/'), ...entry.split('/')].filter(Boolean).map(encodeURIComponent).join('/'); }
// Fresh persistent profile per page load; headed chromeless --app window unless MODELBENCH_HEADLESS=1.
async function open(profileDir, vp = { width: 1440, height: 900 }) {
  const { chromium } = req('playwright-core');
  fs.rmSync(profileDir, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(profileDir, { executablePath: CHROME, headless: HEADLESS, viewport: vp, deviceScaleFactor: 1, args: HEADLESS ? ARGS : ['--app=about:blank', ...ARGS] });
  const page = ctx.pages()[0] || await ctx.newPage();
  const log = { console: [], pageErrors: [], requests: [], failed: [] };
  page.on('console', m => log.console.push({ type: m.type(), text: m.text().slice(0, 500) }));
  page.on('pageerror', e => log.pageErrors.push(String(e).slice(0, 800)));
  page.on('request', r => log.requests.push(r.url().slice(0, 300)));
  page.on('requestfailed', r => log.failed.push({ url: r.url().slice(0, 300), err: r.failure() && r.failure().errorText }));
  page.on('response', r => { if (r.status() >= 400) log.failed.push({ url: r.url().slice(0, 300), status: r.status() }); });
  // the profile is disposable: remove it when the browser closes
  const close = ctx.close.bind(ctx); ctx.close = async () => { await close(); fs.rmSync(profileDir, { recursive: true, force: true }); };
  return { ctx, page, log };
}
function summarizeLog(log) { return { pageErrors: log.pageErrors, consoleErrors: log.console.filter(m => m.type === 'error').map(m => m.text), warnings: log.console.filter(m => m.type === 'warning').length, failed: log.failed, external: [...new Set(log.requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')))] }; }
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { if (d !== undefined) return d; throw new Error('Cannot read ' + p + ': ' + e.message); } };
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2)); };
const q = (arr, p) => { const s = arr.filter(x => x != null).sort((a, b) => a - b); if (!s.length) return null; return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]; };
const median = (a) => q(a, 0.5);
module.exports = { HOME, req, CHROME, BASE, url, open, summarizeLog, sleep, sha256, readJson, writeJson, q, median };
