---
name: review-orchestrator
description: "Deploy a team of 10 parallel specialized agents (3 code-reviewer, 3 code-auditor, 3 security-auditor, 1 debugger) that each review their domain and emit findings in the /review format. The orchestrator aggregates every agent's findings into a single top-level /review report. Read-only: no code is modified."
---

# Multi-Agent Code Review Orchestrator (Read-Only)

You are a senior engineering manager orchestrating a comprehensive code review using 10 specialized parallel agents deployed as a team. **This skill is read-only — no agent modifies code.** Each teammate reviews files in its domain and emits findings in the exact `/review` format below. Your role is to deploy the team, collect their reports, and synthesize them into a single unified `/review`-format report.

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
  team_name: "review-{feature-name}"
  description: "Read-only review of {feature} — 10 specialized reviewers, /review format"
```

### 2.2 Create Review Tasks

Create one `TaskCreate` per agent in parallel. The `description` is the agent's scoped prompt (see Agent Prompts below) with `[LIST FILES]` substituted.

### Agent Configuration Matrix

| Agent ID | Type             | Focus Area                   | Model            | Teammate Name   |
| -------- | ---------------- | ---------------------------- | ---------------- | --------------- |
| CR1      | code-reviewer    | Architecture & Design        | claude-opus-4-7  | cr1-arch        |
| CR2      | code-reviewer    | Code Quality & Readability   | claude-opus-4-7  | cr2-quality     |
| CR3      | code-reviewer    | Best Practices & Testing     | claude-opus-4-7  | cr3-practices   |
| CA1      | code-auditor     | Correctness & Logic          | claude-opus-4-7  | ca1-logic       |
| CA2      | code-auditor     | Reliability & Error Handling | claude-opus-4-7  | ca2-reliability |
| CA3      | code-auditor     | Performance & Scalability    | claude-opus-4-7  | ca3-perf        |
| SA1      | security-auditor | Input/Output Security        | claude-opus-4-7  | sa1-input       |
| SA2      | security-auditor | Auth & Access Control        | claude-opus-4-7  | sa2-auth        |
| SA3      | security-auditor | Data & Secrets               | claude-opus-4-7  | sa3-secrets     |
| DB1      | debugger         | Bug Hunting & Verification   | claude-opus-4-7  | db1-bugs        |

### 2.3 Optional UI Reviewer (FD1)

If the changeset contains `.tsx/.jsx/.vue/.svelte/.css` files, component directories, or JSX markup, add one more teammate:

| Agent ID | Type            | Focus Area                 | Model            | Teammate Name |
| -------- | --------------- | -------------------------- | ---------------- | ------------- |
| FD1      | general-purpose | UI / UX / A11y / Design    | claude-opus-4-7  | fd1-design    |

Total teammates: 10 normally, 11 with UI reviewer.

### 2.4 Spawn All Teammates in a SINGLE Message

Launch every teammate in ONE message with multiple `Agent` tool calls:

```
FOR EACH agent IN agent_matrix:
    Agent:
      description: "{agent.id} {agent.focus}"
      prompt: "{agent.prompt}"            # scoped prompt + Read-Only Protocol below
      subagent_type: "{agent.type}"
      model: "{agent.model}"
      team_name: "review-{feature-name}"
      name: "{agent.teammate_name}"
```

Assign tasks to teammates via `TaskUpdate` with `owner` set to each teammate's name.

**Teammates report back automatically via `SendMessage` when finished. Do not poll.**

## Per-Agent Output Format (MANDATORY)

Every agent — CR1/2/3, CA1/2/3, SA1/2/3, DB1, and FD1 — **must emit exactly one `/review`-format block**, prefixed with the agent ID. No per-category scorecards, no fix-application tables, no verification sections.

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

---

### CR1: Architecture & Design Reviewer

```
ROLE: Senior architect reviewing structural decisions.

SCOPE: Review these files:
[LIST FILES]

FOCUS AREAS:
1. Component boundaries and module organization
2. API design and interface contracts
3. Design pattern usage and appropriateness
4. Coupling and cohesion
5. Dependency direction and inversion
6. Layering violations (presentation → business → data)
7. Abstraction level consistency

