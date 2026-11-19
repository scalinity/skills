// Usage: node assemble_metrics.cjs OUT
// Joins frozen scores, session stats, pricing, artifacts, runtime results, notes and craft into OUT/metrics.json.
// Inputs (OUT/...): manifest/inventory.json, manifest/anonymization.json, evidence/scores-frozen.json,
//   evidence/session-stats.json, evidence/artifacts.json, evidence/pricing.json, evidence/environment.json,
//   evidence/runtime/perf.json, evidence/runtime/*.json (run_plan results), evidence/notes.json, evidence/craft.json.
// Accounting and cost rules: references/methodology.md. Nothing here changes a frozen score.
const fs = require('fs'), path = require('path');
const { readJson, writeJson, median } = require('./lib/common.cjs');
const OUT = process.argv[2]; if (!OUT) { console.error('usage: node assemble_metrics.cjs OUT'); process.exit(1); }
const E = (f, d) => readJson(path.join(OUT, 'evidence', f), d);
const inv = readJson(path.join(OUT, 'manifest', 'inventory.json')); const anon = readJson(path.join(OUT, 'manifest', 'anonymization.json'));
const frozen = E('scores-frozen.json'); const SS = E('session-stats.json', {}); const ART = E('artifacts.json', {}); const PRICE = E('pricing.json', { models: {} });
const ENV = E('environment.json', {}); const PERF = E('runtime/perf.json', {}); const NOTES = E('notes.json', { meta: {}, runs: {} }); const CRAFT = E('craft.json', null);
const RT = {}; const rtDir = path.join(OUT, 'evidence', 'runtime'); if (fs.existsSync(rtDir)) for (const f of fs.readdirSync(rtDir).filter(f => /^S\d+\.json$/.test(f))) RT[f.replace('.json', '')] = readJson(path.join(rtDir, f));
const meta = { title: 'Model benchmark', lede: '', subject: '', reportedEffort: null, timezone: 'America/New_York', ...(NOTES.meta || {}) };
const r2 = (x, n = 2) => x == null || Number.isNaN(x) ? null : +Number(x).toFixed(n);
const pct = (a, b) => (a == null || !b) ? null : r2(100 * a / b, 2);
const tz = (iso) => { if (!iso) return null; const d = new Date(iso); const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: meta.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' }).formatToParts(d).map(x => [x.type, x.value])); return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour.replace('24', '00') + ':' + p.minute + ':' + p.second + ' ' + p.timeZoneName; };
const vendorOf = (m, kind) => /^(gpt|o\d|codex)/i.test(m || '') || kind === 'codex' ? 'OpenAI' : /^claude/i.test(m || '') || kind === 'claude' ? 'Anthropic' : /^gemini/i.test(m || '') || kind === 'agy' ? 'Google' : /^grok/i.test(m || '') ? 'xAI' : 'Other';
const priceFor = (m) => (PRICE.models || {})[m] || null;
function effortStatus(records, reported) {
  const rec = (records || []).filter(Boolean).map(x => String(x).toLowerCase()); const counts = rec.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {});
  const desc = Object.entries(counts).map(([k, v]) => k + ' ' + v + '/' + rec.length).join(', ');
  if (!rec.length) return { reported, recorded: 'not recorded', status: 'user-reported only' };
  if (!reported) return { reported: null, recorded: desc, status: 'recorded (no reported setting to compare)' };
  const ok = rec.every(x => x === String(reported).toLowerCase());
  return { reported, recorded: desc, status: ok ? 'metadata-verified' : 'contradicted' };
}
const runs = {};
for (const [id, folder] of Object.entries(anon.assign)) {
  const sc = frozen.scores[id]; if (!sc) { console.error('no frozen score for ' + id); continue; }
  const s = SS[folder] || { unattributed: true }; const a = ART[folder] || {}; const N = (NOTES.runs || {})[id] || {};
  const kind = s.kind || 'unattributed'; const modelId = s.model || N.modelId || null;
  let tok = null, cost = { billed: null, billedNote: N.billedNote || 'No bill available for this session.', client: null, apiFull: null, apiScored: null, lowerBound: null, formula: null, pricing: null, components: {}, post: null, note: null, quota: s.rateLimit ? 'Plan ' + (s.rateLimit.plan_type || '?') + '; account limit read ' + (s.rateLimit.first && s.rateLimit.first.used_percent) + '% at start and ' + (s.rateLimit.last && s.rateLimit.last.used_percent) + '% at end (not attributable when sessions overlap).' : 'Not recorded.' };
  let lat = {}, req = {}, tools = {};
  if (kind === 'codex') {
    const t = s.tokens, I = t.input, C = t.cachedInput, O = t.output, R = t.reasoning;
    tok = { I, uncached: I - C, cacheRead: C, cacheWrite: t.cacheWrite, O, R, N: O - R, T: I + O, semantics: 'verified', accounting: 'Codex token_usage_record per response, deduplicated by response_id; input includes cached input; output includes reasoning. Matches the final cumulative counter.', subagent: t.subagent };
    const p = priceFor(modelId);
    if (p && (!p.longContextThreshold || s.maxRequestInput <= p.longContextThreshold)) { const v = ((I - C) * p.input + C * (p.cachedInput ?? p.input) + O * p.output) / 1e6; cost.apiFull = cost.apiScored = r2(v, 4); cost.formula = '(' + (I - C) + ' uncached × $' + p.input + ' + ' + C + ' cached × $' + (p.cachedInput ?? p.input) + ' + ' + O + ' output × $' + p.output + ') / 1e6'; cost.components = { uncachedInput: r2((I - C) * p.input / 1e6, 4), cachedInput: r2(C * (p.cachedInput ?? p.input) / 1e6, 4), output: r2(O * p.output / 1e6, 4) }; cost.pricing = p.source + ' (' + (p.tier || 'standard') + ', ' + (p.date || '?') + ')'; }
    else cost.note = p ? 'A request exceeded the long-context threshold (' + p.longContextThreshold + '); compute with long-context prices.' : 'No official price recorded for ' + modelId + ' in pricing.json.';
    cost.billedNote = s.rateLimit && s.rateLimit.plan_type ? 'Subscription (' + s.rateLimit.plan_type + '); no per-session bill.' : cost.billedNote;
    lat = { ttft: s.providerReported && s.providerReported.time_to_first_token_ms != null ? { ms: s.providerReported.time_to_first_token_ms, group: 'codex', def: 'Codex client time_to_first_token_ms for the task turn (first-token content type not recorded)' } : null, perRequest: null, perRequestNote: 'Codex records TTFT per turn only.', firstVisibleSec: r2(s.firstVisibleResponseSec, 1), firstVisibleDef: 'first non-reasoning AgentMessage item completion', firstWriteSec: r2(s.firstArtifactWriteSec, 1), modelApiSec: null, toolSec: s.toolTimeSec, toolSecDef: 'sum of command and MCP durations (may overlap)' };
    req = { modelRequests: s.requests.total, bySession: s.requests.bySession }; tools = { modelLevel: s.modelToolCalls, inner: s.innerToolCalls.commands + s.innerToolCalls.mcp, failed: s.failedInnerToolCalls, failedDef: 'commands with non-zero exit or MCP calls not completed', deliverableWrites: s.deliverableWriteCalls };
  } else if (kind === 'claude') {
    const t = s.tokens, ts = s.tokensScoredAttempt, I = t.inputUncached + t.cacheWrite + t.cacheRead, O = t.output, R = t.reasoning;
    tok = { I, uncached: t.inputUncached, cacheRead: t.cacheRead, cacheWrite: t.cacheWrite, O, R, N: O - R, T: I + O, semantics: 'verified', accounting: 'Claude Code per-message usage deduplicated by message.id; input = input + cache creation + cache read; thinking tokens are a subset of output.' };
    const cs = s.providerReported && s.providerReported.costState; const p = priceFor(modelId);
    if (cs) { cost.client = r2(cs.totalCostUSD, 4); cost.clientNote = 'Claude Code cost-state for the whole session (includes auxiliary and post-delivery requests).'; }
    if (p) { const w = p.cacheWrite1h ?? p.cacheWrite ?? p.input * 2; const sc = (ts.inputUncached * p.input + ts.cacheWrite * w + ts.cacheRead * (p.cacheRead ?? p.input) + ts.output * p.output) / 1e6;
      let aux = 0, full = 0, fullOk = !!cs; if (cs) for (const [m, u] of Object.entries(cs.modelUsage || {})) { const q = priceFor(m); if (!q) { full += u.costUSD || 0; if (m !== modelId) aux += u.costUSD || 0; continue; } const c = (u.inputTokens * q.input + (u.cacheCreationEphemeral1hInputTokens || 0) * (q.cacheWrite1h ?? q.input * 2) + (u.cacheCreationEphemeral5mInputTokens || 0) * (q.cacheWrite5m ?? q.input * 1.25) + (u.cacheReadInputTokens || 0) * (q.cacheRead ?? q.input) + u.outputTokens * q.output) / 1e6; full += c; if (m !== modelId) aux += c; }
      cost.apiScored = r2(sc + aux, 4); cost.apiFull = fullOk ? r2(full, 4) : null; cost.post = fullOk ? r2(full - sc - aux, 4) : null;
      cost.formula = 'scored = (' + ts.inputUncached + ' input × $' + p.input + ' + ' + ts.cacheWrite + ' cache write × $' + w + ' + ' + ts.cacheRead + ' cache read × $' + (p.cacheRead ?? p.input) + ' + ' + ts.output + ' output × $' + p.output + ') / 1e6 + auxiliary models $' + r2(aux, 5);
      cost.components = { uncachedInput: r2(ts.inputUncached * p.input / 1e6, 4), cacheWrite: r2(ts.cacheWrite * w / 1e6, 4), cacheRead: r2(ts.cacheRead * (p.cacheRead ?? p.input) / 1e6, 4), output: r2(ts.output * p.output / 1e6, 4), auxiliary: r2(aux, 5) }; cost.pricing = p.source + ' (' + (p.tier || 'standard') + ', ' + (p.date || '?') + ')'; }
    else cost.note = 'No official price recorded for ' + modelId + ' in pricing.json.';
    if (s.auth && /oauth/.test(s.auth)) cost.billedNote = 'Subscription login (OAuth); no per-session bill.';
    lat = { ttft: null, ttftNote: 'Not recorded: the transcript holds request dispatch and completed blocks only.', perRequest: null, firstVisibleSec: r2(s.firstVisibleResponseSec, 1), firstVisibleDef: 'first non-empty text block (block completion, an upper bound)', firstWriteSec: r2(s.firstArtifactWriteSec, 1), modelApiSec: cs ? r2(cs.totalAPIDuration / 1000, 1) : null, modelApiDef: 'cost-state totalAPIDuration (whole session)', toolSec: cs ? r2(cs.totalToolDuration / 1000, 1) : null, toolSecDef: 'cost-state totalToolDuration' };
    req = { modelRequests: s.requests.total, auxiliary: cs ? Object.keys(cs.modelUsage || {}).filter(m => m !== modelId).join(', ') || null : null }; tools = { modelLevel: s.modelToolCalls, inner: s.innerToolCalls, failed: s.failedToolResults, failedDef: 'tool results marked is_error', deliverableWrites: s.deliverableWriteCalls };
  } else if (kind === 'agy') {
    const t = s.tokens, I = t.input, O = t.output, R = t.reasoning;
    tok = { I, uncached: null, cacheRead: null, cacheWrite: null, O, R, N: t.nonReasoning, T: I + O, semantics: 'unverified: recorded input per request is far below the context meter (likely a delta); I and T undercount public-API input', accounting: 'Antigravity gen_metadata per request; output = thinking + response verified on every row; no cache fields.' };
    const p = priceFor(modelId); if (p) { cost.lowerBound = r2((I * p.input + O * p.output) / 1e6, 4); cost.formula = '(' + I + ' recorded input × $' + p.input + ' + ' + O + ' output × $' + p.output + ') / 1e6 — partial lower bound'; cost.components = { recordedInput: r2(I * p.input / 1e6, 4), output: r2(O * p.output / 1e6, 4) }; cost.pricing = p.source + ' (' + (p.tier || 'standard') + ', ' + (p.date || '?') + ')'; }
    cost.note = 'Total N/A: public-API input charges cannot be reconstructed (input semantics unverified, cache reads unreported, harness monitor calls unrecorded).'; cost.billedNote = 'Consumer Google login; no per-session bill.';
    const pr = s.perRequestToFirstChunkSec;
    lat = { ttft: s.initialRequestToFirstChunkSec != null ? { ms: Math.round(s.initialRequestToFirstChunkSec * 1000), group: 'agy', def: 'Antigravity request-step creation to first streamed chunk (first-chunk content type not recorded)' } : null, perRequest: pr ? { n: pr.n, median_ms: Math.round(pr.median * 1000), p95_ms: Math.round(pr.p95 * 1000), coverage: pr.n + '/' + s.requests.total } : null, firstVisibleSec: r2(s.firstVisibleResponseSec, 1), firstVisibleDef: 'first planner step with visible (non-thinking) text', firstWriteSec: r2(s.firstArtifactWriteSec, 1), modelApiSec: s.aggregateRequestSec, modelApiDef: 'sum of per-request to-first-chunk + streaming durations' };
    req = { modelRequests: s.requests.total, auxiliary: 'harness safety monitor (Flash-Lite tier) without recorded usage' }; tools = { modelLevel: s.modelToolCalls, inner: null, failed: (s.toolStatus['6'] || 0) + (s.toolStatus['7'] || 0), failedDef: 'tool steps with status 6/7 (inferred error/cancelled)', deliverableWrites: s.deliverableWriteCalls };
  } else { cost.note = 'Unattributed: no originating session found.'; lat = { ttft: null, ttftNote: 'No session record.' }; }
  if (tok) { tok.ro = pct(tok.R, tok.O); tok.rall = pct(tok.R, tok.T); tok.cacheShare = tok.cacheRead == null ? null : pct(tok.cacheRead, tok.I); }
  const P = PERF[id] || {}; const trials = Object.keys(P).sort().map(k => ({ trial: +k.replace('trial', ''), ...P[k] }));
  const perf = trials.length ? { trials: trials.map(t => ({ trial: t.trial, fps: t.fps, p95IntervalMs: t.p95IntervalMs, pctOver33ms: t.pctOver33ms, maxIntervalMs: t.maxIntervalMs, canvasBuffer: t.canvasBufferEnd, drawFramesPct: t.appDrawFramesPct, pointsPerFrame: t.maxPointsDrawnPerFrame })), median: { fps: median(trials.map(t => t.fps)), p95IntervalMs: median(trials.map(t => t.p95IntervalMs)), pctOver33ms: median(trials.map(t => t.pctOver33ms)) } } : null;
  const rt = RT[id]; let stab = null; if (rt) for (const ph of Object.values(rt.phases)) for (const [k, m] of Object.entries(ph.monitors || {})) if (!stab) stab = { as: k, fps: m.fps, p95: m.p95IntervalMs, max: m.maxIntervalMs, over50: m.over50ms };
  const errs = rt ? Object.values(rt.phases).reduce((s2, p) => s2 + p.log.pageErrors.length + p.log.consoleErrors.length + p.log.failed.length, 0) : null;
  runs[id] = { id, folder, model: N.display || modelId || folder, vendor: N.vendor || vendorOf(modelId, kind), modelId, kind, harness: s.harness ? s.harness + ' ' + (s.harnessVersion || '') : null, tier: s.serviceTier || null, auth: s.auth || (s.rateLimit && s.rateLimit.plan_type ? 'subscription (' + s.rateLimit.plan_type + ')' : null),
    sessions: s.sessions || [], excluded: (s.excludedSessions || []).map(e => ({ id: e.session, model: e.model, note: e.turns + ' turn(s), ' + e.aborted + ' aborted, ' + e.toolCalls + ' tool calls' })), subagents: s.subagents || [],
    effort: effortStatus(s.effortRecords, meta.reportedEffort), mixed: N.mixedNote || ((s.subagents || []).length ? 'Includes subagent usage: ' + s.subagents.map(x => x.models.join('/')).join(', ') : 'Single implementation model.'),
    start: tz(s.taskStart), end: tz(s.firstDelivery), startUtc: s.taskStart || null, endUtc: s.firstDelivery || null, elapsedSec: r2(s.elapsedSec, 1), elapsedMin: s.elapsedSec != null ? r2(s.elapsedSec / 60, 1) : null,
    latency: lat, requests: req, tools, tok, cost, throughput: tok && s.elapsedSec ? r2(tok.O / s.elapsedSec, 1) : null,
    delivery: { ...(s.delivery || {}), note: N.deliveryNote || null }, art: a, perf, stab, runtimeErrors: errs,
    highlights: N.runtimeHighlights || [], defects: N.defects || {}, findings: { strengths: N.strengths || [], findings: N.findings || [] }, key: N.keyFinding || '',
    quality: sc, craft: CRAFT && CRAFT.runs ? CRAFT.runs[id] || null : null };
}
const ids = Object.keys(runs).sort((x, y) => runs[y].quality.total - runs[x].quality.total || x.localeCompare(y, undefined, { numeric: true }));
const top = ids.length ? runs[ids[0]].quality.total : 0; let rank = 0, prev = null;
ids.forEach((id, i) => { const t = runs[id].quality.total; if (t !== prev) rank = i + 1; prev = t; runs[id].rank = rank; runs[id].tie = top - t <= 2 && ids.filter(j => top - runs[j].quality.total <= 2).length > 1; });
const sum = (f, list) => r2(list.reduce((s2, id) => s2 + (f(runs[id]) || 0), 0), 4);
const has = (f) => ids.filter(id => f(runs[id]) != null);
const totals = { billed: { value: null, coverage: has(r => r.cost.billed).length + ' of ' + ids.length + ' sessions' }, clientEstimate: { value: has(r => r.cost.client).length ? sum(r => r.cost.client, has(r => r.cost.client)) : null, coverage: has(r => r.cost.client).length + ' of ' + ids.length + ' sessions' }, apiEquivalentFull: { value: has(r => r.cost.apiFull).length ? sum(r => r.cost.apiFull, has(r => r.cost.apiFull)) : null, coverage: has(r => r.cost.apiFull).length + ' of ' + ids.length + ' sessions' }, apiEquivalentScored: { value: has(r => r.cost.apiScored).length ? sum(r => r.cost.apiScored, has(r => r.cost.apiScored)) : null, coverage: has(r => r.cost.apiScored).length + ' of ' + ids.length + ' sessions' }, lowerBound: { value: has(r => r.cost.lowerBound).length ? sum(r => r.cost.lowerBound, has(r => r.cost.lowerBound)) : null, coverage: has(r => r.cost.lowerBound).length + ' of ' + ids.length + ' sessions' } };
const subs = inv.submissions; const expected = NOTES.expectedModels || [];
const metrics = { schema: 'modelbench/1', generatedUtc: new Date().toISOString(), meta, environment: ENV, inventory: { root: inv.root, expected: expected.length || subs.length, discovered: subs.length, evaluated: ids.filter(id => runs[id].quality.status === 'evaluated').length, blocked: ids.filter(id => /block/i.test(runs[id].quality.status)).length, dnf: ids.filter(id => /dnf/i.test(runs[id].quality.status)).length, missing: NOTES.missingModels || [], additional: NOTES.additionalModels || [], excluded: inv.excluded, firstDeliveryPolicy: NOTES.firstDeliveryPolicy || null },
  scoresFrozen: { file: 'evidence/scores-frozen.json', sha256: (fs.readFileSync(path.join(OUT, 'evidence', 'scores-frozen.sha256'), 'utf8').split(' ')[0]), frozenAtUtc: frozen.frozenAtUtc, note: frozen.note }, rubric: frozen.rubric, totals, order: ids, runs, craft: CRAFT, notes: { confounders: NOTES.confounders || [], limitations: NOTES.limitations || [], method: NOTES.method || [], views: NOTES.views || [], showcaseView: NOTES.showcaseView || 'default' } };
writeJson(path.join(OUT, 'metrics.json'), metrics);
console.log(JSON.stringify({ ranked: ids.map(id => runs[id].rank + '. ' + id + ' ' + runs[id].model + ' ' + runs[id].quality.total + (runs[id].tie ? ' (tie)' : '')), totals, effort: Object.fromEntries(ids.map(id => [id, runs[id].effort.status])) }, null, 1));
