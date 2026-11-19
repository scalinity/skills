// Usage: node freeze_scores.cjs OUT [--note "text"]
// Validates OUT/evidence/scores.json against OUT/evidence/rubric.json and writes OUT/evidence/scores-frozen.json + .sha256.
// scores.json: {"runs": {"S1": {"A1": {"pct": 75, "evidence": "..."}, "D1": {"pts": 3, "evidence": "..."}, ...}},
//               "status": {"S4": "DNF"}?, "notes": "incidental exposure, if any"}
// Anchors are 0/25/50/75/100 %; criteria marked "threshold" in the rubric take exact points instead.
// Unscored criteria may be {"notVerified": true, "evidence": "..."} and are reported as a range, never as zero.
const fs = require('fs'), path = require('path');
const { readJson, writeJson, sha256 } = require('./lib/common.cjs');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node freeze_scores.cjs OUT'); process.exit(1); }
const target = path.join(OUT, 'evidence', 'scores-frozen.json');
if (fs.existsSync(target)) { console.error('scores-frozen.json already exists; frozen scores are not changed after freezing.'); process.exit(2); }
const rubric = readJson(path.join(OUT, 'evidence', 'rubric.json')).rubric; const S = readJson(path.join(OUT, 'evidence', 'scores.json'));
const errors = []; const out = {};
for (const [id, crit] of Object.entries(S.runs)) {
  let total = 0, maxMissing = 0; const cats = {}; const sub = {};
  for (const r of rubric) {
    const c = crit[r.k]; cats[r.c] = cats[r.c] || 0;
    if (!c) { errors.push(id + ' ' + r.k + ': missing'); continue; }
    if (!c.evidence || String(c.evidence).trim().length < 8) errors.push(id + ' ' + r.k + ': evidence required');
    if (c.notVerified) { sub[r.k] = { label: r.label, max: r.max, pct: null, pts: null, notVerified: true, evidence: c.evidence }; maxMissing += r.max; continue; }
    let pts;
    if (r.threshold) { pts = c.pts; if (typeof pts !== 'number' || pts < 0 || pts > r.max) errors.push(id + ' ' + r.k + ': threshold criterion needs pts in 0..' + r.max); }
    else { if (![0, 25, 50, 75, 100].includes(c.pct)) errors.push(id + ' ' + r.k + ': pct must be an anchor (0/25/50/75/100), got ' + c.pct); pts = +(r.max * c.pct / 100).toFixed(2); }
    sub[r.k] = { label: r.label, max: r.max, pct: r.threshold ? +(100 * pts / r.max).toFixed(1) : c.pct, pts, evidence: c.evidence };
    total += pts || 0; cats[r.c] += pts || 0;
  }
  out[id] = { total: +total.toFixed(2), possibleMax: +(total + maxMissing).toFixed(2), provisional: maxMissing > 0, status: (S.status || {})[id] || 'evaluated', categories: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, +v.toFixed(2)])), sub };
}
if (errors.length) { console.error(JSON.stringify({ errors }, null, 1)); process.exit(1); }
const frozen = { frozenAtUtc: new Date().toISOString(), note: S.notes || '', rubric, scores: out };
writeJson(target, frozen); const h = sha256(fs.readFileSync(target));
fs.writeFileSync(target.replace(/\.json$/, '.sha256'), h + '  scores-frozen.json\n');
console.log(JSON.stringify({ sha256: h, totals: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.total + (v.provisional ? ' (provisional, up to ' + v.possibleMax + ')' : '')])) }, null, 1));
