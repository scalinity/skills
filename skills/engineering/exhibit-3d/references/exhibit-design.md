# Exhibit design: question, controls, truth, copy

How to turn a topic into an exhibit in the house style. The look is half of it; the other half is that every exhibit teaches one thing by letting you do the experiment.

## 1. The formula

One question → one apparatus → one hero phenomenon → two to four controls → three live numbers → three or four named setups → a lesson of three to five steps → one live sentence → one honest help sheet → three views → a cinematic tour that opens the exhibit.

If a topic needs more than that, cut scope or split it into two exhibits. Depth comes from fidelity (real constants, real geometry, a real mechanism shown in a loupe), not from more controls.

## 2. The hook

- **Question.** Phrase the one thing a curious adult should understand after ten minutes. "Why does white light split?" "How does a root know which way is down?" "Where exactly does a photo turn sharp?"
- **Title pair.** A kicker line and a big title line (see hud-spec §5 for the three split patterns). Short, concrete, slightly playful ("How roots know down").
- **Lede, two sentences.** Sentence one is the tension: a familiar experience, then the thing nobody has seen ("Everyone knows when a photo is blurry. Almost nobody has seen the exact plane where it turns sharp."), or a surprising fact ("Turn a seed sideways and its root still finds the way down."). Sentence two is two or three imperatives naming the controls, ending on "watch …" ("Turn the prism, tilt the light, then add a second prism to bring the colors home.").
- **Set sentence.** "[apparatus] in a [place] at [time]". Use it as the canvas `aria-label`, the page description and the art direction for the Lab set.
- **Loading line.** A themed verb phrase with an ellipsis: "Cutting the glass…", "Sowing the seed…".
- **Favicon.** One SVG drawing of the apparatus or its phenomenon, `public/favicon.svg`, linked from `index.html`: one or two flat shapes on a rounded navy tile (`#141a2a`), in the house colors (cyan `#7fe3ff` for light, amber `#ffb454` for brass), no text, no gradients, readable at 16 px. Two crossed filters on a beam that dims after the second; a beam stepping aside in a glass block. The tile carries its own background, so it reads on light and dark tab bars alike (Safari ignores `prefers-color-scheme` inside a favicon).

## 3. The apparatus

- Model the real instrument a scientist would use for this experiment, then exaggerate its scale for legibility: an optical bench with a lamp, a prism on a rotation stage and a screen; a soil chamber in a clinostat with brass wheels; a lens opened on a rail with its image plane.
- Add a console in front of or beside the apparatus with the diegetic displays and physical knobs.
- Finish the apparatus and the console on every side: the camera circles the room, so the back of the console (a service panel with vents, a cable, a small plate) is as finished as its front.
- Every part the user can move has a mechanical reason to move: a rotation stage, a carriage on a rail, a ring with gear teeth, a wheel.
- A part that can be taken out of the light path (a filter, a lens, a sample) parks where it reads as out from every view's camera: dropped below the beam or swung well aside, never just behind or in front of it, where it still overlaps the beam on screen.
- Decide the Exploded axis now: along which line do parts separate (the optical axis, the drive train)? Parts slide apart along it with even gaps and labels.

## 4. Parameters and controls

| Parameter kind | HUD control | In-scene control | Keys |
|---|---|---|---|
| Continuous (angle, distance, speed) | slider with ticks, live value in the label | drag the part; a console knob or dial with detents | `[` `]` nudge, Shift for coarse |
| Categorical (gravity 1 g / 0 g / clinostat; aperture f/2 / f/5.6 / f/16) | segmented | physical selector (iris ring, switch) | numbers or a letter, shown as a hint |
| Insert or remove (second prism waiting / in) | two-option segmented | click the part to slide it in | Shift+letter |
| Time | play, scrubber with ticks and event markers, speed 1× / 4× | wheel or crank if it fits | Space, `,` `.` step |
| View | segmented: Lab / Exploded / Studio (or Assembled / Exploded when the object is the subject) | — | Shift+V next, Shift+X exploded |

Rules:
- **Every parameter has at least three input paths**: drag the part in the scene, the console control, the HUD control, plus a key. The help sheet lists them ("Drag the prism, or the dial on the console, the card's slider, or `[` `]`").
- Dragging in the scene is the primary interaction. Show a hover tooltip and a cursor change, and say it in the lesson's first request and its hint pill on the part ("Drag the ring to turn it").
- Ranges are physical. Include the interesting regime (total internal reflection, stall, resonance) inside the range so presets can reach it.

## 5. Show me and let me try: presets and the lesson

The presets show the visitor a state; the lesson has the visitor make it. An exhibit has both.

**TRY presets (three or four)**
- Each preset is a named canonical state that demonstrates one named idea: Split, Least bend, Trapped, Rejoin. One or two words, a verb or a noun, said the way a teacher would.
- Number keys 1 to 4. Selecting a preset tweens every parameter to its state over about a second and rewrites the caption.
- Order them as a lesson: the basic effect, the special point, the failure regime, the reversal or surprise.

