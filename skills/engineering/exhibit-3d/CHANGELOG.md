# Changelog

## 0.3.0 — 2026-10-11

Four features from the same acceptance test and from watching its exhibit. The exhibit built without the skill taught by asking the visitor to do each step and answering what they did; both judges named that among its three strongest features, and the rubric had no item for it. It also had a favicon. The opening tour and the viewer came from watching build A in a window.

- The cinematic tour opens the exhibit, and stays in the Lab. A plain first load plays it with the control card and the corner buttons faded away (`hud.setPresenting`) and the title column as its title card. Reduced motion, `cinematic=0` and any parameter that sets up a shot open still (`opensWithTour`, `plainLoad`). Shot one is a few seconds of slow, wide atmosphere; shot two comes closer and lower along the bench; then a close-up of each feature performs the lesson's steps, its depth of field pulled to its subject (`Shot.focus`); the payoff ends the loop, and shot one's `Shot.setup` resets the exhibit in the black, so the loop has no seam. Between shots the screen fades to black and back in about a second (`stage.fade`; `setLook` swaps under an opaque veil) while the camera keeps moving, each move easing without coming to rest. The first input only takes over: a quick fade home to the hero framing in the start state (`play(0, { opening: true })`). This replaces 0.2.1's opening, one full circle of the room performing the lesson from its second second: watched in a window, the circle was too fast and too long, the hard cut after it jumped, and the other views broke the room's spell (SKILL.md non-negotiable 10, exhibit-design §11, style-bible §10, hud-spec §5 and §9; golden and template shot lists).
- New `kit/lesson.ts`, the guided lesson beside the presets: each step asks for one action in the caption, shows an amber hint pill on the part, checks the model, and answers with the visitor's own numbers; `lesson.perform(i)` lets the tour perform the same steps. A lesson tool (`lesson` icon) and L; a preset or the tour ends it; the caption shows in every layout while the lesson speaks (`lesson-on`). SKILL.md non-negotiable 15, exhibit-design §5, hud-spec §5, style-bible §11; the golden has four steps, the template three.
- Favicon: `public/favicon.svg` in the template and the golden, linked from `index.html`; exhibit-design §2 says how to draw one (SKILL.md non-negotiable 16).
- New `viewer/` and `scripts/present.mjs`: `node present.mjs <exhibit dir> [--port 5173]` puts the exhibit's own app at its root, named from its title before " · " (`Induction Bench.app`), and opens it. A Tauri 2 window with no title bar and no window buttons, the scene filling it, with the native rounded corners and edge resizing, a drag along the top edge, a double-click there to zoom, Cmd+M, Cmd+H and Cmd+Q, and its own Dock icon. The bundle's executable is a launch script: it finds the project from the app's own location, reuses a server already answering on the port or starts `vite --port <port> --strictPort`, waits until it answers, opens the viewer, and stops the server it started when the viewer quits. Each exhibit's app has its own bundle identifier, so two can run side by side. The viewer is built once into `~/Library/Caches/exhibit-viewer` and rebuilt only when a hash of its source changes; the build folder (about 900 MB) is deleted afterwards, so only the 13 MB app is kept. It draws with the Mac's WebKit, so measuring and judging stay in Chrome (SKILL.md workflow 9 and Defaults).
- qa-rubric: new C8, the guided lesson (3). C1 now includes the favicon (4 → 3), C3 (4 → 3) and C4 (5 → 4) give up a point each, and C6 covers the opening and says to judge it across its frames, since its first shots are atmosphere; section C stays at 25, and scores under this rubric are not comparable with scores under 0.2.x. G5 says a lesson does not stand in for the setups. Still shots load with `cinematic=0`; the opening's frames, its fades and the takeover are captured (`scripts/capture.mjs`).
- `kit/debug.ts`: `?cinematic=0` or `1`, and without it the opening decides; debug handle `lesson()`. `kit/keys.ts`: the reduced-motion line mentions the opening.
- Golden EXHIBIT.md: the echo line describes the window discs the exhibit has had since 0.2.0, and the shot table matches the code.

## 0.2.1 — 2026-10-11

