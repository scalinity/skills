# QA rubric

One yardstick for three jobs: the builder's self-check before reporting, the lookdev critic during a build, and the blind judge in the acceptance test. Score from evidence only (screenshots, page text, console and performance logs, model test output), never from source code or from what the build log claims.

## 1. Gates (every one must pass)

| # | Gate | Evidence |
|---|---|---|
| G1 | WebGPU is the active backend | the page requested a `webgpu` canvas context and the debug handle or a context probe confirms it |
| G2 | One phenomenon is the brightest, glowing element; at most a few practical strips also glow | Lab and Exploded screenshots |
| G3 | The phenomenon is housed in a physical apparatus on a bench, console or plinth | any screenshot |
| G4 | Title block top left (small kicker, big accent title) with three live readouts; a control card top right | desktop screenshot |
| G5 | Three or four named setups that jump to canonical states (a lesson is extra and does not stand in for them) | control card, preset screenshots |
| G6 | At least two views, one of them an exploded or anatomy view | view screenshots |
| G7 | Labels anchored to parts, carrying live values | Lab or Exploded screenshot |
| G8 | Displayed numbers follow the model; physics checks pass | §4 |
| G9 | A help sheet with an explicit "what is exact and what is not" section | help text |
| G10 | No console errors; at least 50 fps at 1600×900 on the test machine | logs |

## 2. Scored (100)

**A. Look and light (25)**
- A1 Luminance hierarchy: the phenomenon dominates, nothing else competes, no grey haze over the frame (5)
- A2 Warm practicals against cool ambient and fog; no neutral grey lighting (4)
- A3 Material craft: lacquer, machined brass or metal, glass, rubber; bevels; mechanical detail such as knurling, ticks, bolts (5)
- A4 Precision versus toy: engineered parts semi-real, natural props low-poly and flat-shaded (3)
- A5 Set: Lab reads as "[apparatus] in a [place] at dusk"; Exploded on a plinth in a navy void; Studio on warm paper; one background echo of the topic; every set finished from every side (orbit shots 15 to 20) (3)
- A6 Finish: depth of field that makes it a miniature, restrained bloom, vignette, grade, no aliasing shimmer (5)

**B. HUD fidelity (20)**
- B1 Type pairing: heavy uppercase geometric sans for titles and UI, mono for every value (readouts, slider values, labels, charts); option names on buttons stay in the sans even when they are numbers, as in the exemplars (4)
- B2 Dark navy glass cards, correct radii and blur, cyan as the single accent with fixed meanings (4)
- B3 Segmented controls, sliders with fill glow, ticks and live values, tool buttons, all in the house pattern (4)
- B4 Readouts: exactly three, units, one hot value, semantic colors that match scene objects (4)
- B5 Live caption sentence with colored live numbers (2)
- B6 Phone layout: title on top, control card docked to the bottom, nothing overlapping (2)

**C. Exhibit design (25)**
- C1 One clear question; title pair and two-sentence lede in the house voice; a favicon drawn for the exhibit (3)
- C2 Controls map to physical actions with at least three input paths each (scene drag, console, HUD, keys) (4)
- C3 Presets demonstrate named ideas in a teaching order (3)
- C4 Diegetic displays: a console screen with a live chart, a filmstrip, or a gauge that moves with the state (4)
- C5 A loupe, twin or ghost where the topic has a hidden mechanism or a comparison (3)
- C6 Cinematic tour that opens the exhibit on a plain load and stays in the Lab: atmosphere first, then a close-up of each feature performing the experiment, fades through black between shots, a loop without a seam. Judge it across the opening's frames: its first shots are atmosphere by design (2)
- C7 Keyboard map, hide-UI and label toggle work (3)
- C8 Guided lesson: one request at a time in the caption with a hint pill on the part, checked against the model, each answered with the visitor's own numbers, ending on the law; the rest of the HUD unchanged (3)

**D. Truth (15)**
- D1 Physics checks pass, including at least one quantitative value (7)
- D2 Approximations, exaggerations, time scaling and theatre are declared with their size (4)
- D3 Real constants with named sources; stated assumptions (4)

