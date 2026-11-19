# Runtime plans

`plan.json` turns each brief requirement into scripted browser actions that `run_plan.cjs` replays identically on every submission. Write the plan once, run it on one submission, look at the results, then run it on all.

## Contents
- Format
- Steps
- Timed and untimed phases
- Measurement traps
- Performance trials
- Looking at the evidence
- Projects that need a build
- Projects that are not web pages

## Format

```json
{
  "viewport": [1440, 900],
  "perf": { "warmupMs": 5000, "measureMs": 20000 },
  "submissions": { "S1": { "folder": "Opus 5.5", "entry": "index.html" }, "S2": { "folder": "app", "url": "http://127.0.0.1:5173/" } },
  "controls": { "S1": { "mass": "#mass", "pause": "button.pause" } },
  "phases": [ { "name": "func", "steps": [ { "wait": 4000 }, { "shot": "default" } ] },
              { "name": "timed", "timed": true, "steps": [ { "monitor": "start" }, { "drag": [720, 330, 300, 0] }, { "monitor": "stop", "as": "interaction" } ] } ]
}
```

A complete plan for a single-page 3D app is in [plan.example.json](../assets/plan.example.json).

- `submissions`: folder and entry under the served root, or `url` for a built copy served elsewhere on localhost.
- `controls`: per-submission aliases, so steps say `@mass` and each submission maps it to its own selector. Read the source (step 7) to fill these in; a missing control is a finding, not a plan error.
- Each phase starts from a fresh profile and a fresh page load, so phases never contaminate each other.

## Steps

Each step is an object whose first key is the operation.

| Step | Value | Options | Records |
|---|---|---|---|
| `wait` | ms | | |
| `shot` | name | | `shots/<ID>-<phase>-<name>.png` |
| `drag` | `[x, y, dx, dy]` | `steps` (12), `stepMs` (16) | |
| `wheel` | `[dx, dy]` | `times`, `interval` (40), `at` `[x, y]` | |
| `click` | `@alias` or CSS | | |
| `key` | Playwright key name | | |
| `set` | `[@alias, min\|max\|default\|number]` | | fires `input` and `change` |
| `viewport` | `[w, h]` | | |
| `mark` | name | | `performance.now()` |
| `probe` | `start\|stop` | `as`, `keepSeries` | motion per second, frame stats |
| `snaps` | `{count, interval}` | `as` | downsampled frames to a JSON file |
| `monitor` | `start\|stop` | `as` | FPS, p50/p95/p99/max interval, stalls over 33/50/100 ms, draw-frame share |
| `state` | `@alias` or CSS | `as` | text, value, aria-pressed, aria-label |
| `layout` | name | | every control's box, in-viewport, hit-testable; canvas sizes; overflow |
| `diff` | `[shotA, shotB]` | `crop` (fractions), `as` | mean pixel change, changed %, dark-pixel share |
| `note` | text | | copied into the result |

`set "default"` restores the value the page loaded with. Use it after every min/max so the next check starts clean, and `diff` the restored frame against the original to prove the control is reversible.

## Timed and untimed phases

Untimed phases inject the frame probe, which wraps `requestAnimationFrame` and samples the canvas after each app frame. That costs time, so timed phases (`"timed": true`) inject only the light rAF monitor and refuse `shot`, `probe` and `snaps`. Never measure performance in a phase that also captures evidence.

## Measurement traps

- **Render on demand.** A page that skips frames while nothing changes leaves the probe reading a cleared buffer, which looks like a jump to black. Check pause and resume on those pages with `diff` between screenshots instead, and say so in the evidence.
- **Pause checks.** Pause, `shot`, wait at least 5 s, `shot` again and `diff` (expect zero), then drag while paused (the camera should still move and settle), then resume and probe for a jump in accumulated time.
- **Sliders.** Capture min, default and max while paused so animation does not hide the effect. A control that changes nothing visible fails its criterion even if the value changes.
- **Headless runs.** `MODELBENCH_HEADLESS=1` is for smoke-testing a plan; headless Chrome caps animation at 60 Hz, so measure performance in the headed window.
- **Narrow layouts.** Resize, wait for layout, record `layout` and a shot, then resize back and check the canvas buffer followed.
- **Domain analysis.** When the brief asks for a physical or visual property, add a focused script under `scripts/domain/`. `diffrot.cjs` is the example: polar cross-correlation of `snaps` frames from a top-down view gives angular velocity per radius (`DARK_THR` sets the shadow threshold).

## Performance trials

`node S/perf_trial.cjs OUT/evidence/plan.json OUT/evidence/runtime/perf.json <N> <IDs in this trial's order>`, for N = 1, 2, 3, rotating the order by a third each time. Each trial loads fresh, waits for the first WebGL draw call, warms up, then measures with the independent monitor and checks the page is still animating. When every run reaches the display's refresh rate, report that the measurement cannot rank them; do not invent a ranking from noise.

## Looking at the evidence

- `node S/compose.cjs sheet.png <cols> <cellW> img…` builds a contact sheet (`-` leaves a blank cell). Compare one view across all submissions on one sheet.
- `node S/crop.cjs in.png out.png x y w h` cuts a region for close inspection.
- Chase every anomaly with a focused re-run before believing it: a stray frame, a blank shot or a dead control is often timing, not a defect.

## Projects that need a build

Copy the submission to `OUT/.cache/build/<ID>/`, install with its own lockfile (`npm ci`, `pnpm i --frozen-lockfile`), build or start it there, and point `submissions.<ID>.url` at the local address. A failed install or build is the submission's result (DNF or blocked, see methodology), never something to fix.

## Projects that are not web pages

For a CLI, library or service, replace `run_plan` with the project's own tests plus scripted commands that exercise each requirement. Record each check as pass, partial, fail or not verified with the command and its output under `OUT/evidence/runtime/<ID>/`, and mark performance not applicable unless the brief defines a measurable target.
