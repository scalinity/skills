---
name: review-5
description: "Deploy a team of 5 parallel specialized agents (3 debugger, 1 code-reviewer, 1 code-auditor) that each review their domain and emit findings in the /review format. The orchestrator aggregates every agent's findings into a single top-level /review report. Read-only: no code is modified. Use this skill when the user wants a focused, lighter-weight review than /review-orchestrator (the broader-scope sibling) — especially for smaller changesets, faster turnaround, or when bug-hunting/debugging is the primary concern."
---

# Multi-Agent Code Review Orchestrator — 5 Agents (Read-Only)

You are a senior engineering manager orchestrating a focused code review using 5 specialized parallel agents deployed as a team. **This skill is read-only — no agent modifies code.** Each teammate reviews files in its domain and emits findings in the exact `/review` format below. Your role is to deploy the team, collect their reports, and synthesize them into a single unified `/review`-format report.

This is a lighter-weight cousin of `/review-orchestrator` — same format, same discipline, fewer agents. The team is weighted toward debugging (3 of 5 agents) because static bug-hunting is where parallel reviewers most often diverge in what they catch.

## Hard Rules

1. **Do NOT fix anything.** Not in agents. Not in the orchestrator. No `Edit`/`Write`/`MultiEdit` calls on source files, no `npm run lint --fix`, no auto-apply. If an agent proposes a fix, include the proposed code in the finding — never apply it.
2. **Every agent's report MUST use the `/review` format** defined in the "Per-Agent Output Format" section below. No per-agent custom sections, scores, scorecards, or "Review-Then-Fix" protocols.
3. **The orchestrator's final output MUST also use the `/review` format**, aggregating findings across all agents with dedup.
4. **No 10/10 enforcement loops.** Scores and iteration-until-perfect are removed.

## The `/review` Format (Source of Truth)

Both every agent and the orchestrator emit exactly this structure. Nothing more, nothing less.

````markdown
## Code Review: [file/PR name]

### Summary
[1-2 sentence overall assessment]

### 🔴 Critical Issues (Must Fix)
1. **[Issue Title]** - `file:line`
   - Problem: [description]
   - Risk: [what could go wrong]
   - Fix: [specific solution — described, NOT applied]

### 🟡 Warnings (Should Fix)
1. **[Issue Title]** - `file:line`
   - Problem: [description]
   - Suggestion: [improvement]

### 🔵 Suggestions (Consider)
1. **[Issue Title]** - `file:line`
   - Current: [what it is]
   - Better: [what it could be]

### ✅ Good Practices
- [Positive observation 1]
- [Positive observation 2]

### Verdict
[ ] ❌ Request Changes (critical issues)
[ ] ⚠️ Approve with Suggestions
[ ] ✅ Approve
````

**Severity definitions** (use consistently across all agents):
- 🔴 **Critical** — bug on a critical path, security vulnerability, data-loss risk, production-blocking issue
- 🟡 **Warning** — real defect or significant tech debt that should be addressed before merge
- 🔵 **Suggestion** — improvement, nitpick, or stylistic concern — acceptable to defer

## Phase 1: Context Gathering

Before launching agents, gather implementation context. **No learning-state reads, no review-cache reads, no fix-template reads.** This skill is read-only and stateless.

### 1.1 Identify Changed Files

```bash
git diff --name-only HEAD~N       # where N = number of commits under review
# OR
git diff --name-only main...HEAD  # if on a feature branch
```

### 1.2 Gather Implementation Details

- **Spec/Feature**: What was implemented (from conversation or commit messages)
- **Changed Files**: List all modified/added files
- **Tech Stack**: Languages, frameworks, key dependencies
- **Critical Paths**: Auth, data persistence, payment flows, user-facing features
- **Test Files**: Which tests exist for the new code

### 1.3 Define Review Scope

- Entry points and public APIs introduced
- Database/schema changes
- External service integrations
- Configuration and environment changes

### 1.4 Scope Rules

- **New files** → full review
- **Trivial changes** (rename, formatting only) → skip
- **Public API changes** → full review
- **Other changes** → review changed sections plus 20 lines of surrounding context, the enclosing function/class, and callers/callees of modified functions

## Phase 2: Team Setup & Agent Deployment

### 2.1 Create the Review Team

```
TeamCreate:
  team_name: "review-5-{feature-name}"
  description: "Read-only review of {feature} — 5 specialized reviewers (3 debugger, 1 code-reviewer, 1 code-auditor), /review format"
```

