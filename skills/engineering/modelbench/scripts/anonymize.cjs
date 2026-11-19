// Usage: node anonymize.cjs OUT
// Assigns anonymous IDs S1..Sn and a random review order to OUT/manifest/inventory.json submissions (status not "excluded").
const crypto = require('crypto'), path = require('path');
const { readJson, writeJson } = require('./lib/common.cjs');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node anonymize.cjs OUT'); process.exit(1); }
const inv = readJson(path.join(OUT, 'manifest', 'inventory.json'));
const target = path.join(OUT, 'manifest', 'anonymization.json');
const prev = readJson(target, null); if (prev) { console.log(JSON.stringify(prev, null, 1)); console.error('anonymization.json exists; delete it to re-randomize'); process.exit(0); }
const seed = crypto.randomBytes(16).toString('hex');
let s = parseInt(seed.slice(0, 8), 16) >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const folders = inv.submissions.filter(x => x.status !== 'excluded').map(x => x.folder);
const assigned = shuffle(folders); const assign = Object.fromEntries(assigned.map((f, i) => ['S' + (i + 1), f]));
const order = shuffle(Object.keys(assign));
const res = { seedHex: seed, method: 'mulberry32 seeded from the first 32 bits of seedHex; first shuffle assigns IDs, second sets review order', assign, reviewOrder: order, createdUtc: new Date().toISOString() };
writeJson(target, res); console.log(JSON.stringify(res, null, 1));
