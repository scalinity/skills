# EXHIBIT: Glass slab

Kicker / Title: Why the beam steps aside / Glass slab
Lede: A tilted block of glass moves a beam without turning it. Tilt the slab, slide it out, and watch the beam step sideways and leave parallel.
Question: Why does a tilted block of glass move a beam sideways without changing its direction?
Set sentence: A glass block on a rotation stage in a study at dusk: a lamp, a slab of crown glass and a target, with a beam that steps sideways in the glass.
Loading line: Polishing the slab…
Favicon: a glass block with a cyan beam stepping aside through it, on the navy tile (`public/favicon.svg`).

## Phenomenon and model
Hero (what glows): the lamp's beam, an HDR ribbon traced through the block, and its spot on the target.
Model: Snell's law at both faces, sin θ = n sin θt, with n = 1.5168 (SCHOTT N-BK7 data sheet, 587.6 nm). Lateral shift d = t sin(θ − θt) / cos θt for a block t = 10 cm thick. Valid for tilts within ±60°. No time scaling.
Invariants for tests: no shift square-on; Snell holds at the entry face; the shift is odd in tilt; it grows with tilt and stays below t; 45° gives 3.345 cm; the beam leaves parallel to how it entered.

## Parameters → controls
| Parameter | Range, default, unit | HUD control | Scene control | Console control | Keys |
|---|---|---|---|---|---|
| Tilt | −60 to 60, 30, ° | slider, ticks at −60, −30, 0, 30, 60 | drag the slab | brass knob, 3 turns of knob per turn of stage | `[` `]` (Shift: 5°), `0` |
| Slab | Out / In, In | segmented | — | — | Shift+S |
| View | Lab / Exploded / Studio | segmented | — | — | Shift+V, Shift+X |

## TRY presets
| # | Name | State | Demonstrates | Caption text |
|---|---|---|---|---|
| 1 | Straight | 0°, in | square-on light does not bend | "Square on, the light enters along the face's normal, so it does not bend and the beam does not move." |
| 2 | Tilted | 30°, in | the step: 19.25° inside, 1.976 cm aside | "Glass slows light (n = 1.5168), so at 30.0° the beam bends to 19.2° inside, then bends back and leaves 2.0 cm to the side, still parallel." |
| 3 | Steep | 60°, in | near grazing the step grows: 5.183 cm | "Near grazing, the path through the glass is long and steep, so the beam steps a full 5.2 cm to the side." |
| 4 | Slab out | 30°, out | no glass, no step | "With the slab out, the beam runs straight to the target. Slide it in to see the step." |

## Lesson
| # | Ask | Hint pill (part, text) | Arrange first | Done when (model state, hold) | Answer (live values) | Tour performs |
|---|---|---|---|---|---|---|
| 1 | "Drag the slab to tilt it." | the slab, below the beam: "Drag the slab to tilt it" | Straight: 0°, in | in, \|tilt\| ≥ 20°, settled, 0.5 s | "Tilted {tilt}, the beam bends to {inside} inside the glass and leaves parallel, {shift} aside." | tilt to 30° |
| 2 | "Tilt it further, past 50°." | the same pill | — | in, \|tilt\| ≥ 50°, settled, 0.5 s | "At {tilt} it steps {shift} aside: the steeper the slab, the longer the path through the glass." | tilt to 60° |
| 3 | "Now slide the slab out of the beam." | the slab: "Shift+S slides it out" | — | out, 0.3 s | "Without the glass the beam runs straight, {shift} aside. Its two bends were equal and opposite, so it kept its direction and only its place moved: that is refraction at both faces." | slab out |

## Readouts (3)
| Label | Unit | Formula | Hot? | Color |
|---|---|---|---|---|
| TILT | ° | state.tilt | no | white |
| INSIDE | ° | θt = asin(sin θ / n) | no | white |
| SHIFT | cm | t sin(θ − θt) / cos θt | yes | cyan |

## World labels
| Part | Name | Live value format |
|---|---|---|
| Lamp | Lamp | "white" |
| Slab | Slab | "bends 19.2°" or "out" |
| Target | Target | "2.0 cm aside" |

## Diegetic displays, loupe, twin
Console screen: sideways step against tilt from −60° to 60°, a white marker at the current tilt with its value. Loupe "WAVEFRONTS ×20,000": a drawing; wavefront spacing shrinks by 1 : 1.517 in the glass and the fronts turn by the refraction angle. No twin.

## Views
Lab set: a study at dusk; echo: glass blocks and a prism on the top shelf. Exploded axis: the beam axis (x); lamp and target slide 26 cm out from the stage. Studio framing: three-quarter from the right on the paper sweep.

## Cinematic shots (the opening, Lab only)
Shot 1 is atmosphere and shot 2 comes closer and lower; then a close-up per feature, performing the lesson; the payoff last. Shot 1's setup resets the bench for a seamless loop. Fades through black between shots.
| # | Camera move | Hold | Focus | Setup (in the black) | Beats |
|---|---|---|---|---|---|
| 1 | wide, a 17° arc from the hero side | 9 s | the beam | Straight | none |
| 2 | low along the rail from the lamp end, tracking 4 units | 9 s | the beam | — | none |
| 3 | arc round the slab | 10 s | the slab | — | lesson steps 1 and 2 at 1 and 5 s: tilted, then steep |
| 4 | arc round the loupe | 9 s | the loupe | — | tilt to 50°: the wavefronts crowd and turn |
| 5 | low, slow arc: the payoff | 10 s | the beam | Tilted | lesson step 3 at 3 s: the slab slides out, the beam runs straight |

## Help sheet outline
h2 "Why a slab shifts a beam"; What you are looking at; Tilt the slab; Why it leaves parallel; What is exact and what is not; Keys; footnote on thickness.

## Honesty list
Exact: Snell's law with n = 1.5168, d = t sin(θ − θt) / cos θt.  Approximated (with size): no reflection losses (about 4% per face square-on, more when steep); no dispersion (the index varies about 1% across visible colors).  Theatre: the visible beam; the loupe is a drawing (its spacing ratio is real).
