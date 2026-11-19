// Usage: node session_stats.cjs OUT [--allow-unfrozen]
// Reads OUT/evidence/session-config.json (from discover_sessions.cjs) and writes OUT/evidence/session-stats.json keyed by folder.
// Originating sessions are read-only; Antigravity is read from the copies made by discover_sessions.cjs.
// Run only after scores are frozen: the output contains durations, tokens and cost inputs.
const fs = require('fs'), path = require('path'); const { execFileSync } = require('child_process');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node session_stats.cjs OUT'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(path.join(OUT, 'evidence', 'session-config.json'), 'utf8'));
if (!fs.existsSync(path.join(OUT, 'evidence', 'scores-frozen.json')) && !process.argv.includes('--allow-unfrozen')) { console.error('Refusing: freeze scores first (freeze_scores.cjs), or pass --allow-unfrozen for a structure-only dry run.'); process.exit(3); }
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
let ENTRY = /index\.html/;
const stripWs = (s) => s.replace(/\s+/g, '');
function compareDelivery(text, folder, entry) {
  const fp = path.join(cfg.root, folder, entry || 'index.html'); if (!text || !fs.existsSync(fp)) return { chatHasCode: false };
  const m = text.match(/```(?:html|[a-z]*)\n([\s\S]*?)```/); const code = m ? m[1] : (/^\s*(<!doctype|<html)/i.test(text) ? text : null);
  if (!code) return { chatHasCode: false, chatChars: text.length };
  const file = fs.readFileSync(fp, 'utf8'); const exact = code === file || code.trimEnd() === file.trimEnd();
  const A = stripWs(file), B = stripWs(code); let i = 0; while (i < A.length && A[i] === B[i]) i++;
  const res = { chatHasCode: true, identical: exact, whitespaceInsensitiveEqual: A === B, netNonWhitespaceCharDiff: B.length - A.length, firstDifference: A === B ? null : { file: A.slice(i, i + 60), chat: B.slice(i, i + 60) } };
  if (!exact) { const d = path.join(OUT, 'evidence', 'chat-deliveries'); fs.mkdirSync(d, { recursive: true }); const p = path.join(d, folder.replace(/[^\w.-]+/g, '_') + '-chat-delivered' + path.extname(fp)); fs.writeFileSync(p, code); res.archived = path.relative(OUT, p); }
  return res;
}
const iso = (ms) => ms == null ? null : new Date(ms).toISOString();
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
let WRITE_RE = null;
const buildWriteRe = (base) => { const n = escRe(base); return new RegExp('(\\*\\*\\* (Add|Update) File:[^\\n]*' + n + ')|(writeFile(Sync)?\\([^)]{0,200}' + n + ')|(>\\s*[\'"]?[^\\n;|&]{0,200}' + n + ')|(\\btee\\s+[^\\n]{0,200}' + n + ')|(write_file[^\\n]{0,400}' + n + ')|(file_path[^\\n]{0,40}' + n + ')'); };
const isWrite = (s) => WRITE_RE.test(s);
const readJsonl = (p) => fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

