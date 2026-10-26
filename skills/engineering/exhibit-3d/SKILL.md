---
name: exhibit-3d
description: Build interactive 3D science exhibits in Daniel's night-lab house style. A working instrument on a bench in a dusk-lit room, one glowing phenomenon, a dark glass HUD with three live readouts and named setups, Lab, Exploded and Studio views, real physics, three.js on WebGPU. Use for any request to build, design, restyle or upgrade a 3D visual, 3D explainer, interactive simulation, science toy or three.js scene, even when no style is named.
when_to_use: Triggers include "make a 3D visual of…", "interactive 3D explainer of how X works", "build a three.js or WebGPU scene", "turn this concept into an interactive lab", "make it look like those SAEL Lab exhibits", "restyle this 3D scene", and /exhibit-3d followed by a topic.
argument-hint: "[topic or phenomenon]"
effort: max
---

# exhibit-3d

## Skill paths across agents

Resolve `${CLAUDE_SKILL_DIR}` below to the absolute directory containing this `SKILL.md`. Claude Code supplies that placeholder; on other agents, substitute the loaded skill directory directly in every command and path. Resolve bundled relative paths from that same directory, not the project working directory. If the agent does not supply `$ARGUMENTS`, use the topic from the invoking request.

Build one interactive 3D exhibit about **$ARGUMENTS** (if empty, take the topic from the conversation). The result looks like the four images in `${CLAUDE_SKILL_DIR}/references/exemplars/`, teaches one idea by letting the visitor run the experiment, and every number on screen is real.

## Non-negotiables

1. **One question, one apparatus, one glowing phenomenon.** The phenomenon and a few practical LED strips are the only emitters. Bloom reads the emissive target only. Nothing else may glow.
2. **House the phenomenon in an instrument**: bench, rail, rotation stages, chamber, console with knobs and screens. Biology goes in a chamber; abstractions get a machine.
3. **Engineered parts** are beveled PBR (lacquer, machined brass, glass, knurled rubber). **Natural props** are low-poly and flat-shaded.
4. **Light**: cool hemisphere and fog, warm key, amber practicals. Use the per-view look presets in `references/style-bible.md` §4 as written.
5. **HUD**: title column top left (white kicker, big cyan title, two-sentence lede), exactly three mono readouts with one hot in cyan, a live caption sentence; control card top right with TRY presets (3 or 4), parameters, view switch, tools (lesson, tour, labels, help), and a compact mode (H) that folds the card into a pill for an immersive view. Outfit and DM Mono, tokens from `references/hud-spec.md` §3. No framework default looks, no lil-gui in the shipped interface.
6. **Views**: Lab, Exploded, Studio (or Assembled and Exploded when the object is the subject). Each is a full look preset with a veil transition. Every set is finished on every side: the Lab is a furnished room (kit `buildLabSet`), the Exploded void is drawn in screen space, the Studio paper is a bowl, and the apparatus and console are finished at the back.
7. **In-world information**: labels on parts with live values; at least one console screen with a live chart or a filmstrip; a loupe, twin or ghost when there is a hidden mechanism or a comparison.
8. **Every parameter has at least three input paths**: drag the part, a console control, a HUD control, plus a key.
9. **Truth**: a pure TypeScript model with invariant tests; every displayed number comes from it; the help sheet has "What is exact and what is not" with sizes of every approximation and theatre.
10. **Camera**: 30° vertical FOV, elevated three-quarter hero framing fit to the space between HUD columns, free orbit all the way around inside the set's bounds, idle drift, eased moves. The cinematic tour **opens the exhibit**: a plain first load plays it with the control card faded away until the first input, which only takes over: a quick fade home to the hero view in the start state. It stays in the Lab and loops without a seam: a few seconds of slow, wide atmosphere, then closer and lower along the bench, then a close-up of each feature worth a look that performs the lesson's steps, the payoff last, with a fade through black between shots while the camera keeps moving. Honor reduced motion: the exhibit then opens still.
11. **Stack**: newest `three` with `WebGPURenderer` only, TSL only (no `ShaderMaterial`, `onBeforeCompile`, `EffectComposer`). Copy pipeline wiring from the three.js example pages at the installed release's tag (`github.com/mrdoob/three.js/blob/r<NNN>/examples/webgpu_*.html`; the npm package ships only its `examples/jsm` and `src` folders), not from memory.
12. **Prove it**: debug handle and URL parameters for deterministic shots, the capture matrix, a blind critique against `references/qa-rubric.md`. All gates pass and the score is at least 85 before you report done.
13. **Originality**: house style yes, copying no. Never copy code, text, models or images from the reference creator's site, never put his name or handle in an exhibit. The maker plate and credit carry Daniel's mark.
14. **Voice**: American spelling, plain short sentences, numbers with units, no hype, no emoji.
15. **Show me and let me try**: the presets show a state; the **lesson** has the visitor make it. Each step asks for one action in the caption, puts an amber hint pill on the part, waits until the model shows it done, then answers with the visitor's own numbers and asks for the next. The rest of the HUD stays exactly as it is. The first input after the opening starts it; the lesson tool (L) restarts it; a preset ends it.
16. **Favicon**: one SVG drawing of the apparatus or its phenomenon on a navy tile, readable at 16 px (`exhibit-design.md` §2).

