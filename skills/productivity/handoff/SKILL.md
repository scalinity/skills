---
name: handoff
description: Compact the current conversation into a structured handoff document for another agent to pick up. Pairs with /resume.
argument-hint: "What will the next session focus on?"
---

Write a handoff document so a fresh agent can resume this work without re-discovering context. The doc lives at `~/.claude/handoffs/` and is picked up by `/resume`.

## File location

- Directory: `~/.claude/handoffs/` (create if missing)
- Filename: `YYYY-MM-DD-HHMMSS_<slug>.md`
- `<slug>` is kebab-case derived from the focus line — ASCII only, lowercase, ≤40 chars
  - Example: focus "Add rate limiting to /auth/login" → slug `add-rate-limiting-to-auth-login`

## Document shape

YAML frontmatter (machine-readable, parsed by `/resume`) + markdown body (prose for the next agent).

### Frontmatter

```yaml
---
created_at: <ISO8601 with timezone, e.g. 2026-05-15T16:57:00-04:00>
project: <basename of working_dir, or git repo name if applicable>
working_dir: <absolute path; result of pwd>
focus: <one-line summary — user's argument if provided, else inferred from conversation>
status: open
git:                              # omit this entire block if not in a git repo
  branch: <git branch --show-current>
  head: <git rev-parse --short HEAD>
  dirty: [<paths from git status --porcelain; empty list if clean>]
  ahead_behind: "<ahead>/<behind>" # vs upstream; "n/a" if no upstream tracked
suggested_skills:
  - {name: <skill-name>, why: <one-line reason this skill helps the next session>}
related: [<absolute paths or URLs of load-bearing artifacts — PRDs, issues, designs>]
tags: [<short topic tags>]
---
```

Collect git state by running these in `working_dir` (skip the entire `git:` block silently if `git rev-parse --is-inside-work-tree` fails):
- `git branch --show-current`
- `git rev-parse --short HEAD`
- `git status --porcelain` (extract paths)
- `git rev-list --left-right --count @{u}...HEAD 2>/dev/null` (ahead/behind; `n/a` if it fails)

### Body (in this order)

- **Where we are** — 3–6 lines: what's done, what's in progress, what's blocked
- **Key context** — non-obvious facts, decisions, constraints. Reference PRDs/plans/ADRs/issues/commits/diffs by path or URL — do NOT duplicate their content
- **Tried and rejected** — approaches attempted that didn't work, with one-line reasons each. Prunes the search space for the next agent so they don't repeat dead ends
- **Open questions** — unresolved items, each tagged `[user]` (needs user input), `[technical]` (next agent should decide), or `[external]` (waiting on outside state)
- **Next concrete steps** — first 1–3 actions the next agent should take

Be terse. The next agent reads every word — make each one earn its place.

## Steps

1. `mkdir -p ~/.claude/handoffs`
2. Derive the slug from the focus; compute the timestamped path
3. Gather git state (or skip if not in a repo)
4. Write the doc with frontmatter + body
5. **Verify the write**: stat the file, confirm size > 200 bytes, re-read the first line and confirm it is `---`. If verification fails, retry once; if it still fails, report the failure honestly — do not claim success
6. Print the absolute path and tell the user they can run `/resume` in a new session to pick up
