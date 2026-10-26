# Style bible: the night-lab exhibit look

Source of truth for how an exhibit looks. Values marked **(ref)** were read from the public page source of three reference exhibits (Prism Room, Root Finder, The Plane of Focus; built on three r183 with WebGL2). Values marked **(rec)** are recommendations for our WebGPU build. Treat all numbers as starting defaults and dial them in with the lookdev panel; do not drift from them without a reason you can state.

Look at `exemplars/*.png` before you read further. The words below describe those frames.

---

## 1. The look in one paragraph

A real, working instrument sits on a lacquered bench in a dark, warm-lit room at dusk. One physical phenomenon (a beam, a spectrum, a growing root, a plane of focus) is the brightest thing on screen and the only thing that truly glows. Around it everything is precise and quiet: machined brass, dark lacquer, clear glass, knurled rubber, plus a few low-poly flat-shaded props that make the scene read as a precious miniature. A dark glass HUD frames it like a museum label: a two-line title, three live numbers, one sentence that explains what you are looking at, and a compact control card. Every number comes from a real model, and the help sheet says exactly what is exact and what is theatre.

## 2. Ten laws

1. **The phenomenon is the light source.** Only the phenomenon and a few practical LED strips exceed the bloom threshold. Machined parts, walls and props stay below it. If more than roughly 5% of the frame blooms, the look is broken. Glow is not the only way to compete, so everything else keeps to an attention budget in the Lab hero frame: console screens together cover at most about 8% of it (the exemplars run 3 to 8%, their consoles along the bottom edge and partly cropped), a loupe is smaller on screen than the phenomenon, light faces such as meter dials and paper sit near mid-grey, and the background echo is a ghost (§8). The test, from every view: the eye lands on the phenomenon first.
2. **House it in an instrument.** Every phenomenon lives inside plausible lab hardware: an optical bench, a rotating chamber, a lens on a rail, a console with knobs and screens. Biology goes in a chamber. Abstract ideas get a machine that produces them.
3. **Precision versus toy.** Engineered parts are semi-realistic PBR with bevels everywhere. Natural subjects and props (plants, trees, soil, pebbles, crystals, seeds, houses, mountains) are low-poly and flat-shaded. The contrast is what makes it feel like a miniature.
4. **Warm practicals, cool ambient.** Cool blue-violet ambient and fog, a warm key light, amber LED strips on edges, posts and shelf undersides. Never neutral grey.
5. **Data lives in the world.** Charts run on screens built into the console, outcomes appear as filmstrips, labels hang off the parts, a loupe magnifies the hidden mechanism. The HTML HUD carries only the title, three numbers, one sentence and the controls.
6. **Three ways to look.** Lab (the set at dusk), Exploded (parts pulled apart along the working axis, on a plinth in a navy void), Studio (a clean product shot on warm paper). Each view is a complete look preset: lights, fog, tone mapping, bloom, reflections, set pieces and HUD theme all change together.
7. **Every number is real.** Constants come from named sources. The help sheet separates exact, approximated and theatre.
8. **Calm telephoto camera.** 30 degree vertical FOV, slightly elevated three-quarter hero framing, subtle idle drift, eased moves. Cinematic mode performs the experiment while the camera travels.
9. **Few accents with fixed meanings.** Cyan means measurement, amber means warm hardware and events, coral means a limit or trouble. Object colors (root cream, leaf green, spectrum) are semantic and reused in the HUD.
10. **Nothing snaps.** State changes ease, presets tween, views cross-fade through a veil.

## 3. Color

### 3.1 Accent palette (ref, shared with the HUD)

| Token | Hex | Meaning and uses |
|---|---|---|
| cyan | `#7fe3ff` | Measurement and the hero accent: big title word, hot readout, slider fills, focus planes, measurement rays, chart traces, selection rings |
| amber | `#ffb454` | Warm hardware and events: knob rings, LED strips, timeline event markers, brass highlights |
| coral | `#ff6b86` | Limits and failure regimes: "trapped", overload, out of range, warnings |
| violet | `#b99cff` | Second data series, short wavelengths |
| green | `#8fe8a8` / `#9be07a` | Organic, growth, "OK" |
| cream | `#f1e2c0` | Roots, paper, bone, warm neutral objects |
| ink | `#0b0f1a` | Page background, veil, deepest UI |