**The lesson (three to five steps, `kit/lesson`)** follows the same teaching order and ends on the law, named once in plain words.
- **Ask** for one action in one imperative sentence: "Drag the analyzer's brass ring partway round, to about 45°." It shows in bold in the caption. An amber hint pill names the gesture on the part itself ("Drag the ring to turn it"), placed below the phenomenon so it never covers it.
- **Check** the model's state, never the HUD: a range the visitor must reach, held for about half a second (`hold`), with the displayed values settled, so a drag passing through does not count. Every input path counts: the part, the console, the card, keys.
- **Answer** in one or two sentences that quote the visitor's own numbers and say what they caused: "At 45.0° the analyzer passes cos²θ = 0.500 of the light reaching it: 25.0% of the lamp." The answer and the next request share the caption.
- **Arrange** what a step needs in `enter`, with tweens, before it asks: lift a filter out, turn a part to a starting angle, so the check passes only by the visitor's hand.
- **Perform**: each step also says how the tour does it (`perform`), and the tour's shots play the steps as beats (`lesson.perform(i)`). The lesson is written once.
- It starts at the first input after the opening, from the lesson tool or L, and at once on a plain load with reduced motion. A preset ends it, since "show me" overrides "let me try"; so does the tour. The last answer stays at least 8 s, then until the live caption changes.
- The interface is the caption, the pills and the tool's pressed state, nothing more. Every control stays visible and working through every step.

## 6. Readouts and caption

- **Exactly three stats.** The quantities that change when you play: inputs you set (incidence), the main result (deviation), and the derived quantity that shows the idea (spread). Mark one as hot (cyan). Use semantic colors when a stat belongs to a colored object (root tip in cream, shoot tip in green).
- **World labels** repeat the most useful number at the part itself, terse and lowercase: "bends 67.1°", "42° up", "82° off ↓", "upside down", "waiting".
- **Caption** is one causal sentence with live numbers, colored by what they refer to. Pattern: [cause with real constants] so [effect with live values]. Reference example, paraphrased with placeholders: the glass slows violet more than red (n = 1.845 at 400 nm, 1.772 at 700 nm), so at {incidence} violet turns {violet deviation} and red only {red deviation}, where each placeholder is a live value in the matching color. Rewrite it per regime (normal, special point, failure, counterfactual).

## 7. Keyboard map (house convention)

| Key | Action |
|---|---|
| 1 2 3 4 | TRY presets (or categorical options when there are no presets) |
| `[` `]` | nudge the main parameter; `0` resets it |
| `,` `.` | the second parameter (or step time) |
| Space | play or pause time |
| Shift+letter | inserts and toggles (Shift+P second prism, Shift+F aperture) |
| Shift+V / Shift+X | next view / exploded |
| L | the lesson: start it, or end it |
| C | cinematic cameras |
| R | reset the camera |
| Shift+N | world labels |
| `/` | hide the interface |
| H | collapse or expand the controls (compact HUD) |
| Backspace | restart the sample (sow again) when the exhibit has a history |
| W A S D, Q E | fly the camera; drag orbit, right drag pan, scroll zoom |
| Cmd+' | render tuning panel |

Show key hints in group labels on wide screens; list all of them in the help sheet.

## 8. Help sheet (the "?" dialog)

Structure, in this order:
1. **h2** names the idea, not the app: "How the prism room works", "How a root knows down", "Where a photo turns sharp".
2. **What you are looking at**, one paragraph: the apparatus, what is simulated and at what fidelity ("Every ray on the bench is traced through the real glass, one color at a time: 24 wavelengths from 400 to 700 nm").
3. **Two to four mechanism sections**, each titled with an action or a question ("Why the colors split", "Turn the prism", "Tilt the light", "Bring the colors home", "Without a down"). Each says how to do it (all input paths), what you will see, and names the concept in bold the first time.
4. **The misconception section** when there is one ("Upside down?").
5. **What is exact and what is not**: the model and its sources, every approximation, every exaggeration and every piece of theatre, with factors ("root hairs three times longer", "time runs at 40 minutes a second", "the haze that makes the beam visible is theatre").
6. **Keys**: the full map as inline code chips. The kit writes one line under it in every exhibit: what reduced motion changes.
7. **Assumptions footnote** when numbers depend on a setup ("Numbers are for a 50 mm lens on a full-frame camera; the valley is about 60 cm away").

## 9. Truth rules

- Model first, pure functions, unit tested (see webgpu-stack §8). The renderer reads the model; the HUD reads the model; nothing is computed twice in two places.
- Use named, real data: a glass's Sellmeier coefficients from its manufacturer, typical growth rates for a named plant at a stated temperature, a stated lens and sensor.
- Every simplification is declared in the help sheet with its size. If a number on screen would be wrong for the real thing, either fix the model or label it as illustrative.
- Time-lapse and slow motion are declared with their rate. If the rate changes during interaction, say so.
- A loupe that is a drawing is called a drawing.

