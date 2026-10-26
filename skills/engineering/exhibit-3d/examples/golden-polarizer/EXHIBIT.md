# EXHIBIT: Polarizer bench

Kicker / Title: Why two filters go dark / Polarizer bench
Lede: Two gray filters pass light until you turn one a quarter turn, and then almost nothing gets through. Turn the analyzer, slip a third filter between them, and watch light come back out of the dark.
Question: Why does turning one filter make the light vanish, and how can adding a filter bring it back?
Set sentence: A polarization bench in an optics workshop at dusk: a lamp, filters on brass rotation mounts and a light meter, with a beam that dims at every filter.
Loading line: Aligning the filters…
Favicon: two amber filter rings on a cyan beam that dims after the second, on the navy tile (`public/favicon.svg`).

## Phenomenon and model
Hero (what glows): the beam, an HDR ribbon whose brightness after each filter equals the model's intensity; a thin cyan trace of the electric field's oscillation (many orientations before the polarizer, one plane after each filter, along that filter's axis, amplitude ∝ √I); the meter spot glowing at the final intensity.
Model: ideal filters, declared. The lamp is unpolarized, I₀ = 100%. After the polarizer (axis 0°, vertical): I₀/2. After each later filter at relative angle Δθ: I = I_prev · cos²Δθ (Malus's law, 1809). With the middle filter at φ and the analyzer at θ: I = (I₀/2) · cos²φ · cos²(θ − φ). Angles are measured from vertical. No time scaling.
Invariants for tests: I(θ) = I(θ + 180°); analyzer at 0° gives 50% of the lamp; at 90° gives 0; at 45° gives 25%; three filters at 0°, 45°, 90° give 12.5%; a middle filter at 0° or 90° with a crossed analyzer gives 0; intensity falls monotonically from 0° to 90°.

## Parameters → controls
| Parameter | Range, default, unit | HUD control | Scene control | Console control | Keys |
|---|---|---|---|---|---|
| Analyzer angle θ | 0 to 180, 0, ° from vertical | slider, ticks at 0, 45, 90, 135, 180 | drag the analyzer's brass ring | analyzer knob | `[` `]` (Shift: 5°), `0` |
| Middle filter | Out / In, Out | segmented | click its mount to lower it in or lift it out | — | Shift+M |
| Middle angle φ | 0 to 180, 45, ° | slider, enabled when In | drag its brass ring | — | `,` `.` (Shift: 5°) |
| View | Lab / Exploded / Studio | segmented | — | — | Shift+V, Shift+X |

## TRY presets
| # | Name | State | Demonstrates | Caption text |
|---|---|---|---|---|
| 1 | Aligned | θ 0°, middle out | a polarizer keeps half; an aligned analyzer keeps all of that | "The polarizer keeps only the vertical half of the lamp's light, 50%; the analyzer is aligned with it, so all of that gets through." |
| 2 | Half | θ 45°, middle out | Malus's law: cos² 45° = 0.5 | "The analyzer is turned 45.0° from the polarizer, so it passes cos²θ = 0.500 of what reaches it: 25.0% of the lamp." |
| 3 | Crossed | θ 90°, middle out | crossed filters block everything | "Crossed at 90.0°, the analyzer only passes oscillation the polarizer already removed, so 0.0% of the lamp gets through." |
| 4 | Sneak through | θ 90°, middle in at 45° | a third filter brings light back | "The middle filter at 45.0° passes half the polarized light along a new direction, and the analyzer passes half of that again: 12.5% of the lamp comes out of the dark." |

## Lesson
| # | Ask | Hint pill (part, text) | Arrange first | Done when (model state, hold) | Answer (live values) | Tour performs |
|---|---|---|---|---|---|---|
| 1 | "Drag the analyzer's brass ring partway round, to about 45°." | analyzer, below the ring: "Drag the ring to turn it" | Aligned: θ 0°, middle out | 20° ≤ θ ≤ 70°, settled, 0.5 s | "At {θ} the analyzer passes cos²θ = {factor} of the light reaching it: {through} of the lamp." | θ to 45° |
| 2 | "Keep turning until the meter reads zero." | the same pill | — | through < 0.05%, settled, 0.8 s | "The meter reads {through} at {θ}: crossed, the analyzer passes only oscillation the polarizer already removed." | θ to 90° over 5 s |
| 3 | "Now click the middle filter to lower it into the beam." | the middle filter's carriage shoe, below the beam: "Click to lower it" | φ to 15° while lifted, so the light let back is faint | middle in, settled, 0.3 s | "A third filter at {φ}, and {through} of the lamp gets through two crossed filters." | middle in at 15° |
| 4 | "Turn the middle filter to find where the most light gets through." | the middle filter, below its ring: "Drag its ring to turn it" | — | middle in, through ≥ 12.3%, settled, 0.6 s | "You found {through} at {φ}. Each filter passes cos² of its turn from the one before, so at 45° each keeps half: that is Malus's law, once per filter." | φ to 45° over 2.5 s |

## Readouts (3)
| Label | Unit | Formula | Hot? | Color |
|---|---|---|---|---|
| ANGLE | ° | θ − 0° (analyzer relative to the polarizer) | no | white |
| FACTOR | none | cos²θ, or cos²φ · cos²(θ − φ) with the middle filter in | no | white |
| THROUGH | % of lamp | 50% × FACTOR | yes | cyan |

## World labels
| Part | Name | Live value format |
|---|---|---|
| Lamp | Lamp | "unpolarized" |
| Polarizer | Polarizer | "0°" |
| Middle filter | Middle filter | "45°" or "out" |
| Analyzer | Analyzer | "90°" |
| Meter | Meter | "12.5% of lamp" |

## Diegetic displays, loupe, twin
Console screen 1: the Malus curve, light through against the analyzer angle from 0° to 180°, a white marker at the current angle, a coral band around crossed ("dark"); with the middle filter in, the three-filter curve at the current φ in cyan and the two-filter curve as a faint ghost (the counterfactual). Console screen 2: the meter as a large mono percentage with a bar. Analyzer knob with an amber ring and a cyan arc for the angle. Loupe "POLARIZING FILM ×20,000" by the analyzer: a drawing of stretched polymer chains turned with the analyzer; incoming field arrows split into a part along the chains (absorbed, shrinking) and a part across them (passing).

## Views
Lab set: an optics workshop at dusk; echo: large polarizer discs hung in the window like a mobile, shading the window light with the same law, dark where two cross; one disc turns once every two minutes. Exploded axis: the beam axis (x); lamp, filters and meter spread to even 4.5-unit gaps on the plinth. Studio framing: three-quarter from the right, the rail on paper.

## Cinematic shots (the opening, Lab only)
Shot 1 is atmosphere and shot 2 comes closer and lower; then a close-up per feature, performing the lesson; the payoff last. Shot 1's setup resets the bench for a seamless loop. Fades through black between shots.
| # | Camera move | Hold | Focus | Setup (in the black) | Beats |
|---|---|---|---|---|---|
| 1 | wide, a 17° arc from the hero side | 9 s | the beam | Aligned | none |
| 2 | low along the bench from the lamp end, the beam at eye level, tracking 4 units | 9 s | the beam | — | none |
| 3 | arc round the analyzer | 10 s | the analyzer | — | lesson steps 1 and 2 at 1 and 4.5 s: half the light, then none |
| 4 | arc round the loupe | 9 s | the loupe | — | θ to 30°, then to 75° over 6 s: the chains turn |
| 5 | track along the console's two screens | 10 s | the screens | — | θ to 0°, then a half turn to 180° over 8 s: the marker rides the curve, the meter counts |
| 6 | over the bench to the window's discs, rising as it pushes in | 9 s | the window | — | none: the discs shade the window by themselves |
| 7 | low, slow arc: the payoff | 11 s | the beam | Crossed | lesson steps 3 and 4 at 1.5 and 4.5 s: the middle filter lowered and turned, light back |

## Help sheet outline
h2 "Why two filters go dark"; What you are looking at; What a polarizer keeps; Turn the analyzer; Bring the light back; Where you have seen this; What is exact and what is not; Keys; footnote: angles from vertical, percentages of the lamp.

## Honesty list
Exact: Malus's law for ideal filters; every number on screen follows I = (I₀/2) · cos²φ · cos²(θ − φ).  Approximated (with size): real sheet polarizers are not ideal: an HN38-type sheet passes 38% of unpolarized light (not 50%), an aligned pair 30%, and a crossed pair still leaks 0.033%, more in deep blue (Knight Optical POL-HN38-R data sheet).  Theatre: the visible beam (a real beam is invisible in clean air); the cyan field trace (its wavelength is drawn about a million times longer than light's, and slowed); the loupe is a drawing (real chains are nanometers apart).
