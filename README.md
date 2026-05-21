# Skills

A small, opinionated set of Claude Code skills I built for myself and use every day. Each one fixes a specific friction in how I work with coding agents — session handoffs, multi-perspective code review, portfolio READMEs, research synthesis — without trying to own the whole development process.

These are small enough to fork and adapt. None of them require a particular model, framework, or plugin ecosystem. Take what's useful.

## Quickstart

Clone the repo and symlink or copy individual skills into your agent's skills directory:

```bash
git clone https://github.com/scalinity/skills.git ~/code/skills
ln -s ~/code/skills/skills/productivity/handoff ~/.claude/skills/handoff
ln -s ~/code/skills/skills/productivity/resume ~/.claude/skills/resume
```

Each skill is a self-contained directory with a `SKILL.md`. Drop it (or symlink it) into your agent's skill path and the slash-command becomes available.

## What's here

### Productivity

- **[`/handoff`](./skills/productivity/handoff/SKILL.md)** + **[`/resume`](./skills/productivity/resume/SKILL.md)** — compact a session into a structured handoff document, then pick it up in a new session with a drift check against the recorded git state. Paired by design.
- **[`/grill-me`](./skills/productivity/grill-me/SKILL.md)** — interview-style agent that walks every branch of a plan or design until you reach shared understanding. Tiny skill, outsized impact.

### Engineering

- **[`/review-2`](./skills/engineering/review-2/SKILL.md)** / **[`/review-5`](./skills/engineering/review-5/SKILL.md)** / **[`/review-orchestrator`](./skills/engineering/review-orchestrator/SKILL.md)** — multi-agent, read-only code review. Three sizes for three changeset scales (2, 5, or 10 parallel reviewers). Includes severity calibration, false-positive guards, reachability traces for critical findings, and corroboration tagging across agents.
- **[`/readme`](./skills/engineering/readme/SKILL.md)** — generate a portfolio-quality README from a project's specs, ADRs, and detected stack. Two-pass review against the codebase before committing.
- **[`/terminal-ui-design`](./skills/engineering/terminal-ui-design/SKILL.md)** — build distinctive, production-grade TUIs that avoid generic terminal aesthetics.

### Research

- **[`/last30days`](./skills/research/last30days/SKILL.md)** — synthesize the last 30 days of discussion on a topic across Reddit, X, and the web. Returns a copy-paste-ready prompt for whatever tool you're using.
- **[`/ref-docs`](./skills/research/ref-docs/SKILL.md)** — Ref-MCP-first documentation lookup with a sane fallback chain.

## Design principles

- **Small, composable, fork-able.** No skill assumes the others exist. Take one, ignore the rest.
- **No marketing voice.** Skills are operational documents, not pitches. If a sentence would fit in a launch tweet, it doesn't belong in a SKILL.md.
- **Pair where it matters.** `/handoff` without `/resume` is half a feature. Skills that share state ship together.
- **Drift over assumption.** When a skill records state, the consumer checks for drift before acting on it.
- **Concrete over hedged.** "Reviewed N files across the X feature with 2 specialist agents" beats "Conducted a thorough review." Numbers and specifics earn trust.

## License

MIT.
