// Usage: node artifact_metrics.cjs OUT
// Measures each submission's graded entry file exactly as delivered (no reformatting) plus its authored runtime files,
// from OUT/manifest/inventory.json. Writes OUT/evidence/artifacts.json keyed by folder.
// Lines: split on LF, a trailing newline adds no line; nonblank = contains a non-whitespace character; KiB = bytes/1024.
const fs = require('fs'), path = require('path');
const { readJson, writeJson, sha256 } = require('./lib/common.cjs');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node artifact_metrics.cjs OUT'); process.exit(1); }
const inv = readJson(path.join(OUT, 'manifest', 'inventory.json'));
const res = {};
for (const s of inv.submissions.filter(x => x.status !== 'excluded')) {
  const dir = path.join(inv.root, s.folder); const entry = s.entry && fs.existsSync(path.join(dir, s.entry)) ? s.entry : null;
  const rec = { folder: s.folder, entryPoint: entry, entryMissing: !entry };
  if (entry) { const buf = fs.readFileSync(path.join(dir, entry)); const txt = buf.toString('utf8'); const lines = txt.split('\n'); if (txt.endsWith('\n')) lines.pop();
    Object.assign(rec, { bytes: buf.length, kib: +(buf.length / 1024).toFixed(2), unicodeChars: [...txt].length, physicalLines: lines.length, nonblankLines: lines.filter(l => /\S/.test(l)).length, sha256: sha256(buf),
      cdnLibraries: [...new Set([...txt.matchAll(/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com|esm\.sh|cdnjs\.cloudflare\.com\/ajax\/libs)\/(@?[\w.-]+(?:\/[\w.-]+)?)@?([\d][\w.-]*)?/g)].map(m => m[1] + (m[2] ? '@' + m[2] : '')))] }); }
  const files = (s.authoredRuntimeFiles || []); rec.authoredRuntimeFiles = files.length; rec.authoredRuntimeBytes = files.reduce((a, f) => a + f.bytes, 0); rec.authoredFileList = files.map(f => f.path);
  res[s.folder] = rec;
}
writeJson(path.join(OUT, 'evidence', 'artifacts.json'), res);
console.log(JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.entryMissing ? 'entry missing' : v.kib + ' KiB / ' + v.physicalLines + ' lines / ' + v.authoredRuntimeFiles + ' files'])), null, 1));