Per exhibit, add one or two semantic object colors as tokens (Root Finder adds leaf `#9be07a` and root `#f1e2c0`) and use them for the matching readout values, caption keywords and labels, so the HUD visibly points at the scene.

### 3.2 Scene palette

- Night surfaces: lacquer and anodized metal from `#14171c` to `#30363f`, bench top `#1b2130`, warm dark ground bounce `#3a3026`.
- Brass and bronze: base around `#c08a3e`; let the environment and warm key make it sing rather than raising its color.
- Glass tints: `#e6fbff` to `#eaf8ff` (very slight cyan).
- Low-poly naturals (ref): leaves `#4f7a3c` / `#5f8c45`, soil and seed `#c46a3a` / `#5a3f2c`, terracotta and wood `#c69c72`. Keep them slightly desaturated; the post saturation boost brings them up.
- Spectra: derive from wavelength (CIE 1931 to linear sRGB, normalized). The ends (violet, deep red) may be drawn brighter than the eye sees them; say so in the help sheet.

## 4. Look presets per view (ref)

Each view is one data object applied as a whole. Switching views fades a veil in, swaps the preset and camera, then fades out.

| Property | Lab | Exploded | Studio |
|---|---|---|---|
| Background | `#10151f` | `#081026` | `#f1e5d8` |
| Fog (exponential squared): color, density | `#3a3d62`, 0.009 | `#0a1430`, 0.006 | `#f1e5d8`, 0.0045 |
| Tone mapping | ACES Filmic | ACES Filmic | Neutral (Khronos PBR Neutral) |
| Exposure | 1.28 | 0.90 | 1.00 |
| Environment map, intensity | dusk gradient, 0.70 | dusk gradient, 0.75 | soft studio, 1.00 |
| Hemisphere: sky, ground, intensity | `#8FA6D8`, `#3A3026`, 0.5 | `#7F9AD8`, `#1C2436`, 0.5 | `#FFF4E6`, `#D9CCBB`, 0.85 |
| Key light: color, intensity, direction | `#FFC98F`, 2.1, (0.62, 0.62, 0.48) front right high | `#FFE0BC`, 1.5, (−0.35, 0.85, −0.45) back left high | `#FFF0DC`, 2.8, (−0.45, 0.8, 0.45) front left high |
| Rim light, second key (relative) | 0.9, 0.55 | 1.5, 0.55 | 0.25, 0.45 |
| Bloom threshold, strength (HDR linear) | 1.05, 0.42 | 1.5, 0.30 | 2.6, 0.18 |
| Planar reflection on bench or floor | 0.50 | 0.45 | 0 |
| Saturation, view multiplier | 1.30 | 1.10 | 0.93 |
| Emissive glow level | 0.32 | 0.36 | 0 (glow off, beams dimmed) |
| Set pieces visible | room, console, rail | plinth stage, rail | studio cyclorama |
| HUD theme | dark | dark | light (title colors darken, vignette at 18%) |
| Veil color for the transition | `#0b0f1a` | `#081226` | `#f1e5d8` |

Global defaults (ref): vertical FOV 30 degrees; global saturation 1.16 multiplied by the view multiplier (so Lab runs near 1.5, which offsets ACES desaturating bright colors); bloom radius 0.55; ambient occlusion radius 0.9 with 12 samples; depth of field on, far blur stronger than near (far aperture 1.6, near 0.9, max circle of confusion about 13 px); shadow map 2048; light key placed at 30 units along its direction.

Why it works: rendering happens in linear HDR, and bloom only picks up values above roughly 1.0, so anything not explicitly emissive or HDR can never glow. The phenomenon is pushed to 2 to 10 times white on purpose; everything else is lit to sit below 1.

