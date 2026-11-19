# Worked example: nine black holes

The run this skill was built from. Use it to calibrate how fine-grained a rubric and plan should be, not as a template to copy.

## The brief and the root

One shared prompt: an interactive Three.js black hole in a single `index.html` with gravitational lensing, a particle accretion disk with differential rotation, orbit and zoom, mass and speed sliders, pause, a responsive layout, CDN libraries only. Nine folders, one per model (Codex, Claude Code and Antigravity sessions), all started within half an hour.

## Requirement → criterion → check

| Requirement | Criterion | Plan steps |
|---|---|---|
| Starts cleanly | B1 | load; console, page errors, failed requests |
| Orbit and zoom | B2, A1 | 300 px drag; ±60 px drags for low angle and below the plane; 300 px high angle; 6 wheel steps in, 15 out; shots after each |
| Mass slider | B3, C4 | pause; `set` min/default/max with shots; `diff` default vs restored |
| Speed slider | B4 | `set` min and max; `probe` motion per second at each |
| Pause | B5, C3 | pause, 5 s, `diff` (expect 0); drag while paused; resume and probe for a time jump |
| Responsive | B6 | viewport 390×844, `layout` hit tests, shot, back to 1440×900 |
| Lensing | C1 | source read of the ray bending; crops of the sky beside the shadow at default and low angles |
| Differential rotation | C2 | top-down `snaps`, `domain/diffrot.cjs`, inner versus outer angular velocity |
| Performance | D1, D2 | three `perf_trial` runs |
| Code quality | E1–E3 | source review |

## Lessons that generalize

- **A skill can change effort.** A skill whose frontmatter sets `effort: max` overrode the session's xhigh in two Claude runs. Always compare recorded effort per request with the reported setting.
- **Render-on-demand pages fool the frame probe.** Two runs skipped frames when idle; the probe read blank buffers and reported false jumps. Screenshots and `diff` settled it.
- **Harness costs include more than the task.** Claude Code's session cost includes a title request on a small model and a summary after delivery; report full session and scored attempt separately.
- **Antigravity input tokens are not comparable.** Recorded input is far below the context size, so the cost is a lower bound only.
- **Look for false starts.** Two aborted Codex sessions with no tool calls preceded real runs in the same folders; one used the wrong model. They are excluded with a reason, not merged.
- **Subagents count.** One run spawned a critique subagent; its tokens belong to that run.
- **Chat output can differ from the file.** Some runs printed code that differed by a few characters from what they wrote. The file is graded; the difference is reported.
- **Saturated displays cannot rank performance.** All nine held 120 Hz on an M5 Pro; the report says so instead of ranking noise.
- **Intricate is not the same as maintainable.** The most ambitious code (CPU geodesic tables driving lensed particles) and the most elegant (one trajectory table in about 20 KB) both scored full marks on E, while the code-craft section separated them. That separation is why code craft is its own unscored lens.
