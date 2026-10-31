---
name: np-eval
description: Evaluate NativePeers at session end with /np-eval, preserve comparable scores and evidence, aggregate shared results, and track actionable GitHub gaps.
---

# NativePeers session evaluation

Evaluate the session that just happened. Optimize useful work per unit of agent
and human effort; preserve the distinction between a tool failure and poor task
orchestration. Do not launch paid/native experiments just to fill missing scores.

Resolve this loaded skill directory to its real path. Every installed harness
uses the same writable master; scripts and history are relative to that directory.

When evaluation or orchestration efficiency is requested before useful work,
start [opt-in cost capture](references/capture.md) before preparation. Use it for
the actual review/coordination; preserve partial coverage and failed attempts.

1. Read [the rubric](references/rubric.json) and the latest
   [shared summary](history/summary.md). If a fresh source installation has no history,
   run `python3 scripts/evaluate.py aggregate` from this skill directory first. Use
   [the workflow](references/workflow.md) for record format, issue reconciliation
   and recovery. Read the historical report only when comparing its evidence.
2. Gather a bounded set of actual session observations: requested/observed models,
   native identities, profiles, budgets, completed/failed attempts, delivery states,
   interventions, result bytes, useful findings and integration outcomes. Reuse
   existing results; prefer task-scoped reads. Credentials and full native
   transcripts do not belong in the evaluation store.
3. Score only observed criteria with the fixed weights. Record evidence and
   rationale per score. Mark missing observations NOT_EVALUATED, keep coverage
   visible, and separate source tests from installed/native behavior. A complete
   100 requires every full-score anchor; a scoped perfect session is not a claim
   that all providers or harnesses passed.
4. Reconcile concrete gaps with live `scalinity/NativePeers` issues and comments.
   [The backlog](references/backlog.md) gives the runnable order and
   [the issue map](references/issues.json) is a starting snapshot, not current
   GitHub state. Link active work and extend an existing issue before creating a
   duplicate. An explicit `/np-eval` request includes saving the evaluation and
   filing evidence-backed gaps; evaluation does not authorize implementation,
   runtime changes, model substitution, or account/configuration changes.
5. Write a record using the workflow format, then run
   `python3 <skill>/scripts/evaluate.py append <record.json>`.
   This validates, preserves an immutable per-evaluation record, and regenerates
   reports and aggregates under the real master. Repeating an identical ID is
   idempotent; changed judgments use a new evaluation ID with the same session key.
6. Report score, coverage, comparison limits, strengths, failures, actionable issue
   links, and the shared report path. Name the highest-value next improvement.
   If this is the session's final response and the NativePeers skill is in use,
   finish its notification close-out immediately before that response.

Use `/np-eval` in harnesses that expose skill names as slash commands. In Codex,
`$np-eval` or `Use the np-eval skill` is also explicit invocation. A filesystem
installation check does not establish interactive invocation in every harness.

When changing this skill, run `python3 -m unittest discover -s <skill>/scripts -p
'test_*.py'` and the skill validator. For behavioural checks, use the isolated
[cases](references/forward-cases.json); simulated results stay out of real history.