function codex(run) {
  const files = run.sessions.filter(s => s.kind === 'codex').map(s => ({ ...s, lines: readJsonl(s.path) }));
  const main = files.find(f => f.role === 'main');
  const L = main.lines;
  const started = L.find(l => l.payload?.type === 'task_started');
  const complete = L.find(l => l.payload?.type === 'task_complete');
  const ctx = L.find(l => l.type === 'turn_context')?.payload || {};
  const settings = L.find(l => l.payload?.type === 'thread_settings_applied')?.payload?.thread_settings || {};
  const tStart = Date.parse(started.timestamp), tEnd = complete ? Date.parse(complete.timestamp) : null;
  const userTurns = L.filter(l => l.payload?.type === 'task_started').length;
  // first visible (non-reasoning) assistant text
  const agentMsgs = L.filter(l => l.payload?.type === 'item_completed' && l.payload.item?.type === 'AgentMessage');
  const firstVis = agentMsgs[0];
  // first write of deliverable: earliest tool-call output whose call input writes index.html
  const calls = L.filter(l => ['custom_tool_call', 'function_call'].includes(l.payload?.type));
  const outputs = new Map(L.filter(l => ['custom_tool_call_output', 'function_call_output'].includes(l.payload?.type)).map(l => [l.payload.call_id, l]));
  const writeCalls = calls.filter(c => isWrite(String(c.payload.input ?? c.payload.arguments ?? '')));
  const fw = writeCalls[0]; const fwOut = fw ? outputs.get(fw.payload.call_id) : null;
  // inner tools
  const items = L.filter(l => l.payload?.type === 'item_completed').map(l => l.payload.item);
  const cmds = items.filter(i => i.type === 'CommandExecution'), mcps = items.filter(i => i.type === 'McpToolCall');
  const failedCmds = cmds.filter(i => i.exit_code != null && i.exit_code !== 0).length + mcps.filter(i => i.status && !/complet|success/i.test(String(i.status))).length;
  const toolSec = (cmds.concat(mcps).reduce((s, i) => s + (typeof i.duration === 'object' ? ((i.duration.secs || 0) + (i.duration.nanos || 0) / 1e9) : (Number(i.duration) || 0)), 0));
  // usage: all sessions attributed to the scored run (main + subagents), dedupe by response_id
  const seen = new Map(); const perSession = {};
  for (const f of files.filter(f => f.role !== 'excluded')) {
    for (const l of f.lines.filter(l => l.type === 'token_usage_record')) { const id = l.payload.response_id; if (!seen.has(id)) { seen.set(id, { u: l.payload.usage, role: f.role, thread: l.payload.thread_id, ts: l.timestamp }); perSession[f.role] = (perSession[f.role] || 0) + 1; } }
  }
  const sum = (k, filt = () => true) => [...seen.values()].filter(filt).reduce((s, r) => s + (r.u[k] || 0), 0);
  const lastThread = [...L].reverse().find(l => l.type === 'token_usage_record')?.payload?.thread_token_usage || null;
  const rl = L.filter(l => l.payload?.type === 'token_count' && l.payload.rate_limits).map(l => l.payload.rate_limits);
  const excluded = files.filter(f => f.role === 'excluded').map(f => { const u = f.lines.filter(l => l.payload?.type === 'token_count').map(l => l.payload.info?.total_token_usage).filter(Boolean).pop() || null; const tc = f.lines.find(l => l.type === 'turn_context')?.payload || {}; return { session: f.id, model: tc.model, effort: tc.effort, turns: f.lines.filter(l => l.payload?.type === 'task_started').length, aborted: f.lines.filter(l => l.payload?.type === 'turn_aborted').length, toolCalls: f.lines.filter(l => ['custom_tool_call', 'function_call'].includes(l.payload?.type)).length, lastTotalTokenUsage: u, firstTs: f.lines[0]?.timestamp, lastTs: f.lines[f.lines.length - 1]?.timestamp }; });
  const subs = files.filter(f => f.role === 'subagent').map(f => { const tc = f.lines.filter(l => l.type === 'turn_context').map(l => l.payload.model + '/' + l.payload.effort); const st = f.lines.filter(l => l.payload?.type === 'task_started').map(l => l.timestamp); const cp = f.lines.filter(l => l.payload?.type === 'task_complete').map(l => ({ ts: l.timestamp, duration_ms: l.payload.duration_ms, ttft_ms: l.payload.time_to_first_token_ms })); return { session: f.id, models: [...new Set(tc)], turns: st.length, aborted: f.lines.filter(l => l.payload?.type === 'turn_aborted').length, completes: cp, toolCalls: f.lines.filter(l => ['custom_tool_call', 'function_call'].includes(l.payload?.type)).length }; });
  return {
    harness: 'Codex CLI (codex-tui)', harnessVersion: main.lines[0].payload.cli_version, provider: settings.model_provider_id || 'openai', serviceTier: settings.service_tier || null,
    sessions: files.map(f => ({ id: f.id, role: f.role, path: f.path })), model: ctx.model, effortRecorded: ctx.effort, reasoningSummary: settings.reasoning_summary,
    taskStart: started.timestamp, firstDelivery: complete?.timestamp ?? null, elapsedSec: tEnd ? (tEnd - tStart) / 1000 : null,
    providerReported: { task_complete_duration_ms: complete?.payload?.duration_ms ?? null, time_to_first_token_ms: complete?.payload?.time_to_first_token_ms ?? null, started_at: complete?.payload?.started_at ?? null },
    firstVisibleResponseSec: firstVis ? (firstVis.payload.completed_at_ms - tStart) / 1000 : null,
    firstArtifactWriteSec: fwOut ? (Date.parse(fwOut.timestamp) - tStart) / 1000 : null, firstArtifactWriteTs: fwOut?.timestamp ?? null,
    deliverableWriteCalls: writeCalls.length, userTurns, followUps: Math.max(0, userTurns - 1),
    requests: { total: seen.size, bySession: perSession }, modelToolCalls: calls.length, innerToolCalls: { commands: cmds.length, mcp: mcps.length }, failedInnerToolCalls: failedCmds, toolTimeSec: +toolSec.toFixed(1),
    tokens: { input: sum('input_tokens'), cachedInput: sum('cached_input_tokens'), cacheWrite: sum('cache_write_input_tokens'), output: sum('output_tokens'), reasoning: sum('reasoning_output_tokens'), subagent: { input: sum('input_tokens', r => r.role === 'subagent'), output: sum('output_tokens', r => r.role === 'subagent'), reasoning: sum('reasoning_output_tokens', r => r.role === 'subagent'), cachedInput: sum('cached_input_tokens', r => r.role === 'subagent') } },
    maxRequestInput: Math.max(0, ...[...seen.values()].map(r => r.u.input_tokens || 0)),
    rawCrossCheck: { mainThreadFinalCumulative: lastThread }, rateLimit: { first: rl[0]?.primary ?? null, last: rl[rl.length - 1]?.primary ?? null, plan_type: rl[0]?.plan_type ?? null },
    subagents: subs, excludedSessions: excluded,
    effortRecords: L.filter(l => l.type === 'turn_context').map(l => l.payload.effort), delivery: compareDelivery(complete && complete.payload.last_agent_message, run.folder, run.entry),
  };
}