## 5. Lighting rig

- **Hemisphere** cool sky over warm dark ground, intensity 0.5 at night, 0.85 in Studio.
- **Key** warm directional with 2048 shadows. Shadows are static: render the shadow map when something moves, not every frame (rec: keep the caster set small).
- **Rim** a cool light from behind the apparatus to separate silhouettes from the dark background. Strongest in Exploded (1.5).
- **Second key or fill** at about half the key.
- **Practicals** emissive amber strips (posts, shelf undersides, plinth base edges, wall bars). Thin, linear, HDR. They are allowed to bloom.
- **Environment** a custom dusk gradient (deep navy top, warm low horizon band, faint window glow) prefiltered into the environment map. Glass and brass depend on it, so build it deliberately.
- **Beam haze** visible light beams are theatre (real beams are invisible in clean air). Draw them as additive ribbons and declare it.

## 6. Materials (ref values; physical material unless noted)

| Material | Key parameters | Used for |
|---|---|---|
| Lacquer | roughness 0.34, clearcoat 1, clearcoat roughness 0.16, env 1.1 | Console body, housings, painted parts |
| Machined metal / brass | metalness 0.85, roughness 0.32, clearcoat 0.35, clearcoat roughness 0.3, env 1.25 | Knobs, dials, gear rings, bolts, plaques, wheels |
| Textured metal | metalness 0.7, roughness 0.42, clearcoat 0.2, with a map | Engraved dials, plates with ticks |
| Bench top | `#1b2130`, metalness 0.5, roughness 0.28, env 0.55, plus planar reflection | The working surface |
| Dark steel | `#5a5f68`, metalness 0.2, roughness 0.7, env 0.4 | Stands, posts, brackets |
| Hero optical glass | transmission 1, roughness 0.01, thickness 0.85, real IOR (1.785 for N-SF11), dispersion 0.8, clearcoat 1 with roughness 0.02, specular 1, attenuation color `#eaf8ff` at distance 8, env 2.2 | The one glass part the exhibit is about |
| Thin glass or acrylic | `#e6fbff`, transmission 0.95, roughness 0.05, thickness 0.12, IOR 1.45, env 1.3 | Chamber panes, covers, screens' cover glass |
| Faceted crystal | `#e9f6ff`, transmission 0.9, roughness 0.04, thickness 0.4, IOR 1.5, specular 1, env 1.6, flat shading | Decorative specimens on shelves |
| Matte rubber or fabric | roughness 0.85, env 0.5 | Grips, cables, feet, pads |
| Low-poly organic (standard material) | flat shading, roughness 0.55 to 0.85, metalness 0 | Plants, soil, seeds, trees, houses, terrain |
| Hologram panel | base `#1e4a5c`, roughness 0.3, emissive `#2b8fb3` at 0.8 | Comparison panels, wall diagrams |
| Diegetic screen | unlit, canvas texture, color multiplier about 1.5 so traces bloom slightly | Console screens, filmstrip frames |
| Beam or ray | unlit additive, HDR color 2 to 10, soft edge falloff, no fog | The phenomenon |

Environment-intensity hierarchy follows the luminance hierarchy: hero glass 2.2 > brass 1.25 > lacquer 1.1 > bench 0.55 > rubber 0.5 > dark steel 0.4.

## 7. Geometry language

- Bevel everything engineered: rounded boxes, extrusions with a small bevel (about 1 cm at bench scale), lathed round parts. No raw boxes.
- Mechanical detail that says "precision": knurled grips as real ridges, gear teeth on rings, engraved degree ticks on dials, brass corner bolts, rails with ruler ticks, cable runs, rubber feet, set screws.
- Proportions are chunky and slightly exaggerated for readability: heavy bases, oversized knobs, thick dials.
- Low-poly props use few facets on purpose: 5 to 8 sided foliage clusters, icosahedron crystals, extruded triangle trees, chunky pebbles. Vary scale and rotation; instance them.
- The plinth (Exploded): a wide chamfered trapezoid in black lacquer, a thin warm LED strip along each bottom edge, a small engraved maker plate in brass on the front face. Use Daniel's own mark, never the reference creator's.

