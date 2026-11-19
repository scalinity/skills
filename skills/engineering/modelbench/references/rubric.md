# Rubric

The default 100-point rubric. Keep the five category weights so benchmarks stay comparable over time; adapt the subcriteria to the brief. If the user supplies a rubric, use it verbatim instead.

## Anchors

Every subcriterion scores one of 0% (absent or broken), 25% (major failures), 50% (partially satisfies), 75% (substantially satisfies with a concrete limitation), 100% (fully satisfies) — except the explicit performance thresholds below. Each score cites evidence: a screenshot, a probe result, or `file:line`.

## Default categories

**A. Visual quality — 30** (structured aesthetic judgment; explain with screenshots and motion)
- A1 Composition, readability and how convincingly the subject reads — 8
- A2 Detail, depth and coherent appearance of the main subject — 8
- A3 Lighting, color and controlled exposure — 8
- A4 Interface legibility and visual integration — 6

**B. Functional correctness and compliance — 30**
- B1 Startup and rendering without fatal errors — 6
- B2–B6 One subcriterion per interactive requirement in the brief (camera/navigation, each control, pause/state, resize/narrow layout), splitting 21 points in proportion to how central each is — default 5/4/4/4/3 (adjust to fit the brief, keep the sum at 21)
- B7 Packaging constraints from the brief (single file, CDN, allowed libraries, no external assets) — 3 to 4 (take the remainder of the category)

**C. Domain-critical technique and animation — 20**
- C1 The hardest technical requirement of the brief, judged on *visible, correct behaviour* — 10 (e.g. real background lensing; a correct physics step; an accurate parser)
- C2 Secondary technical requirement — 4
- C3 Time handling or state continuity (frame-rate independence, no jumps on resume) — 4
- C4 Stable behaviour across the full range of every control — 2

Judge correctness and suitability, not code length. A correct approximation earns full credit; custom shaders or extra machinery are not better by default.

**D. Performance — 10** (medians across three default-scene trials)
- D1 FPS: ≥55 → 3; 45–<55 → 2; 30–<45 → 1; <30 → 0
- D2 p95 frame interval: ≤25 ms → 3; >25–40 → 2; >40–66.7 → 1; >66.7 → 0
- D3 Stability and responsiveness during the common interaction sequence — 4 (anchors)

Do not award performance points to an idle or static page that failed the requested animation. For non-interactive work, replace D with the brief's own performance requirement or mark it not applicable and report the confirmed range.

**E. Code quality — 10**
- E1 Clear organization and meaningful naming appropriate to the project size — 4
- E2 Sensible state, resource and event handling (including failure feedback) — 3
- E3 Maintainable integration of the moving parts — 3

Do not reward verbosity, abstractions for their own sake, or comments that claim behaviour the code lacks. E measures maintainability; technical ambition belongs to the unscored code-craft lens.

## Adapting to a brief

1. List every requirement and constraint in the brief as a line.
2. Map each line to one subcriterion (B for "it works", C for "it is technically right", A for "it looks right"). A requirement with no home means a subcriterion is missing.
3. Requirements the brief excludes (exact physics, a framework, deployment) must not appear.
4. Save `evidence/rubric.json` as `{"rubric":[{"k":"A1","c":"A","label":"…","max":8,"threshold":false}, …]}` — set `"threshold": true` on D1/D2 so `freeze_scores.cjs` accepts their exact point values.