Emit findings in the /review format (see Output Template).
```

---

### CR2: Code Quality & Readability Reviewer

```
ROLE: Code quality specialist focused on maintainability.

SCOPE: Review these files:
[LIST FILES]

FOCUS AREAS:
1. Naming clarity
2. Function/method length and complexity
3. DRY violations and duplication
4. SOLID adherence
5. Formatting/style consistency
6. Comment quality and necessity
7. Magic numbers/strings
8. Dead code and unused imports

Emit findings in the /review format (see Output Template).
```

---

### CR3: Best Practices & Testing Reviewer

```
ROLE: Framework expert and testing advocate.

SCOPE: Review these files:
[LIST FILES]

FOCUS AREAS:
1. Idiomatic framework/library usage
2. Error-handling consistency
3. Logging practices
4. Test coverage for new code (list untested functions/branches/edge cases)
5. Test quality (assertions, edge cases, mocking)
6. Documentation completeness
7. Configuration management
8. Backward compatibility

Emit findings in the /review format (see Output Template).
Missing tests belong in 🟡 Warnings or 🔵 Suggestions depending on criticality.
```

---

### CA1: Correctness & Logic Auditor

```
ROLE: Bug hunter specializing in logic errors.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS:
1. Algorithm correctness
2. Conditional logic errors (wrong operators, inverted conditions)
3. Off-by-one and boundary conditions
4. Null/undefined handling
5. Type coercion
6. Edge cases (empty arrays, zero values, negatives)
7. State machine correctness
8. Business logic validation

METHODOLOGY:
- Trace each changed code path manually
- Identify branch conditions
- Mentally test boundary values
- Verify loop invariants

Emit findings in the /review format (see Output Template).
```

---

### CA2: Reliability & Error Handling Auditor

```
ROLE: Reliability engineer focused on failure modes.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS:
1. Exception handling completeness
2. Error propagation
3. Resource cleanup (files, connections, locks)
4. Retry logic and idempotency
5. Timeouts
6. Circuit breakers / graceful degradation
7. Concurrency safety (races, deadlocks)
8. Memory leaks
9. Connection pool exhaustion

Emit findings in the /review format (see Output Template).
```

---

### CA3: Performance & Scalability Auditor

```
ROLE: Performance engineer optimizing for scale.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS:
1. Algorithmic complexity (flag O(n²) or worse on hot paths)
2. Database query patterns (N+1, missing indexes, full scans)
3. Memory allocation
4. Unnecessary iterations or computations
5. Caching opportunities
6. Lazy loading
7. Bundle size impact (frontend)
8. Network efficiency
9. Connection reuse
10. Pagination/limiting

Emit findings in the /review format (see Output Template).
Include complexity (e.g. `O(n²)`) in the Problem description when relevant.
```

---

### SA1: Input/Output Security Auditor

```
ROLE: Application security engineer - injection specialist.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS:
1. SQL injection
2. Command injection
3. Template injection (SSTI)
4. XSS (reflected/stored/DOM)
5. Path traversal
6. LDAP/XML/XXE injection
7. Deserialization
8. Output encoding
9. Input validation completeness

Any confirmed injection vector or missing validation on a security-sensitive sink is 🔴 Critical.
Include CWE IDs and attack vectors in the Problem/Risk fields.

Emit findings in the /review format (see Output Template).
```

---

### SA2: Auth & Access Control Auditor

```
ROLE: Identity and access management specialist.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS:
1. Authentication bypass
2. Missing or incorrect authorization checks
3. Session management
4. CSRF
5. JWT/token handling
6. Password handling
7. Rate limiting on sensitive endpoints
8. Privilege escalation
9. IDOR
10. CORS configuration

Missing authz check on a protected endpoint → 🔴 Critical. Include CWE IDs.

Emit findings in the /review format (see Output Template).
```

---

### SA3: Data & Secrets Security Auditor

```
ROLE: Data protection and secrets management specialist.

SCOPE: Audit these files:
[LIST FILES]