## Workflow

### 0. Load context (always)
- View all four images in `references/exemplars/` and read `exemplar-notes.md`.
- Read `references/style-bible.md` §1 to §4, `references/hud-spec.md` §3 to §5, `references/exhibit-design.md` §1 to §9. Skim `references/webgpu-stack.md` §1 to §6.
- Open the golden exhibit in `${CLAUDE_SKILL_DIR}/examples/golden-polarizer/`: read its `EXHIBIT.md`, `src/main.ts` and `src/model/`. Copy its patterns, not its content.

### 1. Write EXHIBIT.md
Use the template in `references/exhibit-design.md` §14. Fill every section, including invariants and the honesty list. If the topic is genuinely ambiguous (two different exhibits could be meant), ask one question; otherwise decide and continue.

### 2. Model first
Pure TypeScript in `src/model/`, no three imports. Write the invariant tests from EXHIBIT.md and make them pass before any rendering.

### 3. Scaffold
`node ${CLAUDE_SKILL_DIR}/scripts/new-exhibit.mjs <dir> --id <slug> --install` copies the template and vendors the kit into `src/kit/` without overwriting files already there (your EXHIBIT.md and model stay), writes `package.json` pinned to the newest `three`, and installs. The template's glass-slab sample runs as is: replace it, keeping its wiring, and redraw its `public/favicon.svg` for your topic.

### 4. Apparatus and set
Build the instrument with `kit/geometry` and `kit/materials`, then the Lab set with one background echo of the topic, the Exploded plinth and axis, and the Studio set (`kit/sets`). Register each set piece with `stage.registerSet()` under the names the looks show: `room`, `console`, `rail`, `plinth`, `cyclorama`. Shadow maps render on demand: call `stage.invalidateShadows()` whenever a part starts to move (they re-render for the next 1.5 s). Follow `style-bible.md` §5 to §8.

### 5. Phenomenon
Compute paths and fields from the model; draw them as HDR emissive geometry (`kit/beams`, `kit/spectrum`). Ribbons sit on `BEAM_LAYER`, draw before glass so transmission refracts them, and write depth so depth of field focuses them; give them `shade: true` so they still read on Studio paper. A tinted sheet that must read in focus (a filter, a slide) writes depth too. Check that only emitters bloom.

### 6. HUD and interaction
Describe the HUD in a schema (`kit/schema`) and mount it with `kit/hud`. Write the caption writer (one causal sentence per regime, colored live numbers), the lesson (`kit/lesson`, `exhibit-design.md` §5), the help sheet (§8), the keyboard map (§7), world labels (`kit/labels`), console screens (`kit/screens`), the loupe if any (`kit/loupe`). Drag parts with `kit/drag` (pass its `filter` to the camera rig) and ease displayed values with `kit/motion`. Wire all input paths to one state object.

### 7. Views, camera, cinematic
Set hero shots and fit boxes per view (`kit/camera`), the focus point on the phenomenon (`rig.focusPoint`), the exploded offsets along the working axis, and the opening tour (`kit/cinematic`, `exhibit-design.md` §11), in the Lab only: atmosphere, then closer and lower, then a close-up of each feature with its `focus` performing the lesson (`lesson.perform(i)`), the payoff last, and shot one's `setup` to close the loop.

### 8. Lookdev loop (at least two rounds)
1. `node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs <url> --out qa/` (the matrix in `qa-rubric.md` §3; `metrics.json` with view-switch frame times; `hud.txt`, `help.txt`, `a11y.json`; a labels-off shot, a keyboard-focus shot and frames from the cinematic tour; `contact-sheet.png` next to the exemplars). It fails on a non-WebGPU backend or console errors. Measure on AC power: on battery Chrome's energy saver caps every page at 30 fps.
2. Spawn a separate critic subagent that sees only the evidence folder (the shots and contact sheet, the exemplars and their notes, the HUD and help text, `metrics.json`, `a11y.json`, the model test output, `qa-rubric.md`), never source code. It scores and lists the five biggest gaps.
3. Fix the gaps, using the tune panel (`?tune`) to dial look values, then write the tuned values back into the look presets.
4. Repeat until all gates pass and the score is at least 85.