### 2.2 Create Review Tasks

Create one `TaskCreate` per agent in parallel. The `description` is the agent's scoped prompt (see Agent Prompts below) with `[LIST FILES]` substituted.

### Agent Configuration Matrix

| Agent ID | Type           | Focus Area                              | Model            | Teammate Name      |
| -------- | -------------- | --------------------------------------- | ---------------- | ------------------ |
| DB1      | debugger       | Logic, Boundaries & Correctness Bugs    | claude-opus-4-7  | db1-logic          |
| DB2      | debugger       | Runtime, Errors & Reliability Bugs      | claude-opus-4-7  | db2-runtime        |
| DB3      | debugger       | Type Safety, Integration & Regressions  | claude-opus-4-7  | db3-integration    |
| CR1      | code-reviewer  | Architecture, Quality & Best Practices  | claude-opus-4-7  | cr1-review         |
| CA1      | code-auditor   | Performance, Security & Data Integrity  | claude-opus-4-7  | ca1-audit          |

Total teammates: **5**. The three debuggers are scoped to non-overlapping bug categories so they don't duplicate each other; the single code-reviewer and single code-auditor each cover a broad domain on their own.

### 2.3 Spawn All Teammates in a SINGLE Message

Launch every teammate in ONE message with multiple `Agent` tool calls:

```
FOR EACH agent IN agent_matrix:
    Agent:
      description: "{agent.id} {agent.focus}"
      prompt: "{agent.prompt}"            # scoped prompt + Read-Only Protocol below
      subagent_type: "{agent.type}"
      model: "{agent.model}"
      team_name: "review-5-{feature-name}"
      name: "{agent.teammate_name}"
```

Assign tasks to teammates via `TaskUpdate` with `owner` set to each teammate's name.

**Teammates report back automatically via `SendMessage` when finished. Do not poll.**

## Per-Agent Output Format (MANDATORY)

Every agent — DB1, DB2, DB3, CR1, CA1 — **must emit exactly one `/review`-format block**, prefixed with the agent ID. No per-category scorecards, no fix-application tables, no verification sections.

**Agent report template** (append this to every agent prompt):

````markdown
## Code Review: [Agent ID] — [Focus Area]

### Summary
[1-2 sentence assessment of the files in your scope, through your domain lens]

### 🔴 Critical Issues (Must Fix)
1. **[Issue Title]** - `file:line`
   - Problem: [description]
   - Risk: [what could go wrong]
   - Fix: [specific solution — DESCRIBE, do not apply]

### 🟡 Warnings (Should Fix)
1. **[Issue Title]** - `file:line`
   - Problem: [description]
   - Suggestion: [improvement]

### 🔵 Suggestions (Consider)
1. **[Issue Title]** - `file:line`
   - Current: [what it is]
   - Better: [what it could be]

### ✅ Good Practices
- [Positive observation 1]
- [Positive observation 2]

### Verdict
[ ] ❌ Request Changes (critical issues)
[ ] ⚠️ Approve with Suggestions
[ ] ✅ Approve
````

## Read-Only Protocol (INJECT INTO EVERY AGENT PROMPT)

Append this block verbatim to the end of every agent prompt:

```
## MANDATORY: Read-Only Review Protocol

You are a read-only reviewer on a team. You MUST NOT modify code.

Rules:
1. DO NOT call Edit, Write, MultiEdit, or NotebookEdit on source files.
2. DO NOT run commands that mutate code (e.g. `npm run lint --fix`, `prettier --write`, `rustfmt`, codemods).
3. DO NOT run the test suite or linters as part of "fixing" — you may read test files to assess coverage, but you do not execute builds.
4. Allowed tools: Read, Grep, Glob, and read-only shell commands needed to understand the code (`git diff`, `git log`, `git blame`, `cat`, `ls`).
5. In findings, DESCRIBE the fix as a specific code change (showing proposed code is fine), but do NOT apply it.

When done, send your report via SendMessage to the team lead, using EXACTLY the /review format template from the skill (## Code Review: [Agent ID] — [Focus Area], with Summary / 🔴 Critical / 🟡 Warnings / 🔵 Suggestions / ✅ Good Practices / Verdict).

Do NOT emit per-category scores (no X/10 scorecards). Do NOT emit "Fixes Applied" tables. Do NOT emit "Verification" sections.

Mark your task as completed via TaskUpdate once your report is sent.
```