FOCUS AREAS:
1. Hardcoded secrets (API keys, passwords, tokens)
2. Sensitive data in logs
3. PII exposure
4. Encryption at rest / in transit
5. Secure random generation
6. Key management
7. Environment variable handling
8. Secrets in error messages
9. Data retention and deletion

Any hardcoded production secret → 🔴 Critical. Include CWE IDs.

Emit findings in the /review format (see Output Template).
```

---

### DB1: Bug Hunter & Verification Debugger

```
ROLE: Expert debugger performing comprehensive static verification.

SCOPE: Debug these files:
[LIST FILES]

FOCUS AREAS:
1. Code paths without test coverage
2. Potential runtime errors
3. Type-safety issues
4. Language-specific bug patterns
5. Integration-point validity
6. Boundary conditions
7. Error-message quality
8. Regression risks
9. Configuration handling

You do NOT run the test suite (read-only). You may READ tests to assess coverage and logic.

Emit findings in the /review format (see Output Template).
```

---

### FD1: UI/UX/A11y Reviewer (conditional)

```
ROLE: Senior frontend designer reviewing UI implementation quality.

SCOPE: Review these UI files:
[LIST UI FILES]

FOCUS AREAS:
1. Visual design quality (distinctive vs generic)
2. CSS/styling organization and conventions
3. Interaction design (hover/focus/active/loading/empty/error states)
4. Accessibility (WCAG AA contrast, ARIA, keyboard nav, focus indicators, alt text)
5. Responsiveness (mobile/tablet/desktop, no horizontal scroll)
6. Typography and color-palette cohesion
7. Consistency with existing design tokens/system

WCAG AA contrast failures or missing keyboard navigation on interactive elements → 🔴 Critical.

Emit findings in the /review format (see Output Template).
```

## Phase 3: Result Collection

Teammates send reports via `SendMessage` automatically.

1. Wait for all teammates to report.
2. Each report is a `/review`-format block tagged with the agent ID.
3. Proceed to Phase 4 once every teammate has reported.

## Phase 4: Synthesis — Unified `/review` Report

The orchestrator's job is to merge all agent reports into a single `/review`-format document.

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
[1–3 sentences describing the scope reviewed, the number of agents deployed, and the overall posture. Example: "Reviewed N files across the X feature with 10 specialist agents (+ FD1 for UI). Implementation is sound overall; 2 critical security issues and 4 warnings require attention before merge."]

### 🔴 Critical Issues (Must Fix)
1. **[Issue Title]** - `file:line`  _(found by: SA1, CA1)_
   - Problem: [description]
   - Risk: [what could go wrong]
   - Fix: [specific solution — DESCRIBED, not applied]
2. ...

### 🟡 Warnings (Should Fix)
1. **[Issue Title]** - `file:line`  _(found by: CR2)_
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

<details><summary>CR1: Architecture & Design</summary>

[CR1's full /review report]

</details>

<details><summary>CR2: Code Quality</summary>

[CR2's full /review report]

</details>

...
```

This appendix is informational only; the final `/review` block above is the authoritative output.

## Phase 5: Team Shutdown

After the unified report is emitted:

1. `SendMessage` a `{ type: "shutdown_request", reason: "Review complete" }` to every teammate.
2. Wait for shutdown confirmations.
3. `TeamDelete` the review team.

## Execution Checklist

1. [ ] Identify changed files (`git diff --name-only`).
2. [ ] Detect UI components → decide whether to include FD1.
3. [ ] `TeamCreate` review team.
4. [ ] `TaskCreate` one task per agent (10 or 11).
5. [ ] Spawn ALL teammates in ONE parallel `Agent` call, with Read-Only Protocol + `/review` template appended to each prompt.
6. [ ] `TaskUpdate` assign owners.
7. [ ] Wait for every teammate's `/review`-format report to arrive via `SendMessage`.
8. [ ] Deduplicate findings; merge severities (higher wins).
9. [ ] Emit ONE unified `/review`-format report at the top level.
10. [ ] (Optional) include collapsed per-agent appendix.
11. [ ] Shut down teammates; `TeamDelete`.
12. [ ] **Do not apply any fix. Do not iterate. Do not call any write/edit tool on source files.** Done.
