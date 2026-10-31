# Opt-in cost capture

Start before preparation for a useful workflow. Use a private ignored task-note
path; the ledger stores command arguments, so select nonsecret commands only.
Resolve this bundle to its real path and set `capture` to `scripts/capture.py`.

```sh
python3 "$capture" start /absolute/ignored/cost.jsonl --session VERIFIED_NATIVE_UUID --scope "Selected implementation review" --exclude "Unobserved thinking, billing and activity before this boundary"
python3 "$capture" run --phase preparation /absolute/ignored/cost.jsonl -- /Users/danny/.local/bin/npeer context-prepare --project /absolute/repo --base EXACT_BASE --path src/file.py --json
python3 "$capture" run --phase dispatch /absolute/ignored/cost.jsonl -- /Users/danny/.local/bin/npeer spawn --spec /absolute/review.json --json
python3 "$capture" run --phase wait /absolute/ignored/cost.jsonl -- /Users/danny/.local/bin/npeer wait EXACT_TASK_ID --timeout-ms 30000 --on-timeout retain --json
python3 "$capture" run --phase collection /absolute/ignored/cost.jsonl -- /Users/danny/.local/bin/npeer result EXACT_TASK_ID --compact --json
python3 "$capture" summary /absolute/ignored/cost.jsonl > /absolute/ignored/cost-summary.json
```

`run` executes a noninteractive command once with its original arguments,
environment and directory. It forwards its exact stdout/stderr and exit status;
output is buffered. Existing native ancestry/binding is preserved, not invented.
A recording failure after execution preserves the result and warns on stderr;
retain that result and record the measurement gap. Never replay to measure it.
Use the real native shell and verify `whoami` through the wrapper before dispatch.

Record integration commands too. Mark unrelated builds/parent mistakes with
`--excluded`, keeping their outcome visible without charging them as tool cost.
For example: `python3 "$capture" run --phase integration LEDGER --excluded -- COMMAND`.
Wrapper options are parsed before the required `--`; command arguments after it
are passed verbatim, even when they match wrapper option names.
Repeated reads remain separate commands. Record interventions with
`record LEDGER /absolute/event.json`, for example:

```json
{"kind":"intervention","phase":"collection","source":"task-note reference","description":"Read full report after compact preview omitted it","attribution":"agent","task_id":"EXACT_TASK_ID","duration_seconds":null}
```

For owned worker results, record one `worker` event per exact task/attempt, preserving
group/request IDs, `completion_phase` and `attempt_index` from the owned result.
The compact view calls the phase `phase`; copy it as `completion_phase`.
`attempt_index` is required, including 0 for the first attempt, so an incomplete
identity cannot be counted and later counted again when its index is added. Follow-ups
have distinct task IDs; fallback attempts can share a task. Supply `offset_seconds` (result start
epoch minus ledger `wall_start`), `duration_seconds`, `native_rounds` and the exact
result reference. Unknown timings/counts are null. Identical task/attempt imports are idempotent; conflicting
measurements are refused. Do not import native transcripts or provider homes.
Explicit observed parent-effort intervals use `kind:effort`; without them parent
effort stays null. Source IDs can be additional JSON fields.

The summary's numeric `metrics` can populate an evaluation record. Its limitations
must travel with those values: orchestration seconds measure recorded non-wait
CLI intervals only, never total parent thinking/work. Worker sum, worker interval
union, wait interval union and observation-window elapsed are separate seconds;
overlaps are not added. The observation window ends at the last recorded interval
end, including excluded activity; untimed manual events do not extend it. Summary
generation time is reported separately, so rebuilding a summary preserves its
measured window. Result bytes are stdout plus stderr, not tokens, billing, wire
traffic or MCP bytes. An MCP-only workflow uses explicit observed events with
source/coverage and nullable values; CLI coverage never establishes MCP success.
Keep the summary/events as the observation reference and validate the evaluation
with `evaluate.py validate` before the normal immutable append.