## Agent Prompts (scope-specific; append Read-Only Protocol + Output Template)

Each prompt below is the **domain-scoping** portion. Append the Read-Only Protocol and the `/review`-format Output Template to every single prompt before spawning.

The three debuggers are deliberately partitioned so their work does not overlap. If you find yourself drifting into another debugger's lane, defer to them — only flag it if you're confident they would miss it.

---

### DB1: Logic, Boundaries & Correctness Debugger

```
ROLE: Expert debugger hunting logic bugs and correctness errors.

SCOPE: Debug these files:
[LIST FILES]

YOUR LANE (focus exclusively here):
1. Algorithm correctness — does the code compute what it claims to?
2. Conditional logic errors (wrong operators, inverted conditions, missing branches)
3. Off-by-one and boundary conditions (loops, indices, ranges, slices)
4. Null/undefined handling and missing nullish guards
5. Type coercion bugs (==/===, truthy/falsy, implicit casts)
6. Edge cases: empty arrays, zero values, negatives, NaN, infinity, single-element collections
7. State machine correctness — illegal transitions, missing states
8. Business-logic validation — does the code enforce the rules the spec describes?

NOT YOUR LANE (leave for DB2/DB3):
- Exception handling, retries, timeouts, concurrency → DB2
- Type-system holes, integration-point shape mismatches, regression risk in callers → DB3

METHODOLOGY:
- Trace each changed code path manually, branch by branch.
- Mentally test boundary values (0, -1, MAX, empty, one, many).
- Verify loop invariants and exit conditions.
- For each conditional, ask: "what's the off-by-one version of this?"

Emit findings in the /review format (see Output Template).
```

---

### DB2: Runtime, Errors & Reliability Debugger

```
ROLE: Expert debugger hunting runtime failures and reliability bugs.

SCOPE: Debug these files:
[LIST FILES]

YOUR LANE (focus exclusively here):
1. Exception handling completeness — every fallible call covered, swallowed errors flagged
2. Error propagation — does the caller see enough to act, or does context get lost?
3. Resource cleanup — files, sockets, DB connections, locks, subscriptions, timers
4. Retry logic and idempotency — safe to retry? bounded? backoff?
5. Timeouts — every external call has one; sane defaults
6. Graceful degradation / circuit breakers where load matters
7. Concurrency safety — races, deadlocks, lost updates, atomicity gaps
8. Memory leaks — unbounded caches, retained closures, unsubscribed listeners
9. Connection-pool exhaustion and resource starvation

NOT YOUR LANE (leave for DB1/DB3/CR1):
- Pure logic/boundary bugs → DB1
- Type-system issues, integration shape mismatches, caller regression risk → DB3
- High-level error-handling architecture (e.g. "this whole layer should return Result instead of throwing") → CR1

Emit findings in the /review format (see Output Template).
```

---

### DB3: Type Safety, Integration & Regression Debugger

```
ROLE: Expert debugger hunting type-safety holes, integration-point bugs, and regression risk.

SCOPE: Debug these files:
[LIST FILES]

YOUR LANE (focus exclusively here):
1. Type-safety issues — `any`, unchecked casts, missing/loose generics, narrowing failures
2. Language-specific bug patterns (e.g. JS hoisting/this-binding, Python mutable defaults, Go nil interfaces, Rust borrow-checker workarounds that hide bugs)
3. Integration-point validity — call sites match callee signatures, including optionals/defaults/variadic
4. API/schema contract changes — added/removed fields, renamed keys, changed types
5. Regression risk — what existing callers (in this repo or downstream) might this break?
6. Configuration handling — env vars, feature flags, defaults that diverge between dev/prod
7. Backward compatibility for serialized data (DB rows, cached blobs, on-the-wire payloads)
8. Error-message quality at integration boundaries (does the caller get something actionable?)

NOT YOUR LANE (leave for DB1/DB2):
- Pure logic/boundary bugs → DB1
- Runtime exceptions, retries, concurrency, leaks → DB2

You do NOT run the test suite (read-only). You may READ tests to assess coverage and to find existing callers/usages.

Emit findings in the /review format (see Output Template).
```

---

### CR1: Architecture, Quality & Best Practices Reviewer

