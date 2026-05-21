---
name: readme
description: Generate a comprehensive, portfolio-quality README.md for a project by reading its spec/design docs, auto-detecting stack + scale metrics, then following the embedded portfolio README template at references/portfolio-readme-template.md. Does two accuracy-review passes against the actual codebase, then commits and pushes. Use this skill whenever the user asks to write, rewrite, generate, upgrade, overhaul, or "make" a README — especially showcase or portfolio READMEs. Triggers on phrases like "write a comprehensive README", "redo the README", "showcase README", "portfolio README", invocations of "/readme", or any request that says "read the specs and write a README". Also applies when the user mentions a repo going public and asks for a README refresh.
---

# README generator

Turns a project's internal spec / design / decision docs into a portfolio-quality README — the kind that works as the front door of a public repo, clearly communicates the engineering thesis, and makes the project legible to engineers skimming for technique and non-engineers skimming for what the thing does.

The structural reference is the portfolio template bundled with this skill:

```
references/portfolio-readme-template.md
```

It captures the section inventory, table density, and voice patterns the skill follows on every invocation. Read it before drafting; mirror its structure in the output.

---

## When to use

Trigger when any of these apply:

- User explicitly asks for a README (write / rewrite / redo / upgrade / comprehensive / portfolio-style).
- User mentions a repo is going public or being open-sourced and wants documentation.
- User invokes `/readme`.
- User says "read the specs and write a README" or equivalent.
- User asks for a portfolio-style or showcase README.

Do **not** trigger for: inline code comments, docstrings, short "add a usage note to README" one-liners, or CHANGELOG updates — those are edits, not rewrites.

---

## Workflow

### Phase 1 — Context gathering (run in parallel)

Fire these concurrently before drafting anything. Latency adds up; parallelism matters.

1. **Read the portfolio template.** Mandatory every run:

   ```
   references/portfolio-readme-template.md
   ```

   Keep it in context while drafting — section order, table density, bullet style, and voice all get mirrored from this template.

2. **Locate spec docs.** Search in this order and use whatever's present:
   - `Specs/`, `specs/`, `spec/`
   - `docs/`, `doc/`, `documentation/`
   - `ARCHITECTURE.md`, `DESIGN.md`, `SPEC.md` at repo root
   - `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.windsurf/rules/`
   - `docs/decisions/` for ADRs
   - `docs/runbooks/` for ops runbooks

   Read every doc that's present. If specs are huge (>25K tokens per Read tool cap), read the first 400–500 lines for motivation/architecture and grep-navigate the rest.

3. **Read the existing README.** Never overwrite blindly — preserve anything the existing README does well (setup instructions, demo walkthroughs, developer notes), and note what's missing that the new one should add.

4. **Auto-detect stack + scale metrics.** Run the helper:

   ```bash
   bash scripts/detect_scale.sh
   ```

   It emits a markdown-ready Project Scale table pre-populated with real counts: source files by language, tests, migrations, Edge Functions, ADRs, Core Data entities, runbooks, design tokens, git commits. Hand-tune the output — remove irrelevant rows, add domain-specific ones (e.g., "canonical ingredient catalog entries", "clinical distortion types").

5. **Read ADRs.** If `docs/decisions/*.md` exists, read the ones marked Accepted — they carry load-bearing architecture rationale that belongs in the Safety / Architecture / Technical Highlights sections.

### Phase 2 — Draft (single uninterrupted write)

Mirror the template's section inventory exactly. The sections, in order:

1. **Title + subtitle + badges** — badges chosen from detected stack via `shields.io`. Aim for ~6–8 badges. First line after title is a bold `### subtitle` in sentence case, not title case.
2. **Lead paragraph(s)** — 4–5 sentences naming the product, the user, the technical thesis, and the differentiating engineering choice, followed by a shorter second paragraph on positioning. This is the paragraph skimmers read. Don't waste it.
3. **Table of Contents** — linked anchors for every top-level `##` that follows. Aim for 9 entries ± 1.
4. **Motivation** — 2–3 paragraphs. First: the user pain / problem space. Second: the technical thesis — why *now* is the right time for this approach.
5. **Domain-specific systems section (the biggest)** — rename per domain, keep the template's density:
   - AI product → "AI Systems" or "AI & Machine Learning Systems"
   - Infra product → "Core Systems" / "Platform Capabilities"
   - Dev tool → "Capabilities" / "How It Works"

   Each subsystem gets: model/library, bullets on architecture choices, cost or performance numbers if available, failure mitigation. Aim for 5–10 subsystems.