## 8. Sets and set dressing

- **Lab** is "a showroom or study at dusk", a room finished on every side because the camera circles it: four walls of plaster over a dark wood wainscot, a ceiling, a tiled floor with a rug under the bench, and one anchor piece on every wall so each orbit angle has something to read. The house room (kit `buildLabSet` with `furniture.ts`) is an optics workshop: a tall steel-framed window with lavender dusk light between vertical amber light bars, and a soft shaft of that light falling from it to the floor (drawn, and brightest looking toward the window, as forward-scattering haze is), a credenza under it, shelving lit from below by warm strips, a workbench under a pegboard with a lit desk lamp, a glass-fronted display cabinet glowing warm inside, a reading corner with an armchair and a floor lamp, a door, plants in planters against the walls (in the corners or beside the window) and never loose in the foreground, two dim pendants over the bench. Everything fades into fog and depth of field; practical lamps may bloom, nothing outshines the phenomenon. The console or bench stands in the middle, finished on every side.
- **Exploded** is a navy void drawn in screen space, so it reads the same from every angle (a navy gradient around luma 50 to 60 in the frame, with a soft lighter haze low on one side), the apparatus on the plinth (near-black, clearly separate from the void), parts separated along the functional axis (the beam path, the drive train, the optical axis) with even gaps wide enough to read from the Exploded camera, the apparatus filling most of the frame width, labels on.
- **Studio** is a warm paper bowl around the bench (floor, cove and wall all the way round, so every angle shows paper), soft shadows, no reflections, minimal bloom, light HUD theme.
- **Background echo**: dressing repeats the topic as decor. Crystals and gems for the prism room, floating ghost lens rings and framed glowing schematics for the lens, sample jars for biology. One echo per set, kept out of focus, so it must read by silhouette alone: a few large, simple shapes, set off from the wall by value. It is a ghost of the topic, dimmer and grayer than every practical and far below the phenomenon, in the set's dusk colors rather than saturated paint or polished metal (the prism room's diagram floats faintly on the back wall). Fine detail and small text vanish in the blur.
- Write the set sentence first: "[apparatus] in a [place] at [time]". The reference's meta descriptions read like "an optical bench in a showroom at dusk".

## 9. Post and finishing

Order: scene pass with ambient occlusion → depth of field → bloom → saturation and grade → subtle film grain → anti-aliasing → HTML vignette overlay.

- Ambient occlusion: GTAO-style, radius about 0.9, gives contact weight under parts.
- Depth of field: focus on the hero, far blur stronger than near; the background should melt into bokeh so the bench reads as a miniature.
- Bloom: emissive-driven, radius about 0.55. Restraint is the style.
- Saturation: global 1.16 times the view multiplier.
- Grain: barely visible, adds filmic texture (present in Root Finder).
- Anti-aliasing: temporal (rec for WebGPU) or SMAA; the reference used MSAA 2 to 4 plus SMAA.
- Vignette is an HTML layer above the canvas, not a shader: a left-edge darkening from about 63% black to transparent over the left 24% (keeps the title readable) plus a radial ellipse centered at 54% x, 50% y, clear to 56% and darkening to about 66% black at the corners. In Studio drop it to 18% opacity.
- Optional, sparingly: a small lens flare or starburst where a beam enters glass (Prism Room has one).

## 10. Camera

