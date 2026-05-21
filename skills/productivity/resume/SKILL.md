---
name: resume
description: Resume from a handoff document. Pairs with /handoff. Loads the most-relevant handoff from ~/.claude/handoffs/, runs a drift check against the recorded state, briefs the user, and waits for confirmation before acting.
argument-hint: "(optional) path to a specific handoff file"
---

Pick up where a previous session left off. Select the right handoff, detect what's changed since it was written, brief the user, and only proceed once they confirm.

## 1. Select the handoff

If the user passed a path argument, use that file. Otherwise:

1. List `~/.claude/handoffs/*.md` by mtime, newest first
2. For each, scan only its frontmatter (read just enough to extract `working_dir`)
3. Match against current `pwd` using this priority:
   - **Exact match** — frontmatter `working_dir` equals `pwd`
   - **Descendant match** — `pwd` is inside `working_dir`
   - **Ancestor match** — `working_dir` is inside `pwd`
4. Take the most recent file within the best match tier
5. If nothing matches the current directory, fall back to the most recent overall — and call this out in the briefing ("from a different project: `<recorded working_dir>`")

If `~/.claude/handoffs/` is empty or missing, tell the user — do not fabricate context. Stop here.

## 2. Self-loop guard

Check the selected handoff's mtime. If it's less than 60 seconds old, warn:

> "This handoff was written <N>s ago — looks like you may have just run `/handoff` in this session. Did you mean to resume an older one?"

Wait for their answer before proceeding.

## 3. Drift check

`cd` to the handoff's `working_dir`. If it no longer exists, surface that and stop — ask the user where to look.

Run these probes (best effort — skip individually if they fail):

- **Git HEAD** — `git rev-parse --short HEAD`. If different from frontmatter `git.head`, collect new commits with `git log --oneline <recorded_head>..HEAD`
- **Upstream** — try `git fetch --quiet` then `git rev-list --left-right --count @{u}...HEAD`. Skip if fetch fails or hangs
- **Dirty files** — `git status --porcelain`. Compare to recorded `git.dirty`:
  - Files dirty then, clean now → flag (could be progress or lost work)
  - Files dirty now that weren't before → flag
- **Related artifacts** — for each entry in `related`, check path exists (or that URL is well-formed; don't fetch)

Skip all git probes silently if the working dir isn't a git repo.

## 4. Briefing

Restate to the user in 3–6 lines:

- Which handoff you loaded — path + age (e.g. "2 hours ago", "3 days ago")
- Focus (verbatim from frontmatter)
- Drift summary — concrete: "Branch moved 4 commits since handoff" / "src/foo.ts no longer exists" / "No drift detected"
- First concrete next step from the doc
- Suggested skills you plan to invoke and why

Do NOT dump the handoff back at the user. Synthesise it.

If the handoff is more than 7 days old, flag that prominently — its assumptions may have rotted.

## 5. Wait for confirmation

Pause after the briefing. The user may want to address drift, pick a different handoff, or change direction. Do not execute the first step until they confirm.

## 6. Status update on confirm

Once the user confirms and you start work:

1. Update the handoff file's frontmatter: set `status: resumed` and add `resumed_at: <ISO8601 with timezone>`. Preserve every other field.
2. Invoke skills from `suggested_skills` (via the Skill tool) when their context becomes relevant — not all upfront.

## Edge cases

- **Frontmatter parse failure** — if YAML can't be parsed, treat the file as prose, brief the user from the body, and warn them the schema is malformed.
- **Multiple handoffs match current dir** — pick the most recent of the matches. Mention in the briefing how many other matching handoffs exist so the user knows the option to pass a specific path.
- **Handoff references a branch that no longer exists** — surface this in the drift summary; ask whether to check out the recorded HEAD sha directly or proceed on the current branch.