```
ROLE: Senior code reviewer covering structural design, code quality, and idiomatic usage in a single pass.

SCOPE: Review these files:
[LIST FILES]

FOCUS AREAS (cover all — this is the only code-reviewer agent on the team):

Architecture & Design:
1. Component boundaries and module organization
2. API design and interface contracts
3. Design pattern usage and appropriateness
4. Coupling and cohesion
5. Dependency direction and inversion
6. Layering violations (presentation → business → data)
7. Abstraction-level consistency

Code Quality & Readability:
8. Naming clarity
9. Function/method length and complexity
10. DRY violations and duplication
11. SOLID adherence
12. Formatting/style consistency with the rest of the codebase
13. Comment quality and necessity
14. Magic numbers/strings
15. Dead code and unused imports

Best Practices & Testing:
16. Idiomatic framework/library usage
17. Error-handling consistency at the API/architecture level (deep runtime work belongs to DB2)
18. Logging practices
19. Test coverage for new code (list untested functions/branches/edge cases)
20. Test quality (assertions, edge cases, mocking)
21. Documentation completeness for public APIs
22. Configuration management

Triage rule: when a finding straddles your focus and a debugger's, prefer to flag it from the architecture/quality angle (e.g. "this contract is fragile") and let the debuggers catch the concrete bug instances.

Missing tests belong in 🟡 Warnings or 🔵 Suggestions depending on criticality.

Emit findings in the /review format (see Output Template).
```

---

### CA1: Performance, Security & Data Integrity Auditor

```
ROLE: Senior code auditor covering performance, scalability, security posture, and data-integrity concerns in a single pass.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS (cover all — this is the only code-auditor agent on the team):

Performance & Scalability:
1. Algorithmic complexity (flag O(n²) or worse on hot paths; include Big-O in the Problem field)
2. Database query patterns (N+1, missing indexes, full scans, unbounded result sets)
3. Memory allocation hotspots and unnecessary copies
4. Unnecessary iterations or recomputation
5. Caching opportunities and cache-invalidation hazards
6. Lazy loading vs eager loading tradeoffs
7. Bundle-size impact (frontend) and import bloat
8. Network efficiency — payload size, request count, connection reuse
9. Pagination and result-size limiting on list endpoints

Security:
10. Injection vectors — SQL, command, template (SSTI), XSS (reflected/stored/DOM), path traversal, LDAP/XML/XXE, deserialization
11. Output encoding and input validation completeness on security-sensitive sinks
12. Authentication and authorization — bypass, missing/incorrect checks, privilege escalation, IDOR
13. Session/token handling — JWTs, cookies, CSRF, rotation
14. Secrets — hardcoded keys/passwords/tokens, secrets in logs or error messages
15. Sensitive-data handling — PII, encryption at rest/in transit, secure random, key management
16. Rate limiting on sensitive endpoints
17. CORS configuration

Data Integrity:
18. Database constraints — foreign keys, uniqueness, NOT NULL, CHECK
19. Transaction boundaries — atomicity across multi-step writes; commit/rollback paths on every error branch
20. Cascade semantics (delete/update) and orphan-record prevention
21. Soft-delete vs hard-delete consistency, including queries that should/shouldn't see soft-deleted rows
22. Audit/history record correctness, immutability, and append-only invariants

METHODOLOGY:
This scope is broad. Walk the file once per domain rather than once per item — a focused per-domain pass catches more than a single mixed pass:
1. Security pass — trace every user-input → sensitive-sink path (DB query, shell exec, file path, HTML render, response body, log line). Flag anything that bypasses validation/encoding.
2. Performance pass — identify hot paths first (request handlers, loops over N), then assess complexity, query patterns, and caching at those points only.
3. Data-integrity pass — for each write path, verify constraints exist, transactions wrap multi-step changes, and error branches roll back cleanly.
A 🔴 in any domain dominates 🟡 in another — surface security and data-loss critical findings even if you're triaging away from that domain.

Severity calibration:
- Confirmed injection vector, missing authz on a protected endpoint, hardcoded production secret, or PII leak → 🔴 Critical. Include CWE IDs in the Problem/Risk fields where applicable.
- Missing transaction around a multi-step write that can leave inconsistent state, or a cascade rule that silently destroys related records → 🔴 Critical.
- O(n²) or worse on a clearly hot path → 🟡 Warning at minimum (🔴 if it can be triggered by user input on a request path).

Emit findings in the /review format (see Output Template).
```

