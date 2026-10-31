# NativePeers improvement backlog

Snapshot: 2026-10-30. Fetch live bodies, comments, PRs and ownership before implementation.

| Order | Issue | Intended result |
|---|---|---|
|1|[#3](https://github.com/scalinity/NativePeers/issues/3), existing [PR #5](https://github.com/scalinity/NativePeers/pull/5)|Integrate the existing separate logical/native/wall budget fix and qualify installed behavior.|
|Dependency|[#7](https://github.com/scalinity/NativePeers/issues/7), active owner|Consume its installed quiet-close result; avoid a duplicate implementation.|
|2|[#10](https://github.com/scalinity/NativePeers/issues/10)|Compact task-oriented preflight reusing existing readiness and limits.|
|3|[#11](https://github.com/scalinity/NativePeers/issues/11)|Exact small review packet without broad shell grants.|
|4|[#12](https://github.com/scalinity/NativePeers/issues/12)|Compact selected-task results; actionable handle errors.|
|5|[#13](https://github.com/scalinity/NativePeers/issues/13)|Actual failure reason and phase context while preserving failed attempts.|
|6|[#14](https://github.com/scalinity/NativePeers/issues/14)|Bounded source/runtime handoff using existing peer primitives.|
|7|[#16](https://github.com/scalinity/NativePeers/issues/16)|Observed end-to-end session and honest final evaluation; close only after children and dependency acceptance.|

The tracker carries the runnable order, fixed weights and full-score acceptance.
The budget implementation already exists in an open PR; an installed failure does
not establish that its new design failed. Verify source and installed snapshots.

The original defects, evidence and recommendations are preserved in the historical
evaluation/report and linked issues. Record future observations separately; keep
the original assessment immutable.