function claude(run) {
  const main = run.sessions.find(s => s.kind === 'claude' && s.role === 'main');
  const L = readJsonl(main.path);
  const textOf = (l) => typeof l.message?.content === 'string' ? l.message.content : (Array.isArray(l.message?.content) && !l.message.content.some(c => c.type === 'tool_result') ? l.message.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : '');
  const prompt = L.find(l => l.type === 'user' && !l.isMeta && textOf(l).length > 40 && !/<command-name>|<local-command/.test(textOf(l)));
  const tStart = Date.parse(prompt.timestamp);
  const turnEnds = L.filter(l => l.type === 'system' && l.subtype === 'turn_duration');
  const firstEnd = turnEnds[0];
  const userPrompts = L.filter(l => l.type === 'user' && !l.isMeta && (typeof l.message?.content === 'string' || (Array.isArray(l.message?.content) && l.message.content.some(c => c.type === 'text') && !l.message.content.some(c => c.type === 'tool_result'))));
  const real = L.filter(l => l.type === 'assistant' && l.message?.model && l.message.model !== '<synthetic>');
  const byId = new Map(); for (const l of real) { if (!byId.has(l.message.id)) byId.set(l.message.id, { first: l, u: l.message.usage, model: l.message.model, ts: l.timestamp, blocks: [] }); byId.get(l.message.id).blocks.push(l); }
  const msgs = [...byId.values()];
  const tEnd = firstEnd ? Date.parse(firstEnd.timestamp) : null;
  const inScored = (m) => tEnd == null || Date.parse(m.ts) <= tEnd;
  const sumU = (f, filt = () => true) => msgs.filter(filt).reduce((s, m) => s + f(m.u), 0);
  const firstText = real.find(l => l.message.content?.some?.(c => c.type === 'text' && c.text.trim().length));
  const toolUses = []; for (const l of L) if (l.type === 'assistant' && Array.isArray(l.message?.content)) for (const c of l.message.content) if (c.type === 'tool_use') toolUses.push({ l, c, inner: l.message.model === '<synthetic>' });
  const results = new Map(); for (const l of L) if (l.type === 'user' && Array.isArray(l.message?.content)) for (const c of l.message.content) if (c.type === 'tool_result') results.set(c.tool_use_id, { l, c });
  const writes = toolUses.filter(t => t.inner && ['Write', 'Edit'].includes(t.c.name) && ENTRY.test(t.c.input?.file_path || ''));
  const fw = writes.find(t => t.c.name === 'Write') || writes[0]; const fwRes = fw ? results.get(fw.c.id) : null;
  const failed = [...results.values()].filter(r => r.c.is_error).length;
  const apiReq = L.filter(l => l.type === 'api-request');
  const cost = L.filter(l => l.type === 'cost-state').pop() || null;
  const efforts = [...new Set(apiReq.map(a => a.params?.output_config?.effort))];
  const models = [...new Set(apiReq.map(a => a.params?.model))];
  const tiers = [...new Set(msgs.map(m => m.u.service_tier))];
  return {
    harness: 'Claude Code CLI', harnessVersion: [...new Set(L.map(l => l.version).filter(Boolean))].join(','), provider: 'anthropic', serviceTier: tiers.join(','), auth: apiReq.some(a => (a.params?.betas || []).some(b => /^oauth/.test(b))) ? 'oauth (subscription login)' : 'unknown',
    sessions: run.sessions.map(s => ({ id: s.id, role: s.role, path: s.path })), model: models.join(','), effortRecorded: efforts.join(','), thinking: apiReq[0]?.params?.thinking || null,
    taskStart: prompt.timestamp, firstDelivery: firstEnd?.timestamp ?? null, elapsedSec: tEnd ? (tEnd - tStart) / 1000 : null,
    providerReported: { turn_duration_ms: firstEnd?.durationMs ?? null, turn_message_count: firstEnd?.messageCount ?? null, costState: cost ? { totalCostUSD: cost.totalCostUSD, totalAPIDuration: cost.totalAPIDuration, totalAPIDurationWithoutRetries: cost.totalAPIDurationWithoutRetries, totalToolDuration: cost.totalToolDuration, totalDuration: cost.totalDuration, startTime: cost.startTime, modelUsage: cost.modelUsage, hasUnknownModelCost: cost.hasUnknownModelCost } : null },
    firstVisibleResponseSec: firstText ? (Date.parse(firstText.timestamp) - tStart) / 1000 : null, firstVisibleResponseNote: 'transcript line time of the first non-empty text block (block completion, not first token)',
    firstArtifactWriteSec: fwRes ? (Date.parse(fwRes.l.timestamp) - tStart) / 1000 : null, firstArtifactWriteTs: fwRes?.l.timestamp ?? null, deliverableWriteCalls: writes.length,
    userTurns: userPrompts.length, turnEnds: turnEnds.map(t => t.timestamp), followUps: Math.max(0, turnEnds.length - 1),
    requests: { total: msgs.length, apiRequestRecords: apiReq.length, inScoredAttempt: msgs.filter(inScored).length },
    maxRequestInput: Math.max(0, ...msgs.map(m => (m.u.input_tokens || 0) + (m.u.cache_creation_input_tokens || 0) + (m.u.cache_read_input_tokens || 0))),
    modelToolCalls: toolUses.filter(t => !t.inner).length, innerToolCalls: toolUses.filter(t => t.inner).length, failedToolResults: failed,
    tokens: { inputUncached: sumU(u => u.input_tokens || 0), cacheWrite: sumU(u => u.cache_creation_input_tokens || 0), cacheWrite1h: sumU(u => u.cache_creation?.ephemeral_1h_input_tokens || 0), cacheWrite5m: sumU(u => u.cache_creation?.ephemeral_5m_input_tokens || 0), cacheRead: sumU(u => u.cache_read_input_tokens || 0), output: sumU(u => u.output_tokens || 0), reasoning: sumU(u => u.output_tokens_details?.thinking_tokens || 0), reasoningCoverage: msgs.filter(m => m.u.output_tokens_details?.thinking_tokens != null).length + '/' + msgs.length },
    tokensScoredAttempt: { inputUncached: sumU(u => u.input_tokens || 0, inScored), cacheWrite: sumU(u => u.cache_creation_input_tokens || 0, inScored), cacheRead: sumU(u => u.cache_read_input_tokens || 0, inScored), output: sumU(u => u.output_tokens || 0, inScored), reasoning: sumU(u => u.output_tokens_details?.thinking_tokens || 0, inScored) },
    effortRecords: apiReq.map(a => a.params?.output_config?.effort),
    delivery: (() => { const lastText = [...real].reverse().find(l => (l.message.content || []).some(c => c.type === 'text' && c.text.trim())); return compareDelivery(lastText ? lastText.message.content.filter(c => c.type === 'text').map(c => c.text).join('\n') : null, run.folder, run.entry); })(),
    postDeliveryEvents: L.filter(l => tEnd && l.timestamp && Date.parse(l.timestamp) > tEnd).map(l => l.type + (l.subtype ? ':' + l.subtype : '')).reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {}),
  };
}