- Vertical FOV 30 degrees. Hero framing per view: a target point, yaw slightly off axis (about −0.2 to 0.14 rad), pitch slightly elevated (about 0.03 to 0.12 rad), and a fit box (width, height in world units) that sets distance so the apparatus fills the space between the HUD columns.
- Idle drift: when the user is not interacting, yaw sways about ±0.025 rad on an 8 second sine. Stops instantly on input.
- Orbit freely all the way around in every view: yaw unbounded, pitch from just above level to nearly overhead, pan and zoom within each view's range. The camera never leaves its set: a room's bounds shorten the camera's distance instead of letting it pass through a wall, the floor or the ceiling. The room's front is the one opening: a camera that must stand farther back than the room is deep (a narrow screen's hero framing) stands outside it, and the front wall with its furniture cuts away while it does, like a stage. R resets to the hero shot along the shortest turn; W A S D and Q E fly for screenshots.
- View switch: veil fade about 0.4 s, preset swap, camera tween.
- Cinematic tour: it opens the exhibit and plays again on C (exhibit-design §11). A shot list in the Lab only: each shot has a camera pose, a slow move (about 1° to 3° a second: an arc, a track or a rise, never a static push), a hold of 8 to 10 s, and timed beats that change the exhibit state during the shot. It loops without a seam, stops on any input, and doubles as a video recorder for posts. Shot one is atmosphere, wide and slow with nothing changing; shot two comes closer and lower along the bench; then comes a close-up of each feature worth a look, its depth of field pulled to its subject (`focus`), performing the lesson; the payoff ends the loop. Between shots the screen fades to black and back in about a second, the camera moving throughout.
- Respect reduced motion: no idle drift, no auto-cinematic, instant view swaps.

## 11. Labels in the world

- A small dark pill anchored to a part: a colored status dot, a short bold name in the display sans, then a live value or state in mono, lowercase and terse. Examples of the grammar: "Light · 42° up", "Screen · 42 nm of color", "2nd prism · waiting", "Root tip · 82° off ↓", "Focus ring · drag ↕", "Image plane · upside down".
- Optional thin leader line from pill to part.
- A hint pill names a gesture, not a value: amber dot, "Drag the ring to turn it", "Click to lower it". It sits on the part, below the phenomenon so it never covers it, and shows only while a lesson step waits on that part.
- Toggle with Shift+N. Hidden with the rest of the UI on "/".
- The reference draws labels inside the 3D scene, so depth of field blurs some of them. (rec) Keep them crisp: anchor them in the world but render them in a layer that bypasses depth of field, and fade them by distance and occlusion instead.

## 12. Diegetic instruments

- Console screens with live charts drawn to a canvas texture: one trace in cyan with a soft glow, a white marker dot for the current state, a mono uppercase caption ("WHERE THE FAN POINTS"), an annotation at the interesting point ("least bend 67.1°"), coral shading for failure regimes ("trapped"). Size them as instruments, not monitors, inside law 1's attention budget.
- Filmstrip or small multiples: the outcome across a parameter or time (the lens's five photos at five focus distances with the current one ringed in cyan; the seedling at 0, 12, 24, 48 and 72 hours).
- Physical controls on the console that also work: knobs with an amber ring and cyan rotate arcs, dials with detents (click to jump to 32°, 42°, 55°), wheels, focus rings.
- Gauges and icons that show discrete settings: three iris blade icons for f/2, f/5.6, f/16.
- Loupe: a circular magnified inset placed in the scene near the part it explains, with a ring bezel and a label like "ROOT CAP ×40". If it is a drawing rather than a simulation, the help sheet says so.
- Counterfactual twin or ghost: a faint ghost of what would happen under the other condition, or a twin panel growing both cases side by side.

## 13. Motion

- Exponential smoothing or critically damped springs for every continuous value; presets tween over about 0.6 to 1.2 s; time-lapse runs at a declared rate (Root Finder: 40 minutes per second, slowing while the user turns the chamber).
- Hover tooltips on draggable parts in mono: "Drag to turn the prism", "Drag up or down to turn", "Drag through time". Non-interactive parts can carry an explanatory tooltip ("The image plane: every lens projects the world upside down").
- A themed loading line while shaders compile: "Cutting the glass…", "Sowing the seed…", "Polishing the glass…".