From a blind acceptance test against an exhibit built without the skill: the skill's exhibit passed every gate and scored 94. Five and a half of its six lost points traced to the skill, each a feature the exhibit had or a rule it followed to the letter.

- Cinematic tour: the opening circle of the room performs the lesson, its first change visible by the third second (SKILL.md non-negotiable 10, exhibit-design §11, style-bible §10; template and golden shot one). The circle had no lesson beat, so any frame from its first 24 s showed only the camera moving.
- World labels have a tool in the card (`labels` icon, a toggle) beside Shift+N, both through one `setLabels()` (hud-spec §5 and §9, SKILL.md non-negotiable 5; template and golden schema and wiring). Labels worked, but only from a key, so nothing that drives the visible controls could show them switching.
- `kit/keys.ts`: under the Keys list, every help sheet says what reduced motion changes (exhibit-design §8). It worked; nothing on the page said so.
- qa-rubric capture protocol: E3 and E4 are exercised, not inferred: one load with `motion=reduce`, and one shot opened from its address parameters alone. Both worked in the test exhibit, but the harness never tried them.
- style-bible §2 law 1, §8 and §12: an attention budget for what does not glow (console screens within about 8% of the Lab frame, a loupe smaller than the phenomenon, light faces near mid-grey), and the background echo is a ghost, set off by value. The 0.2.0 wording, "high-contrast shapes", produced a saturated red horseshoe with polished tips.
- qa-rubric B1 and hud-spec §1, §2 and §11: mono is for values; option names on buttons stay in the UI face even when they are numbers, as in the exemplars.
- `kit/stage.ts`: without TRAA, the ambient-occlusion pre-pass renders through its own copy of the camera. three keys render lists by scene and camera, so the pre-pass, running nested inside the main pass with the same camera, reset the list the main pass was drawing. Found and fixed in the test exhibit, which used SMAA. The copy is synced with `copy(camera, false)`, so children of the camera are never cloned into it.
- Golden exhibit: its vendored `src/kit/` takes the three kit changes.

## 0.2.0 — 2026-10-10

House rules changed at the checkpoint, each from a gap the blind critic found in more than one round.

- `references/style-bible.md` §8, Exploded: the gaps must be wide enough to read from the Exploded camera, with the apparatus filling most of the frame width. Rounds 1 to 3 found the parts barely separated.
- `references/style-bible.md` §8, background echo: kept out of focus, it must read by silhouette alone, as a few large, simple, high-contrast shapes. All four rounds found the echo unreadable at Lab distance.
- `references/exhibit-design.md` §3: a part that can be taken out of the light path parks where it reads as out from every view's camera, dropped below the beam or swung well aside, never just behind or in front of it. Rounds 2 to 4 found the parked middle filter overlapping the beam on screen.
- `references/qa-rubric.md` §3: frame rate is measured on AC power with heavy background work stopped. On battery, Chrome's energy saver caps every page at 30 fps.
- Golden exhibit, to match: the middle filter rides a vertical lift and parks above the beam.

Immersion: every set can be seen from every side.