function agy(run) {
  const s0 = run.sessions.find(s => s.kind === 'agy' && s.role === 'main'); run = { ...run, dbCopy: s0.dbCopy, dbOriginal: s0.path, id: s0.id, harnessVersion: 'see log/cli-*.log', auth: 'see settings / log (consumer login implies no bill)' };
  const dec = (table) => JSON.parse(execFileSync('node', [path.join(__dirname, 'decode_agy.mjs'), run.dbCopy, table], { maxBuffer: 1 << 28 }).toString());
  const get = (t, path) => { let cur = t; for (const f of path) { const n = (cur || []).find(x => x.f === f); if (!n) return undefined; cur = n.m ?? n; } return cur; };
  const val = (n) => n == null ? null : (n.v ?? n.s ?? null);
  const ts = (m) => m && Array.isArray(m) ? (val(m.find(x => x.f === 1)) || 0) * 1000 + (val(m.find(x => x.f === 2)) || 0) / 1e6 : null;
  const dur = (m) => m && Array.isArray(m) ? (val(m.find(x => x.f === 1)) || 0) + (val(m.find(x => x.f === 2)) || 0) / 1e9 : null;
  const gens = dec('gen_metadata').map(r => { const top = get(r.data, [1]); const u = get(r.data, [1, 4]); const f = (k) => val((u || []).find(x => x.f === k)); const kv = Object.fromEntries((top || []).filter(x => x.f === 20).map(x => [val(x.m.find(y => y.f === 1)), val(x.m.find(y => y.f === 2))])); return { idx: r.idx, model: val((top || []).find(x => x.f === 19)), label: val((top || []).find(x => x.f === 21)), modelEnumField1: f(1), input: f(2), output: f(3), apiProviderField6: f(6), thinking: f(9), response: f(10), responseId: f(11), toFirstChunkSec: dur(get(r.data, [1, 11])), streamSec: dur(get(r.data, [1, 12])), usedNonGemini: kv.used_non_gemini_model, lastStep: kv.last_step_index }; });
  const steps = dec('steps').map(s => { const md = s.metadata || []; const p = s.data || []; return { idx: s.idx, type: s.step_type, status: s.status, created: ts(get(md, [1])), firstChunk: ts(get(md, [6])), done: ts(get(md, [8])), payload: p }; });
  const user = steps.find(s => s.type === 14);
  const tStart = user.created;
  const planners = steps.filter(s => s.type === 15), tools = steps.filter(s => s.type === 132);
  const toolInfo = tools.map(s => { const t = get(s.payload, [5, 4]); return { idx: s.idx, status: s.status, name: val((t || []).find(x => x.f === 2)), args: String(val((t || []).find(x => x.f === 3)) || ''), done: s.done }; });
  const writes = toolInfo.filter(t => /write_file|replace|edit|multi_replace/i.test(t.name || '') && ENTRY.test(t.args));
  const lastDone = Math.max(...steps.map(s => s.done || s.created || 0));
  const plannerText = planners.map(s => { const r = get(s.payload, [20]); return { idx: s.idx, done: s.done, fields: (r || []).filter(x => x.s !== undefined).map(x => [x.f, x.s.length, x.s.slice(0, 60)]) }; });
  const ttfts = gens.map(g => g.toFirstChunkSec).filter(x => x != null);
  return {
    harness: 'Antigravity CLI', harnessVersion: run.harnessVersion, provider: 'google', serviceTier: null, auth: run.auth,
    sessions: [{ id: run.id, role: 'main', path: run.dbOriginal }], model: [...new Set(gens.map(g => g.model))].join(','), modelLabel: [...new Set(gens.map(g => g.label))].join(','), effortRecorded: [...new Set(gens.map(g => (g.label || '').match(/\(([^)]+)\)/)?.[1]))].join(','), usedNonGeminiModel: [...new Set(gens.map(g => g.usedNonGemini))].join(','),
    taskStart: iso(tStart), firstDelivery: iso(lastDone), elapsedSec: (lastDone - tStart) / 1000,
    initialRequestToFirstChunkSec: gens[0]?.toFirstChunkSec ?? null, perRequestToFirstChunkSec: { n: ttfts.length, median: q(ttfts, 0.5), p95: q(ttfts, 0.95), min: Math.min(...ttfts), max: Math.max(...ttfts) },
    aggregateRequestSec: +gens.reduce((s, g) => s + (g.toFirstChunkSec || 0) + (g.streamSec || 0), 0).toFixed(1),
    firstArtifactWriteSec: writes[0] ? (writes[0].done - tStart) / 1000 : null, firstArtifactWriteTs: writes[0] ? iso(writes[0].done) : null, deliverableWriteCalls: writes.length,
    userTurns: steps.filter(s => s.type === 14).length, followUps: Math.max(0, steps.filter(s => s.type === 14).length - 1),
    requests: { total: gens.length }, modelToolCalls: tools.length, toolStatus: tools.reduce((a, t) => (a[t.status] = (a[t.status] || 0) + 1, a), {}), toolNames: toolInfo.reduce((a, t) => (a[t.name] = (a[t.name] || 0) + 1, a), {}),
    tokens: { input: gens.reduce((s, g) => s + (g.input || 0), 0), output: gens.reduce((s, g) => s + (g.output || 0), 0), reasoning: gens.reduce((s, g) => s + (g.thinking || 0), 0), nonReasoning: gens.reduce((s, g) => s + (g.response || 0), 0), outputIdentityHolds: gens.every(g => (g.thinking || 0) + (g.response || 0) === g.output), cacheReadReported: false },
    visibleText: (() => { const vis = planners.map(s => { const r = get(s.payload, [20]); const t = (r || []).find(x => x.f === 1 && x.s !== undefined); return t && t.s.trim() ? { done: s.done, text: t.s } : null; }).filter(Boolean); return { count: vis.length, firstVisibleSec: vis[0] ? (vis[0].done - tStart) / 1000 : null, final: vis.length ? vis[vis.length - 1].text : null }; })(),
    effortRecords: gens.map(g => (g.label || '').match(/\(([^)]+)\)/)?.[1] || null),
    plannerTextSample: plannerText.slice(0, 2), gens,
  };
}

