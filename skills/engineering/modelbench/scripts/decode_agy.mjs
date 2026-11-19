// Raw protobuf (wire-format) dump of Antigravity CLI conversation SQLite stores.
// Usage: node decode_agy.mjs <copy-of-conversation.db> <table> [idx]
// Reads a COPY of the store; never open the live file.
import { DatabaseSync } from 'node:sqlite';
const [,, dbPath, table = 'gen_metadata', only] = process.argv;
const td = new TextDecoder('utf-8', { fatal: true });
function readVarint(b, p) { let r = 0n, s = 0n; for (;;) { const x = b[p++]; if (x === undefined) throw new Error('eof'); r |= BigInt(x & 0x7f) << s; if (!(x & 0x80)) break; s += 7n; } return [r, p]; }
function decode(b, depth = 0) {
  const out = []; let p = 0;
  while (p < b.length) {
    let key; [key, p] = readVarint(b, p);
    const fn = Number(key >> 3n), wt = Number(key & 7n);
    if (fn === 0) throw new Error('fn0');
    if (wt === 0) { let v; [v, p] = readVarint(b, p); out.push({ f: fn, v: v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString() }); }
    else if (wt === 1) { if (p + 8 > b.length) throw new Error('eof'); const dv = new DataView(b.buffer, b.byteOffset + p, 8); out.push({ f: fn, d: dv.getFloat64(0, true), u64: dv.getBigUint64(0, true).toString() }); p += 8; }
    else if (wt === 5) { if (p + 4 > b.length) throw new Error('eof'); const dv = new DataView(b.buffer, b.byteOffset + p, 4); out.push({ f: fn, fl: dv.getFloat32(0, true), u32: dv.getUint32(0, true) }); p += 4; }
    else if (wt === 2) {
      let len; [len, p] = readVarint(b, p); len = Number(len); if (p + len > b.length) throw new Error('len');
      const sub = b.subarray(p, p + len); p += len;
      let str = null; try { str = td.decode(sub); if (/[\x00-\x08\x0e-\x1f\x7f]/.test(str)) str = null; } catch {}
      let nested = null; if (depth < 14 && len > 0) { try { nested = decode(sub, depth + 1); } catch { nested = null; } }
      if (str !== null && (nested === null || /^[\x20-\x7e]*$/.test(str))) out.push({ f: fn, s: str });
      else if (nested) out.push({ f: fn, m: nested });
      else out.push({ f: fn, bytes: len });
    } else throw new Error('wt' + wt);
  }
  return out;
}
const db = new DatabaseSync(dbPath, { readOnly: true });
const col = table === 'steps' ? 'step_payload' : 'data';
const extra = table === 'steps' ? ', step_type, status, metadata, error_details' : '';
const rows = db.prepare('select idx, ' + col + ' as data' + extra + ' from ' + table + (only !== undefined ? ' where idx = ' + Number(only) : '') + ' order by idx').all();
const res = rows.map(r => {
  const o = { idx: r.idx };
  if (r.step_type !== undefined) { o.step_type = r.step_type; o.status = r.status; }
  for (const k of ['data', 'metadata', 'error_details']) if (r[k]) { try { o[k] = decode(new Uint8Array(r[k])); } catch (e) { o[k] = { error: String(e), bytes: r[k].length }; } }
  return o;
});
process.stdout.write(JSON.stringify(res));