- `kit/camera.ts`: free orbit in every view (yaw unbounded, pitch −0.08 to 1.3 rad), per-view `bounds` that keep the camera inside a room, resets along the shortest turn, `orbitPose()`.
- `kit/sets.ts` and new `kit/furniture.ts`: the Lab is an optics-workshop room finished on every side (four walls, ceiling, rug, window with amber bars, credenza, lit shelving and ladder, workbench with pegboard and desk lamp, display cabinet, reading corner, door, plants, pendants) returning camera `bounds` and the window pane; `cutaway(camera)`, called every frame, opens any wall the camera stands behind or near (the front opens for a camera standing farther back than the room is deep). The Studio paper is a lathed bowl around the bench.
- `kit/stage.ts`, `kit/looks.ts`: backdrops are drawn in screen space (`LookPreset.backdrop`: gradient plus haze); the Exploded void is a readable navy gradient with its haze low on the left. Lab fog density 0.009.
- `kit/hud.ts`, `kit/hud.css`: compact HUD (H, or the card's collapse button); toggle groups other than TRY split their track evenly.
- `kit/debug.ts`: URL `orbit=yaw,pitch[,scale]` and `compact=1`; debug handle `orbit()` and `setCompact()`.
- `scripts/capture.mjs`: orbit extras 15 to 20 (Lab from behind, east, west, above; Exploded and Studio from behind), 21 compact HUD, twelve tour frames every 6.5 s.
- References: style-bible §8 and §10, hud-spec (compact HUD, toggle tracks), exhibit-design §3, §7 and §11, qa-rubric §3 and A5.
- Golden exhibit: the echo is a mobile of polarizer discs in the window that shade its light with Malus's law (`discTransmission`, tested); the console has a finished back panel; the tour opens with a slow circle of the room; the help sheet lists H and the window discs.

Orbit polish, from the gaps round 6 named in side and end-on views.

- `kit/sets.ts`: the Lab floor is dark slate tile; a pale floor washed a third of every side view. A wall's cutaway also takes the furniture against it once the camera comes within 1.4 m of the wall, so a zoomed-out camera never stands inside the credenza.
- `kit/camera.ts`: `focusSpan` (the bench's two ends) and `focusSpanDepth`: the depth of field widens as the camera turns to look along the bench, so the whole bench stays sharp end-on.
- `kit/labels.ts`, `kit/loupe.ts`: two pills keep a 12 px gap or the lower-priority one fades, so parts lined up one behind another never stack their labels; `labels.keepClearOf(loupe, caption)` fades a label that comes within 10 px of the magnified face (`Loupe.screenCircle`), except `caption`, the label of the part the loupe shows, which may sit against its rim; a pill that reaches the frame's edge fades too.
- Golden exhibit and template, to match: `rig.focusSpan` set to the bench ends, `labels.keepClearOf(loupe, …)` with the magnified part's label as the caption.

Lighting pass, from round 7's first gap: the Lab read underlit and thin in the first view (its darkest quarter at luma 15).

- `kit/looks.ts`: the Lab fog is a lavender-navy `#3a3d62` at density 0.009, so the far walls read as colored depth rather than black.
- `kit/sets.ts`: walls, floor and ceiling take twice their share of the dusk environment light. A soft shaft of dusk light falls from the window to the floor beside the bench, brightest looking toward the window and faint from the side (as forward-scattering haze is), so side views keep a dark floor; its pool of light lies where it lands. The tall plant stands just left of the window's left light bar, where the first view's left side was bare wall.
- `references/style-bible.md`: the Lab fog row, the window shaft, and plants against the walls (in the corners or beside the window).

## 0.1.0 — 2026-10-08

Knowledge installed.

- `references/` installed from the source pack: style-bible, hud-spec, exhibit-design, qa-rubric and the four exemplars with their notes, byte-identical.
- `SKILL.md` installed from the draft, frontmatter unchanged.
- `references/webgpu-stack.md` corrected against the installed three 0.186.1:
  - Line 5: 0.186.0 was published September 8, 2026 and 0.186.1 on September 24. The npm package ships only `examples/jsm/` and `src/`, so the example pages are read at the release tag on GitHub. The same fix applies to SKILL.md non-negotiable 11.
  - §4 steps 1 and 2: r186 composes AO with an opaque pre-pass (normals, velocity, depth) and feeds GTAO into the scene pass's ambient light through `builtinAOContext`; it does not multiply AO into the final color.
  - §4 step 4: the emissive target stays half float (the example's 8-bit target clips HDR emitters) and blends like color (`MaterialBlending`), because MRT targets other than `output` default to no blending.
  - §4 step 7: TRAA runs on the scene color right after the scene pass, before depth of field; SMAA on the display output is the alternative.
  - §6: `computeAsync()` is not deprecated; `renderAsync()`, `clearAsync()`, `clearColorAsync()`, `clearDepthAsync()`, `clearStencilAsync()` and `hasFeatureAsync()` are (r181).
  - §6, added: node materials honor `envMapIntensity` only when `material.envMap` is set.
  - §6, added: a material with its own `mrtNode` breaks in render targets without MRT (reflectors, render-to-texture).
  - §4 step 3: r186's `dof()` gathers without depth weighting, so sharp edges bleed into the blurred background; the kit uses a depth-aware gather on the main pass depth.
  - §6, added: inside full-screen passes, TSL `cameraNear` and `cameraFar` describe the quad's camera.