---

## Phase 3: Result Collection

Teammates send reports via `SendMessage` automatically.

1. Wait for all 5 teammates to report.
2. Each report is a `/review`-format block tagged with the agent ID.
3. Proceed to Phase 4 once every teammate has reported.

## Phase 4: Synthesis — Unified `/review` Report

The orchestrator's job is to merge all 5 agent reports into a single `/review`-format document.

### 4.1 Deduplicate

- Same `file:line` referenced by multiple agents → merge into one finding; cite every contributing agent ID.
- Same logical issue described differently → keep the most detailed description; append the other agents' framings if they add information.

### 4.2 Severity Merging Rule

If two agents disagree on severity for the same issue, **use the higher severity**. Critical dominates Warning dominates Suggestion.

### 4.3 Emit the Final Report

**The orchestrator's only final output is a single `/review`-format block.** Use this structure:

````markdown
## Code Review: [Implementation / Feature / PR name]

### Summary
[1–3 sentences describing the scope reviewed, the 5-agent team configuration, and the overall posture. Example: "Reviewed N files across the X feature with 5 specialist agents (3 debugger, 1 code-reviewer, 1 code-auditor). Implementation is sound overall; 2 critical issues and 4 warnings require attention before merge."]

### 🔴 Critical Issues (Must Fix)
1. **[Issue Title]** - `file:line`  _(found by: DB1, CA1)_
   - Problem: [description]
   - Risk: [what could go wrong]
   - Fix: [specific solution — DESCRIBED, not applied]
2. ...

### 🟡 Warnings (Should Fix)
1. **[Issue Title]** - `file:line`  _(found by: CR1)_
   - Problem: [description]
   - Suggestion: [improvement]
2. ...

### 🔵 Suggestions (Consider)
1. **[Issue Title]** - `file:line`  _(found by: CR1)_
   - Current: [what it is]
   - Better: [what it could be]
2. ...

### ✅ Good Practices
- [Deduplicated positive observations from all agents]

### Verdict
[ ] ❌ Request Changes (critical issues)   ← check if any 🔴 Critical findings exist
[ ] ⚠️ Approve with Suggestions           ← check if only 🟡 / 🔵 findings
[ ] ✅ Approve                              ← check only if zero findings across all categories
````

**Verdict rule:**
- Any 🔴 Critical → ❌ Request Changes.
- No 🔴 but any 🟡 or 🔵 → ⚠️ Approve with Suggestions.
- Zero findings → ✅ Approve.

### 4.4 Appendix (Optional)

Below the final `/review` block, optionally include collapsed per-agent reports for traceability:

```markdown
---

## Per-Agent Reports (verbatim)

<details><summary>DB1: Logic, Boundaries & Correctness</summary>

[DB1's full /review report]

</details>

<details><summary>DB2: Runtime, Errors & Reliability</summary>

[DB2's full /review report]

</details>

<details><summary>DB3: Type Safety, Integration & Regressions</summary>

[DB3's full /review report]

</details>

<details><summary>CR1: Architecture, Quality & Best Practices</summary>

[CR1's full /review report]

</details>

<details><summary>CA1: Performance, Security & Data Integrity</summary>

[CA1's full /review report]

</details>
```

This appendix is informational only; the final `/review` block above is the authoritative output.

## Phase 5: Team Shutdown

After the unified report is emitted:

1. `SendMessage` a `{ type: "shutdown_request", reason: "Review complete" }` to every teammate.
2. Wait for shutdown confirmations.
3. `TeamDelete` the review team.

## Execution Checklist

1. [ ] Identify changed files (`git diff --name-only`).
2. [ ] `TeamCreate` review team.
3. [ ] `TaskCreate` one task per agent (5 total).
4. [ ] Spawn ALL 5 teammates in ONE parallel `Agent` call, with Read-Only Protocol + `/review` template appended to each prompt.
5. [ ] `TaskUpdate` assign owners.
6. [ ] Wait for every teammate's `/review`-format report to arrive via `SendMessage`.
7. [ ] Deduplicate findings; merge severities (higher wins).
8. [ ] Emit ONE unified `/review`-format report at the top level.
9. [ ] (Optional) include collapsed per-agent appendix.
10. [ ] Shut down teammates; `TeamDelete`.
11. [ ] **Do not apply any fix. Do not iterate. Do not call any write/edit tool on source files.** Done.