6. **Foundations / Design principles** — only if the project has a coherent design-system or clinical/scientific foundation. Two-column table (framework → application).
7. **Safety & Correctness** — validators, injection defense, credential isolation, RLS, idempotency, rate limits, webhook verification, vendor posture. Rename to fit domain ("Security & Reliability" for infra, "Safety & Crisis Intervention" for safety-critical apps).
8. **Architecture** — ASCII/Unicode diagram + hybrid-data-ownership explanation + state-architecture notes + deploy workflow. Boxed components, three horizontal tiers, arrows labeled with protocols, short prose explaining each tier.
9. **Technical Highlights** — 10–18 punchy bullets. Each bullet names a specific engineering win with enough detail to show the reader *what* was done and *why* it matters.
10. **Tech Stack** — two-column table (Layer / Technology). Complete but not exhaustive. ~13 rows.
11. **Project Scale** — two-column table of real metrics from Phase 1 step 4. Numbers must be accurate — this is the section that gets fact-checked. ~14 rows.
12. **Development** — condensed setup. Prerequisites table + 3–4 shell blocks. Add only if the repo is meant to be cloned and run. Keep it brief — not a tutorial.
13. **Roadmap** — pull from spec's "deferred" / "v2 backlog" / `CLAUDE.md` §Deferred sections. Two-column table (Direction / Description). 5–8 rows.
14. **License** line — proprietary vs open, as applicable.
15. **Closing italic tagline** — one line, centered with `<p align="center"><em>...</em></p>`, that restates the thesis poetically.

**Voice rules:**
- Lead with the product thesis, then the technical substance. Skimmers aren't reading chronologically.
- Prefer concrete numbers over adjectives. "~$0.09 per voice session after pruning" beats "cost-optimized voice".
- Name the hard problem explicitly before explaining the solution. Every technical-highlight bullet should make the reader think "huh, that's non-obvious."
- No marketing fluff. No "revolutionary", "cutting-edge", "seamless", "best-in-class". This is an engineering document.
- Keep paragraphs to 3–5 sentences. Tables over prose when data is tabular.
- Use backticks for file paths, function names, type names, commands, env vars.
- Italic tagline at the bottom restates the thesis in one sentence.

### Phase 3 — Review twice

Don't skip. Each pass catches a different class of error.

**Pass 1 — Accuracy against the codebase.** Read the draft end to end and verify:

- Every file path, function name, type name, and command mentioned actually exists (spot-check with Grep).
- Every metric in the Project Scale table is derived from real counts (from `detect_scale.sh` output), not guessed.
- Every cost claim arithmetic actually adds up (re-do the math in the margin).
- Every architectural assertion matches the code — don't claim "actor isolation" if it's `@MainActor class`, don't claim "WebSocket" if it's SSE.
- Every ADR reference, learning pattern, or runbook mentioned actually exists in `docs/`.
- Claims sourced from memory patterns or past learnings are accurate to the current code state (code drifts; verify against the current file).

**Pass 2 — Scope + voice + template alignment.** Re-read to catch:

- Section inventory matches the template (same section count ± 1, same relative ordering, same table-vs-prose choices).
- Awkward trailing-clause sentences ("...a kill switch disables model preambles in favor of" — what?).
- Missing "why" — every engineering choice needs a one-clause rationale, otherwise it reads as flex.
- Contradictions between sections (opening para says $X, cost table says $Y).
- Overclaiming — soften "under 2.5 seconds" to "streams over ~2 seconds" if you're not sure.
- Redundant bullets between Technical Highlights and earlier sections — TH should be new details or terse re-statements.
- Badges that reference things not actually in the stack.
- Closing italic tagline is present and earns its place (one line, thesis-restating, centered).

Fix in-place via `Edit`. Don't rewrite the whole file unless the structure is broken.

### Phase 4 — Public-safe sanity scan

Before committing, even for a public repo, scan the new README for secret patterns:

```bash
grep -nE "AIzaSy[A-Za-z0-9_-]{33}|AQ\.[A-Za-z0-9_-]{40,}|sk-[a-zA-Z0-9]{40,}|ghp_[a-zA-Z0-9]{30,}|phc_[a-zA-Z0-9]{40,}|aws_secret|AKIA[0-9A-Z]{16}|BEGIN RSA PRIVATE|BEGIN OPENSSH|BEGIN PRIVATE KEY" README.md
```

