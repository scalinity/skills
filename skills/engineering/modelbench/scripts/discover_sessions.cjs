// Usage: node discover_sessions.cjs ROOT OUT [--prompts] [--days 14]
// Maps Codex, Claude Code and Antigravity sessions to each submission folder by working directory and writes
// OUT/evidence/session-config.json (consumed by session_stats.cjs). Reads only session metadata and first prompts.
// Antigravity SQLite stores are copied to OUT/.cache/agy before reading; originals are never opened.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { readJson, writeJson } = require('./lib/common.cjs');
const args = process.argv.slice(2); const [ROOT, OUT] = args.filter(a => !a.startsWith('--')).map(p => path.resolve(p));
const PROMPTS = args.includes('--prompts'); const DAYS = args.includes('--days') ? +args[args.indexOf('--days') + 1] : 30;
if (!ROOT || !OUT) { console.error('usage: node discover_sessions.cjs ROOT OUT [--prompts] [--days N]'); process.exit(1); }
const H = os.homedir();
const inv = readJson(path.join(OUT, 'manifest', 'inventory.json'), { submissions: fs.readdirSync(ROOT, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'benchmark-results').map(e => ({ folder: e.name, entry: 'index.html' })) });
const folders = inv.submissions.filter(s => s.status !== 'excluded').map(s => ({ folder: s.folder, abs: path.join(ROOT, s.folder), entry: s.entry || 'index.html' }));
const since = Date.now() - DAYS * 864e5;
const owner = (cwd) => { if (!cwd) return null; const c = path.resolve(cwd); return folders.find(f => c === f.abs || c.startsWith(f.abs + path.sep)) || null; };
const firstLine = (p) => { const fd = fs.openSync(p, 'r'); const chunks = []; let pos = 0; try { for (;;) { const buf = Buffer.alloc(1 << 20); const n = fs.readSync(fd, buf, 0, buf.length, pos); if (!n) break; const i = buf.indexOf(10); if (i >= 0 && i < n) { chunks.push(buf.slice(0, i)); break; } chunks.push(buf.slice(0, n)); pos += n; if (pos > (32 << 20)) break; } } finally { fs.closeSync(fd); } return Buffer.concat(chunks).toString('utf8'); };
const clean = (t) => String(t || '').replace(/<\/?pasted_content[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const found = Object.fromEntries(folders.map(f => [f.folder, { folder: f.folder, entry: f.entry, sessions: [], kinds: new Set() }]));
// ---- Codex ----
function walk(d, acc) { if (!fs.existsSync(d)) return acc; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, acc); else if (/^rollout-.*\.jsonl$/.test(e.name) && fs.statSync(p).mtimeMs >= since) acc.push(p); } return acc; }
for (const p of walk(path.join(H, '.codex', 'sessions'), [])) {
  let meta; try { meta = JSON.parse(firstLine(p)).payload; } catch { continue; }
  const f = owner(meta && meta.cwd); if (!f) continue;
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const tc = lines.filter(l => l.type === 'turn_context').map(l => l.payload);
  const turns = lines.filter(l => l.payload && l.payload.type === 'task_started').length, aborted = lines.filter(l => l.payload && l.payload.type === 'turn_aborted').length;
  const complete = lines.some(l => l.payload && l.payload.type === 'task_complete');
  const toolCalls = lines.filter(l => l.payload && /^(custom_tool_call|function_call)$/.test(l.payload.type)).length;
  const sub = meta.source && typeof meta.source === 'object' && meta.source.subagent;
  const role = sub ? 'subagent' : (!complete && !toolCalls && aborted >= turns ? 'excluded' : 'main');
  let prompt = null; if (PROMPTS) { const um = lines.find(l => l.payload && l.payload.type === 'item_completed' && l.payload.item && l.payload.item.type === 'UserMessage'); prompt = um ? clean(um.payload.item.content.map(c => c.text).join(' ')) : null; }
  found[f.folder].sessions.push({ kind: 'codex', id: meta.id, role, path: p, cwd: meta.cwd, startUtc: meta.timestamp, models: [...new Set(tc.map(t => t.model + '/' + t.effort))], turns, aborted, toolCalls, completed: complete, parent: sub ? sub.thread_spawn && sub.thread_spawn.parent_thread_id : null, prompt });
}
// ---- Claude Code ----
const enc = (p) => p.replace(/[\/ .]/g, '-');
const projDir = path.join(H, '.claude', 'projects');
if (fs.existsSync(projDir)) for (const f of folders) {
  const d = path.join(projDir, enc(f.abs)); if (!fs.existsSync(d)) continue;
  for (const name of fs.readdirSync(d).filter(n => n.endsWith('.jsonl'))) {
    const p = path.join(d, name); if (fs.statSync(p).mtimeMs < since) continue;
    const L = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const reqs = L.filter(l => l.type === 'api-request');
    const eff = {}; for (const r of reqs) { const k = (r.params && r.params.model) + '/' + (r.params && r.params.output_config && r.params.output_config.effort); eff[k] = (eff[k] || 0) + 1; }
    const userText = L.filter(l => l.type === 'user' && !l.isMeta).map(l => typeof l.message.content === 'string' ? l.message.content : (Array.isArray(l.message.content) && !l.message.content.some(c => c.type === 'tool_result') ? l.message.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : '')).filter(t => t && !/<command-name>|<local-command/.test(t));
    const subs = fs.existsSync(path.join(d, name.replace('.jsonl', ''), 'subagents')) ? fs.readdirSync(path.join(d, name.replace('.jsonl', ''), 'subagents')).filter(n => n.endsWith('.jsonl')).map(n => path.join(d, name.replace('.jsonl', ''), 'subagents', n)) : [];
    found[f.folder].sessions.push({ kind: 'claude', id: name.replace('.jsonl', ''), role: reqs.length ? 'main' : 'excluded', path: p, startUtc: (L.find(l => l.timestamp) || {}).timestamp, models: Object.entries(eff).map(([k, v]) => k + ' ×' + v), turns: L.filter(l => l.type === 'system' && l.subtype === 'turn_duration').length, subagentTranscripts: subs, prompt: PROMPTS ? clean(userText[0]) : null });
  }
}
// ---- Antigravity CLI ----
const agyRoot = path.join(H, '.gemini', 'antigravity-cli');
const meta = readJson(path.join(agyRoot, 'cache', 'conversation_metadata.json'), { conversations: {} });
const last = readJson(path.join(agyRoot, 'cache', 'last_conversations.json'), {});
const agyIds = new Set();
for (const [id, c] of Object.entries(meta.conversations || {})) for (const u of (c.summary && c.summary.WorkspaceURIs) || []) { const f = owner(decodeURIComponent(u.replace(/^file:\/\//, ''))); if (f) agyIds.add(id + '|' + f.folder); }
for (const [ws, id] of Object.entries(last)) { const f = owner(ws); if (f) agyIds.add(id + '|' + f.folder); }
for (const key of agyIds) {
  const [id, folder] = key.split('|'); const db = path.join(agyRoot, 'conversations', id + '.db'); if (!fs.existsSync(db)) continue;
  const copyDir = path.join(OUT, '.cache', 'agy'); fs.mkdirSync(copyDir, { recursive: true });
  for (const sfx of ['', '-wal', '-shm']) if (fs.existsSync(db + sfx)) fs.copyFileSync(db + sfx, path.join(copyDir, id + '.db' + sfx));
  const copy = path.join(copyDir, id + '.db');
  let models = [], prompt = null;
  try { const gens = JSON.parse(execFileSync('node', [path.join(__dirname, 'decode_agy.mjs'), copy, 'gen_metadata'], { maxBuffer: 1 << 28 }).toString()); models = [...new Set(gens.map(g => { const top = (g.data || []).find(x => x.f === 1); const lab = top && top.m.find(x => x.f === 21); return lab ? lab.s : '?'; }))]; if (PROMPTS) { const st = JSON.parse(execFileSync('node', [path.join(__dirname, 'decode_agy.mjs'), copy, 'steps', '0'], { maxBuffer: 1 << 26 }).toString()); const f19 = st[0] && (st[0].data || []).find(x => x.f === 19); prompt = f19 ? clean((f19.m.find(x => x.f === 2) || {}).s) : null; } } catch (e) { models = ['decode failed: ' + String(e.message).slice(0, 80)]; }
  found[folder].sessions.push({ kind: 'agy', id, role: 'main', path: db, dbCopy: copy, models, prompt });
}
// ---- assemble ----
const runs = Object.values(found).map(r => { const kinds = [...new Set(r.sessions.filter(s => s.role !== 'excluded').map(s => s.kind))]; const mains = r.sessions.filter(s => s.role === 'main'); return { folder: r.folder, entry: r.entry, kind: kinds.length === 1 ? kinds[0] : kinds.length ? 'mixed' : 'unattributed', sessions: r.sessions, flags: [mains.length > 1 ? 'multiple main sessions: decide which produced the graded delivery, mark the rest excluded with a reason' : null, !mains.length ? 'no session found: search other harnesses (see harness-telemetry), else mark unattributed' : null, kinds.length > 1 ? 'sessions from more than one harness' : null].filter(Boolean) }; });
const cfg = { root: ROOT, generatedUtc: new Date().toISOString(), decoder: path.join(__dirname, 'decode_agy.mjs'), runs };
writeJson(path.join(OUT, 'evidence', 'session-config.json'), cfg);
const prompts = PROMPTS ? runs.flatMap(r => r.sessions.filter(s => s.prompt && s.role === 'main').map(s => s.prompt)) : [];
const uniq = [...new Set(prompts)];
console.log(JSON.stringify({ runs: runs.map(r => ({ folder: r.folder, kind: r.kind, sessions: r.sessions.map(s => s.kind + ':' + s.id.slice(0, 8) + ':' + s.role + ':' + (s.models || []).join(',')), flags: r.flags })), prompts: PROMPTS ? { distinct: uniq.length, sameForAll: uniq.length === 1, text: uniq.length === 1 ? uniq[0] : uniq.map(u => u.slice(0, 200)) } : undefined }, null, 1));