const out = {};
for (const run of cfg.runs) {
  if (!run.sessions || !run.sessions.some(s => s.role === 'main')) { out[run.folder] = { folder: run.folder, unattributed: true }; continue; }
  ENTRY = new RegExp(escRe(path.basename(run.entry || 'index.html'))); WRITE_RE = buildWriteRe(path.basename(run.entry || 'index.html'));
  const kind = run.sessions.find(s => s.role === 'main').kind;
  try { const r = kind === 'codex' ? codex(run) : kind === 'claude' ? claude(run) : kind === 'agy' ? agy(run) : { error: 'unsupported harness ' + kind };
    if (kind === 'agy' && r.visibleText) { r.firstVisibleResponseSec = r.visibleText.firstVisibleSec; r.delivery = compareDelivery(r.visibleText.final, run.folder, run.entry); delete r.visibleText.final; }
    out[run.folder] = { folder: run.folder, kind, ...r };
  } catch (e) { out[run.folder] = { folder: run.folder, kind, error: String(e.stack || e) }; }
}
fs.writeFileSync(path.join(OUT, 'evidence', 'session-stats.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.error ? 'ERROR ' + v.error.slice(0, 200) : v.unattributed ? 'unattributed' : (v.model + ' ' + (v.elapsedSec != null ? (v.elapsedSec / 60).toFixed(1) + ' min' : '')) ])), null, 1));