## 10. Diegetic displays, loupe, twins

- Pick one or two console screens that turn the state into a picture: a curve with the current state marked (deviation versus incidence with the minimum labeled), a distribution (the spectrum on the screen), a filmstrip (photos at five focus distances, the seedling hour by hour).
- Use a loupe when the real mechanism is too small to see (statoliths settling in a root cap at ×40, polymer chains in a polarizing film, electrons in a wire). Put it near the part, ring it, label the magnification.
- Use a counterfactual twin or ghost when the lesson is a comparison (Earth versus orbit; with and without the second prism).

## 11. The opening tour

The cinematic tour opens the exhibit. A plain first load (no address parameters, motion allowed) plays it with the control card and the corner buttons faded away; the title column stays as its title card and the caption narrates. A toast says how to take over ("Drag, click or press a key to take over"). The first input only takes over and goes no further, so it never turns a part seen from wherever the tour was: the screen dips to black for a moment and comes up on the hero framing in the exhibit's start state (shot one's `setup`), with the card back and the lesson asking for its first step. Reduced motion opens still, on the lesson's first step; `cinematic=0` or any address parameter that sets up a shot opens still. C or the tour tool plays it again later, with the card in place.

The tour stays in the Lab, where the exhibit lives, and loops. Every shot moves slowly, about 1° to 3° a second, on an arc, a track or a rise, never a static push.

- **Shot one is atmosphere**: wide and slow, an arc of 15° to 20° over 8 to 10 s, with nothing in the exhibit changing.
- **Shot two comes closer and lower**, still moving: a track along the bench at the height of the phenomenon, still before any demonstration.
- **Then a close-up of each feature worth a look**: the hero part, the loupe, each console screen, the background echo, 8 to 10 s each. Each close-up sets `focus` on its subject so the depth of field pulls to it. From the third shot on, beats perform the lesson's steps (`lesson.perform(i)`) and make each subject move: a sweep the screen's curve follows, a turn the loupe shows.
- **The last shot is the payoff**, low and slow. Then the tour loops: shot one's `setup` resets the exhibit while the screen is black, so the loop has no seam.
- Between shots the screen fades to black (0.4 s), stays black for an instant (0.15 s) and fades up on the next shot (0.5 s), while the camera keeps moving. Each move eases without coming to rest. Reduced motion keeps cuts and still poses.
- The tour stops on any input. This is also how promotional videos get recorded, so make the first ten seconds the best ten seconds.

## 12. Copy voice

- Plain words, short sentences, second person imperatives. A curious twelve year old can follow it; a physicist finds nothing wrong in it.
- Real numbers with units. Bold a technical term the first time and define it in the same sentence.
- Glyphs over words where the grammar is visual: ° × ↑ ↓ ↕ ↺ ↻ · —.
- American spelling by default (the reference uses British "colours"; don't copy that).
- No hype words, no exclamation marks, no emoji.

## 13. Originality

- The style is the house style; the content, code and assets are ours. Never copy code, text, models or images from the reference creator's site, and never put his name or handle in an exhibit. The maker plate and credit link carry Daniel's own mark.

## 14. EXHIBIT.md template (write this before any code)

```markdown
# EXHIBIT: <title>

Kicker / Title: … / …
Lede: <tension sentence> <imperatives ending in "watch …">
Question: …
Set sentence: <apparatus> in a <place> at <time>
Loading line: …
Favicon: <the drawing, in one line>

## Phenomenon and model
Hero (what glows): …
Model: equations, constants with sources, validity range, time scaling.
Invariants for tests: 3 to 6 properties that must hold (signs, limits, proportionalities, known special points).

## Parameters → controls
| Parameter | Range, default, unit | HUD control | Scene control | Console control | Keys |

## TRY presets
| # | Name | State | Demonstrates | Caption text |

## Lesson
| # | Ask | Hint pill (part, text) | Arrange first | Done when (model state, hold) | Answer (live values) | Tour performs |

## Readouts (3)
| Label | Unit | Formula | Hot? | Color |

## World labels
| Part | Name | Live value format |

## Diegetic displays, loupe, twin
…

## Views
Lab set: …  Exploded axis and spacing: …  Studio framing: …

## Cinematic shots (the opening, Lab only)
Shot 1 is atmosphere and shot 2 comes closer and lower; then a close-up per feature, performing the lesson; the payoff last. Shot 1's setup resets the exhibit for a seamless loop.
| # | Camera move | Hold | Focus | Setup (in the black) | Beats |

## Help sheet outline
h2, sections, misconception, exact / not exact, keys, assumptions footnote.

## Honesty list
Exact: …  Approximated (with size): …  Theatre: …
```