Expected: zero matches. If anything hits, stop and surface to the user before committing.

### Phase 5 — Commit + push

Single commit, conventional format:

```
docs: rewrite README as comprehensive project showcase
```

Body: explain the section inventory, name the template followed, list the two-pass review findings that landed, end with metrics verified. Then `git push`. Don't create a branch unless the user asked for one — a docs commit direct to `main` is fine for solo / small-team repos. For larger repos, ask first.

---

## Auto-discovery patterns

### Project-scale metric detection

`scripts/detect_scale.sh` runs from the repo root and emits a markdown-ready table. It auto-counts:

- Swift / TS / JS / Python / Rust / Go source files (whichever are present)
- Feature modules (conventions: `Features/`, `<App>/Features/`)
- Core Data entities (from `.xcdatamodeld/*.xcdatamodel/contents`)
- Supabase migrations + Edge Functions + backend tests
- Generic SQL migrations (Prisma / `migrations/` / `db/migrations/`)
- iOS unit test files
- ADRs in `docs/decisions/`
- Runbooks in `docs/runbooks/`
- Design token files
- Total git commits

Missing directories are skipped silently. Hand-edit to add domain-specific metrics after running.

### Stack detection from config files

| Signal | Implies |
|---|---|
| `project.yml` + `*.xcconfig.example` | iOS, XcodeGen |
| `Package.swift` | Swift Package Manager |
| `package.json` with `"react"` | React |
| `package.json` with `"next"` | Next.js |
| `Cargo.toml` | Rust |
| `pyproject.toml` with `fastapi` | FastAPI |
| `supabase/config.toml` | Supabase backend |
| `.env.example` with `GEMINI_API_KEY` | Gemini AI |
| `.env.example` with `OPENAI_API_KEY` | OpenAI |
| `.env.example` with `ANTHROPIC_API_KEY` | Anthropic |
| `.env.example` with `REVENUECAT_*` | RevenueCat |
| `.env.example` with `POSTHOG_*` | PostHog |
| `NSPersistentCloudKitContainer` in code | Core Data + CloudKit |

---

## Improvements baked into the workflow

Things learned from prior runs that would have saved time or caught mistakes:

1. **Parallel context gathering.** Read the template and specs in the same turn, not sequentially. Saves 30–60 seconds on every invocation.
2. **Verify counts before putting them in the Project Scale table.** Don't estimate. Don't copy from an older README. Run `detect_scale.sh`.
3. **Two explicit review passes.** Pass 1 is accuracy-against-code; Pass 2 is voice + template alignment. Doing them together causes both to be done poorly.
4. **Secret-pattern scan before commit.** Even if the repo is already public, verify the README doesn't introduce a new leak via a runbook excerpt or config example.
5. **Preserve what the existing README did well.** Setup instructions, demo walkthroughs, deploy notes — move them into the Development section rather than discarding. The new README is a superset, not a replacement.
6. **Pull roadmap items from `CLAUDE.md` §Deferred and spec §Deferred rather than inventing.** The project already has a list of "what's coming"; don't make up a new one.
7. **Pull architecture decisions from `docs/decisions/`.** ADRs describe load-bearing choices with their rejected alternatives — gold for the Safety / Technical-Highlights sections.
8. **Cost-claim arithmetic must be shown in a code block and double-checked.** Readers will add up your math; beat them to it.
9. **Soften overclaims.** "Under Xs" without a benchmark is a red flag. Use "streams over ~Xs", "in N round-trips", "bounded at K tokens" — all verifiable.
10. **Commit message explains what was done and what was verified.** A future reader of `git log` should understand the review passes happened.
11. **Badge auto-generation from detected stack.** Don't hand-pick 8 badges and hope they're right; derive them from actual project signals.
12. **Closing italic tagline earns its place.** It restates the thesis in one sentence. If you can't distill the project that tightly, the README isn't done.
13. **Template is the single source of truth.** Don't reach for some other repo's structure mid-draft — pick a shape and stick to it for consistency across a portfolio.

---

## Files in this skill

- `SKILL.md` (this file) — workflow
- `references/portfolio-readme-template.md` — section inventory + voice patterns the skill follows
- `scripts/detect_scale.sh` — auto-count source files, tests, migrations, entities, ADRs for the Project Scale table
