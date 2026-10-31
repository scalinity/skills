# Record and reconciliation workflow

Use the current conversation and owned artifacts first. Passive status/result reads
may fill a concrete gap. Missing usage, model observation, native ingestion or
physical UI evidence stays unknown; do not start another task to manufacture it.

The historical CodexForge score is 64.5/100. Its source builds consumed hours, but
those costs were not measured NativePeers orchestration costs. Two initial review
attempts exhausted small native budgets; current source and PR state must be
checked before assuming the budget fix is installed. Task-scoped result lookup
already existed; its metadata was still verbose. Quiet close-out belongs to the
active issue #7 lane. Preserve these distinctions when diagnosing recurrence.

## Evaluation record

Create a UTF-8 JSON object with these fields:

```json
{
  "schema_version": 1,
  "rubric_version": "1.0",
  "evaluation_id": "np-eval-2026-11-01-project-session",
  "session_key": "stable-session-identifier-or-explicit-local-session-label",
  "evaluated_on": "2026-11-01",
  "recorded_at": "2026-11-01T18:00:00-05:00",
  "use_case": "The native work that actually occurred",
  "provenance": "observed_session",
  "observations": [
    {"id": "o1", "kind": "native_result", "claim": "A precise observation", "reference": "Owned task/result ID or local artifact path"}
  ],
  "scores": {
    "native_collaboration": {"score": null, "evidence": [], "rationale": "Not evaluated"},
    "isolation_recovery": {"score": null, "evidence": [], "rationale": "Not evaluated"},
    "delivery_lifecycle": {"score": null, "evidence": [], "rationale": "Not evaluated"},
    "agent_efficiency": {"score": null, "evidence": [], "rationale": "Not evaluated"},
    "productivity": {"score": null, "evidence": [], "rationale": "Not evaluated"},
    "workflow_fit": {"score": null, "evidence": [], "rationale": "Not evaluated"}
  },
  "failures": [],
  "metrics": {"setup_tool_calls": null, "result_bytes": null, "native_rounds": null, "orchestration_seconds": null},
  "issue_urls": [],
  "limitations": ["What this session did not observe"]
}
```

Use the actual current Eastern offset and timezone, including daylight-saving
changes; the sample date/offset is illustrative. A session key is for aggregation,
not a fabricated verified native UUID. Each scored row needs at least one actual
observation ID and a rationale. Observation kinds are `session_observation`,
`native_result`, `source_test`, `source_inspection`, or `historical_assessment`.
Native results remain attributed claims unless independently verified.

Each failure has `id`, `description`, `attribution` (`tool`, `agent`, `provider`,
or `external`), `resolved` (boolean), `evidence` (observation IDs), and optional
`issue_url`. Metrics are measured numbers or null. Avoid false precision.

Run `scripts/evaluate.py validate <record>` before `append` when useful. The script
checks structure, scores, references, date offsets and the complete-score boundary;
it cannot decide whether an observation is truthful. The evaluating agent owns
that judgment. The historical baseline preserves the original assessment without
pretending it was a prospective controlled test.

An explicit evaluation of a session with no NativePeers use is still saved, with
all criteria null and zero coverage; it contributes no score samples. Admission
alone without an outcome does not establish a lifecycle success or failure.
An observed failure can support a low criterion score even when the full positive
acceptance path was not run. Coverage means enough evidence to score each included
criterion, not that every full-score condition passed.

The shared store is `history/evaluations/`. Records are immutable and append-only.
Use a new evaluation ID for a changed judgment and retain the same session key.
Read the existing record before revising it. Carry forward unchanged observations
and scores only when their evidence remains valid, retaining their original
references. If a correction removes support, the partial revision deliberately
replaces the older complete score; keeping the unsupported score would inflate
the aggregate. A new revision must have a later recorded_at. Reuse the exact
prepared JSON file after a lost append response; regenerating its timestamp is
a different immutable record, not an identical retry.
The aggregate counts the latest revision per session, reports per-criterion sample
counts and complete-score coverage, and keeps all revisions visible. A short local
file lock prevents concurrent appends from losing an aggregate update. If a report
write is interrupted after the record is saved, run `scripts/evaluate.py aggregate`;
records remain the source of truth. Do not edit historical JSON to improve a trend.

## GitHub gaps

The primary repository is `scalinity/NativePeers`. Re-fetch relevant issues,
comments and PR state before filing or closing anything. Start from
`references/issues.json`; its statuses are dated observations. A source fix in an
open PR is not an installed fix, and an active issue owner should not receive a
duplicate implementation lane.

For a new issue, state the concrete use moment, exact observed failure, bounded
source/task references, user-visible target, meaningful acceptance checks,
dependencies, current ownership and affected rubric criteria. Reuse matching
issues, adding new evidence only when it changes the diagnosis or acceptance.
Before retrying an uncertain GitHub create/comment, search for the exact title or
evaluation marker so one evaluation does not create duplicates. Never paste full
transcripts, credentials or provider-home files into an issue.

Preserve the shared master as a local Git-backed bundle. An evaluation invocation
does not automatically commit or publish private session history. Symlinks make
new local records immediately visible to every installed harness. External
publication needs the session's actual authorization and selected nonsecret files.

## Report

Lead with overall score or NOT_EVALUATED plus coverage, then the criterion table,
comparison with prior complete evaluations, useful outcomes, attributed failures,
measured/unknown costs, issue links and highest-value next step. Name the exact
saved report. Do not claim net time savings without supporting measurements.