**E. Engineering (15)**
- E1 Frame rate at 1600×900, and no hitch when switching views (4)
- E2 No console errors or warnings from the app (3)
- E3 Accessibility basics: labelled buttons, keyboard operable, visible focus, reduced motion honored (3)
- E4 Deterministic state: URL parameters or a debug handle reproduce any shot (2)
- E5 Model separated from rendering and covered by passing tests (3)

**Pass:** all gates and at least 80. **Excellent:** at least 90.

## 3. Capture protocol

Viewport 1600×900 at device scale 2 unless stated. A plain load plays the opening tour, so every shot in the matrix loads with `cinematic=0` or a parameter that sets up the shot; the opening has its own frames below. Wait for the ready signal (debug handle `ready`, or 6 s after load plus no network activity), then 1.5 s more for depth of field and bloom to settle.

| Shot | State |
|---|---|
| 01-lab-default | first load with `cinematic=0`, Lab |
| 02-lab-preset-1 … 05-lab-preset-4 | each preset, Lab |
| 06-exploded | Exploded, labels on |
| 07-studio | Studio |
| 08-ui-hidden | Lab, interface hidden |
| 09-help | help dialog open |
| 10-phone | 390×844 at scale 3, Lab default |
| 11-short-window | 1600×760, Lab default (lede and caption should hide) |
| 12-closeup | camera pushed in on the hero part |

Also record: backend, average and minimum frame rate over 5 s of idle and 5 s of interaction (or cinematic mode), console messages, page text of the HUD and the help sheet. Measure frame rate on AC power with heavy background work stopped (screen recording, video encodes, builds): on battery, Chrome's energy saver caps every page at 30 fps, and heavy background load can add stalls that are not the exhibit's.

Extras beyond the matrix: 13 labels off; 14 keyboard focus; 15 to 18 the Lab from behind, the east, the west and above (`orbit=180,8`, `90,8`, `-90,8`, `0,70`); 19 Exploded and 20 Studio from behind; 21 the compact HUD (`compact=1`); the opening, from a plain load: the cinematic tour with the card faded away, one frame every 6.5 s for its first loop (`tour-N`), the dissolves counted from the veil, and 22 the HUD after one key press (the takeover). The lesson: each step's request and answer as caption text, every step completed through the visible controls or keys, never the debug handle (which only restarts it, `lesson(true)`). E3 and E4 are exercised, not inferred: one load with `motion=reduce` (the exhibit opens still and the camera jumps instead of gliding), and one shot opened from its address parameters alone, compared with the same state reached through the controls.

Make a contact sheet: the shots in a grid next to the four exemplar images, same scale.

## 4. Physics check protocol

1. Read the model's stated constants and assumptions from the help sheet.
2. List three to six **invariants** from the physics (sign changes, proportionalities, limits, special points). Examples: emf is zero when nothing moves; doubling speed doubles peak emf; deviation has a minimum at symmetric passage; the sharp zone grows when the aperture closes.
3. Drive the exhibit to states that test each invariant (debug handle, URL parameters or the UI) and read the displayed numbers.
4. Compute at least one value by hand from the stated constants and compare. Within 2% passes, unless the help sheet declares a larger approximation that explains the gap.
5. Report each check as pass, fail or unverifiable. Unverifiable counts as fail for D1 and costs D3 points.

## 5. Judging procedure

- The judge sees only the evidence pack. Builds are labeled A and B in random order; the judge doesn't know which used the skill.
- Two independent scoring passes, then a reconciliation pass that resolves differences larger than 2 points per item with a sentence of evidence each.
- Every score cites the shot or log that justifies it.

## 6. Report

```
Build A — gates: G1 ✓ … G10 ✗ (reason) — score 84/100
  A 21/25 · B 18/20 · C 20/25 · D 12/15 · E 13/15
  Top three wins (with shot ids) · Top three losses (with shot ids)
  Physics: invariants table with pass, fail or unverifiable
  Performance: backend, average and minimum fps, errors
```