### 9. Report
Open it in the viewer for Daniel to watch (`node ${CLAUDE_SKILL_DIR}/scripts/present.mjs <exhibit dir>`). It puts `<Exhibit Name>.app` at the exhibit's root, named from the page title (`Induction Bench.app`), a Mac window with no title bar, and opens it; opening the app starts the dev server and quitting it stops the server it started. The viewer is built once (a few minutes) and rebuilt only when its source changes. Give Daniel: the local URL, the backend and frame rate, the rubric score with gates, the three strongest shots attached, the honesty list in two lines, and the one thing you'd tune next.

## Kit map (vendored into each exhibit as `src/kit/`)

| Module | Job |
|---|---|
| `tokens.css`, `hud.css` | the HUD design system (hud-spec) |
| `schema.ts`, `hud.ts` | declare and mount the HUD; stats, caption, controls, presets, views, tools, tips, help, hide-UI, compact HUD, the opening's presenting state |
| `stage.ts`, `looks.ts` | WebGPU renderer, adaptive pixel ratio, post pipeline, look presets, veil transitions |
| `camera.ts`, `cinematic.ts` | hero framing, free orbit with set bounds, shortest-turn resets, depth of field that keeps the bench sharp end-on (`rig.focusSpan`), idle drift, fly keys, shot list with beats, the opening (`opensWithTour`), fades through black, per-shot focus and setup |
| `lesson.ts` | the guided lesson: one request at a time in the caption, hint pills, checks against the model, answers with the visitor's numbers; `lesson.perform(i)` lets the tour perform the same steps |
| `drag.ts`, `motion.ts` | dragging parts in the scene (hover tooltip, cursor, turn, drag or click), eased values for presets and drags |
| `materials.ts`, `geometry.ts`, `sets.ts` | house materials, beveled and mechanical parts, Lab room (call `lab.cutaway(camera)` every frame so the walls nearest the camera open), Exploded plinth and Studio bowl |
| `furniture.ts` | the Lab room's furniture: credenza, shelving, ladder, workbench, pegboard, desk lamp, drawers, stool, display cabinet, armchair, floor lamp, side table, framed print, door, coat, plants, rug, pendants |
| `beams.ts`, `spectrum.ts` | HDR ribbons along paths, wavelength to color |
| `labels.ts`, `screens.ts`, `loupe.ts` | world labels that never stack, cover the magnifier or run off the frame (`labels.keepClearOf(loupe, caption)`), diegetic charts and filmstrips, magnifier inset |
| `tune.ts`, `keys.ts`, `debug.ts`, `a11y.ts` | lookdev panel, keyboard map, `window.__exhibit` and URL parameters, accessibility |
| `index.ts` | exports everything and `KIT_VERSION` |

## Never

- The generic three.js demo: grey grid floor, normal-material blobs, orbit controls and nothing else, lil-gui.
- Everything glowing, neon cyberpunk, bloom on specular highlights, pure black or flat grey backgrounds.
- Floating abstract shapes with no apparatus.
- White cards, default component-library panels, gradient text, emoji, paragraphs in the HUD, more than three readouts, more than four presets.
- Tutorial chrome around the lesson: coach marks, step counters, Next buttons, dimmed screens.
- Decorative or invented numbers, undeclared exaggeration, unlabeled time scaling.
- Snapping transitions; FOV above 45° or below 20°; blurry or overlapping labels.
- Anything copied from the reference creator.

## References

- `references/style-bible.md`: look, color, look presets, lighting, materials, geometry, sets, post, camera, labels, diegetic instruments, motion.
- `references/hud-spec.md`: tokens, layout, components, responsive, light theme, accessibility, number formats.
- `references/exhibit-design.md`: the formula, hook copy and favicon, apparatus, controls, presets and the lesson, readouts and caption, keys, help sheet, truth rules, the opening tour, voice, EXHIBIT.md template.
- `references/webgpu-stack.md`: defaults, imports, renderer, pipeline order, port table, what breaks, building blocks, code shape, debug handle, performance.
- `references/qa-rubric.md`: gates, scoring, capture matrix, physics checks, judging, report.
- `references/exemplars/`: the four reference frames and what each demonstrates.

## Defaults

- New exhibits go in a new folder named after the slug, in the current project or `~/exhibits/` when there is no project.
- Desktop target 60 fps at 1600×900 on an M1 Pro class GPU; phones get the docked layout and a lower pixel budget.
- Present exhibits in the viewer (`scripts/present.mjs`: `<Exhibit Name>.app` at the exhibit's root, a Tauri 2 window with no title bar or window buttons that runs its own dev server). It draws with the Mac's own WebKit, slower to start than Chrome, so measure and judge in Chrome.
- If you commit, no agent attribution: no Co-Authored-By trailers.
