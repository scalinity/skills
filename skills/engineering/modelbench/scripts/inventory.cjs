// Usage: node inventory.cjs ROOT OUT [--after]
// Hashes every file under ROOT (except OUT) to OUT/manifest/hashes-before.sha256 (or hashes-after with --after, then diffs),
// and proposes submissions/exclusions in OUT/manifest/inventory.json for the agent to review.
const fs = require('fs'), path = require('path');
const { sha256, writeJson } = require('./lib/common.cjs');
const [ROOT, OUT] = process.argv.slice(2).filter(a => !a.startsWith('--')).map(p => path.resolve(p)); const AFTER = process.argv.includes('--after');
if (!ROOT || !OUT) { console.error('usage: node inventory.cjs ROOT OUT [--after]'); process.exit(1); }
const DEP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vite', 'coverage', '.cache']);
const TOOL = new Set(['.codegraph', '.worktrees', '.playwright-mcp', '.artifacts', '.claude', '.codex', '.gemini', '.grok', '.agents', '__pycache__', '.venv', 'venv', '.DS_Store']);
const RUNTIME = /\.(html?|m?js|cjs|jsx|tsx?|css|glsl|vert|frag|wgsl|json|wasm|svg|py|rs|go|java|c|cc|cpp|h|hpp|rb|swift|kt)$/i;
function walk(dir, acc = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (path.resolve(p) === OUT || (dir === ROOT && e.name === 'benchmark-results')) continue; if (e.isSymbolicLink()) { acc.push({ p, link: true }); continue; } if (e.isDirectory()) walk(p, acc); else acc.push({ p }); } return acc; }
const all = walk(ROOT).sort((a, b) => a.p.localeCompare(b.p));
const lines = all.filter(f => !f.link).map(f => sha256(fs.readFileSync(f.p)) + '  ./' + path.relative(ROOT, f.p));
fs.mkdirSync(path.join(OUT, 'manifest'), { recursive: true });
const hashFile = path.join(OUT, 'manifest', AFTER ? 'hashes-after.sha256' : 'hashes-before.sha256');
fs.writeFileSync(hashFile, lines.join('\n') + '\n');
if (AFTER) {
  const before = fs.readFileSync(path.join(OUT, 'manifest', 'hashes-before.sha256'), 'utf8').trim().split('\n');
  const a = new Set(lines), b = new Set(before);
  const changed = before.filter(l => !a.has(l)), added = lines.filter(l => !b.has(l));
  console.log(JSON.stringify({ identical: !changed.length && !added.length, files: lines.length, changedOrRemoved: changed, added }, null, 1));
  process.exit(changed.length || added.length ? 2 : 0);
}
const subs = [], excluded = [];
for (const e of fs.readdirSync(ROOT, { withFileTypes: true }).filter(e => e.isDirectory()).sort((x, y) => x.name.localeCompare(y.name))) {
  const dir = path.join(ROOT, e.name); if (path.resolve(dir) === OUT || e.name === 'benchmark-results') { excluded.push({ path: e.name, reason: 'Evaluation output.' }); continue; }
  if (e.name.startsWith('.')) { excluded.push({ path: e.name, reason: 'Hidden tool directory.' }); continue; }
  const files = walk(dir).map(f => path.relative(dir, f.p));
  const isDep = (rel) => rel.split(path.sep).some(s => DEP.has(s)); const isTool = (rel) => rel.split(path.sep).some(s => TOOL.has(s));
  for (const rel of files) { const top = rel.split(path.sep)[0]; if (isDep(rel) || isTool(rel)) { const key = e.name + '/' + rel.split(path.sep).slice(0, rel.split(path.sep).findIndex(s => DEP.has(s) || TOOL.has(s)) + 1).join('/'); if (!excluded.find(x => x.path === key)) excluded.push({ path: key, reason: isDep(rel) ? 'Dependency or build output, not authored.' : 'Harness/tool data written during generation, not runtime.' }); } }
  const authored = files.filter(rel => !isDep(rel) && !isTool(rel) && RUNTIME.test(rel) && !/(^|\/)(package-lock|pnpm-lock|yarn\.lock)/.test(rel));
  const entries = authored.filter(rel => /(^|\/)index\.html?$/i.test(rel)).sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  const pkg = files.find(rel => rel === 'package.json');
  for (const rel of files.filter(rel => !isDep(rel) && !isTool(rel) && !authored.includes(rel))) excluded.push({ path: e.name + '/' + rel, reason: /\.(md|txt)$/i.test(rel) ? 'Documentation, not runtime.' : /^\.gitignore$|\/\.gitignore$/.test(rel) ? 'Ignore file, not runtime.' : 'Not an authored runtime file (review).' });
  subs.push({ folder: e.name, entry: entries[0] || (pkg ? 'package.json' : null), entryCandidates: entries, needsBuild: !!pkg, authoredRuntimeFiles: authored.map(rel => ({ path: rel, bytes: fs.statSync(path.join(dir, rel)).size })), status: entries.length || pkg ? 'candidate' : 'no-entry-point (review)', expectedModel: null });
}
const inv = { root: ROOT, out: OUT, scannedUtc: new Date().toISOString(), files: lines.length, submissions: subs, excluded, note: 'Review: confirm each submission, set expectedModel, record multiple runs separately, and give every exclusion a reason.' };
writeJson(path.join(OUT, 'manifest', 'inventory.json'), inv);
console.log(JSON.stringify({ files: lines.length, submissions: subs.map(s => ({ folder: s.folder, entry: s.entry, files: s.authoredRuntimeFiles.length, status: s.status })), excluded: excluded.length }, null, 1));
