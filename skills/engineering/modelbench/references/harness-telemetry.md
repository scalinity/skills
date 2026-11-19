# Harness telemetry

Where each coding harness stores the originating session, what its fields mean, and the traps found the hard way. `discover_sessions.cjs` and `session_stats.cjs` implement all of this; read the section for a harness when its numbers look wrong or a new harness appears.

## Contents
- Codex CLI
- Claude Code
- Antigravity CLI (Gemini)
- Grok and unknown harnesses
- Cross-harness traps

## Codex CLI

- **Where:** `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. Line 1 is `session_meta` with `cwd`, `cli_version`, `source` (`cli`, or `{subagent:{thread_spawn:{parent_thread_id,…}}}`).
- **Model and effort:** `turn_context.model`, `turn_context.effort`; `thread_settings_applied.thread_settings.service_tier`.
- **Usage:** `token_usage_record` per response with `response_id`, per-response `usage` and cumulative `thread_token_usage`. `input_tokens` includes `cached_input_tokens`; `output_tokens` includes `reasoning_output_tokens` (`last_usage_includes_reasoning: true`). Sum per-response usage deduplicated by `response_id`; check it against the final cumulative counter.
- **Timing:** `task_started` / `task_complete` (has `duration_ms` and the client's `time_to_first_token_ms` for the turn). `item_completed` items carry `started_at_ms`/`completed_at_ms` (AgentMessage = visible text, CommandExecution/McpToolCall have durations and exit codes). No per-request TTFT.
- **Subagents:** separate rollout files with `source.subagent` and `forked_from_id`; they may replay parent history, so dedupe by response ID.
- **False starts:** a session whose turns are all `turn_aborted` with no tool calls and no usage is an excluded attempt — check its model, which can differ from the real run.
- **Billing:** `rate_limits.plan_type` (e.g. `pro`) means subscription; `used_percent` is account-wide and usually not attributable.
- **Writes:** file edits happen inside `exec` code-mode calls; detect deliverable writes by matching the entry file name plus write verbs in the call input, and check against the file's birth time.

## Claude Code

- **Where:** `~/.claude/projects/<cwd with / space . replaced by ->/<session>.jsonl`; subagent transcripts under `<session>/subagents/`.
- **Usage:** each assistant content block is its own line repeating the message's `usage` — dedupe by `message.id`. `input_tokens` excludes `cache_creation_input_tokens` and `cache_read_input_tokens`, so I = all three. `output_tokens_details.thinking_tokens` is a subset of output.
- **Model and effort per request:** `api-request` records (`params.model`, `params.output_config.effort`, betas). An `oauth-…` beta means subscription login.
- **Effort override trap:** a skill whose frontmatter sets `effort:` (e.g. `effort: max`) changes every later request once invoked. Count efforts per request; never trust the configured level.
- **Timing:** the task prompt's timestamp starts the turn; `system` `turn_duration` ends it. Lines are written at block completion, so there is no first-token time — TTFT is N/A.
- **Cost:** `cost-state` holds the session's `totalCostUSD` (client estimate), `totalAPIDuration`, `totalToolDuration` and per-model usage — including auxiliary models (a Haiku title call) and post-delivery requests such as `away_summary`. The transcript's in-turn messages give the scored attempt; cost-state gives the full session.
- **Code mode:** `<synthetic>` assistant messages are tool calls made inside REPL scripts (zero usage); count them as inner tool calls.

## Antigravity CLI (Gemini)

- **Where:** `~/.gemini/antigravity-cli/conversations/<id>.db` (SQLite with WAL; copy before reading — `discover_sessions.cjs` does). Folder mapping: `cache/conversation_metadata.json` (`WorkspaceURIs`) and `cache/last_conversations.json`. Logs: `log/cli-*.log` (local time).
- **Format:** protobuf blobs; `decode_agy.mjs` dumps them. `gen_metadata` = one row per model request; usage at field 1.4, layout inferred from the wire format: f1 model enum, f2 input, f3 output, f9 thinking, f10 response (f9+f10=f3 on every row), f11 response ID (matches the log's `ResponseID`). 1.19 model ID, 1.21 label such as `Gemini 4 Neon (XHigh)` (the effort record), 1.20 key/values incl. `used_non_gemini_model`.
- **Timing:** 1.11 Duration = request step creation → first streamed chunk (verified to the millisecond against the log); 1.12 = streaming time. Steps: type 14 user input, 15 planner response (20.1 visible text, 20.3 thinking summary, 20.7 tool call), 132 tool call (status 3 done, 6 error, 7 cancelled — inferred).
- **Traps:** recorded input per request is far below the client's context meter (likely a delta or uncached remainder) and no cache fields exist, so public-API input cost cannot be reconstructed — report an output-plus-recorded-input lower bound only. Harness safety-monitor calls (Flash-Lite tier) appear in logs without usage. Consumer Google login means no bill.

## Grok and unknown harnesses

`~/.grok/sessions` and other stores: search them for the submission's absolute path, inspect the record shape, and write down the semantics before normalizing. `grok usage <session>` reports owned-turn tokens. If semantics cannot be established, report N/A with the reason; never guess.

## Cross-harness traps

- Different harnesses inject different instructions, skills and output styles; list them as confounders.
- The same effort label across vendors is not the same compute budget.
- Render-on-demand pages skip frames when idle; an in-page canvas probe then reads a cleared buffer, which fakes huge "jumps" — verify with composited screenshots instead.
