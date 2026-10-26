// The Polarizer bench HUD as data, plus the caption writer.

import type { ExhibitSchema } from '../kit/schema';
import { fmt } from '../kit/hud';
import type { BenchState, Reading } from '../model/polarizer';

export const PRESETS: { id: string; label: string; state: BenchState }[] = [
  { id: 'aligned', label: 'Aligned', state: { analyzer: 0, middle: 'out', middleAngle: 45 } },
  { id: 'half', label: 'Half', state: { analyzer: 45, middle: 'out', middleAngle: 45 } },
  { id: 'crossed', label: 'Crossed', state: { analyzer: 90, middle: 'out', middleAngle: 45 } },
  { id: 'sneak', label: 'Sneak through', state: { analyzer: 90, middle: 'in', middleAngle: 45 } },
];

const angleFmt = (v: number) => fmt.angle(v);
const spoken = (v: number) => `${v.toFixed(1)} degrees from vertical`;

export const schema: ExhibitSchema = {
  id: 'polarizer-bench',
  brand: {
    kicker: 'Why two filters go dark',
    title: 'Polarizer bench',
    lede: 'Two gray filters pass light until you turn one a quarter turn, and then almost nothing gets through. Turn the analyzer, slip a third filter between them, and watch light come back out of the dark.',
  },
  setSentence: 'A polarization bench in an optics workshop at dusk: a lamp, filters on brass rotation mounts and a light meter, with a beam that dims at every filter.',
  loading: 'Aligning the filters…',
  stats: [
    { id: 'angle', label: 'Angle', color: 'amber' },
    { id: 'factor', label: 'Factor' },
    { id: 'through', label: 'Through', hot: true },
  ],
  presets: PRESETS.map(({ id, label }) => ({ id, label })),
  controls: [
    [
      {
        kind: 'slider', id: 'analyzer', label: 'Analyzer', min: 0, max: 180, step: 0.5, coarse: 5, value: 0,
        ticks: [0, 45, 90, 135, 180], keyHint: '[ ]', format: angleFmt, valueText: spoken,
      },
      {
        kind: 'slider', id: 'middleAngle', label: 'Middle angle', min: 0, max: 180, step: 0.5, coarse: 5, value: 45,
        ticks: [0, 45, 90, 135, 180], keyHint: ', .', format: angleFmt, valueText: spoken, disabled: true,
      },
    ],
    [
      {
        kind: 'segmented', id: 'middle', label: 'Middle filter', keyHint: '⇧M', value: 'out',
        options: [{ value: 'out', label: 'Out' }, { value: 'in', label: 'In' }],
      },
    ],
  ],
  views: ['lab', 'exploded', 'studio'],
  tools: [
    { id: 'lesson', label: 'Try it step by step (L)', icon: 'lesson', toggle: true },
    { id: 'cinematic', label: 'Play the cinematic tour (C)', icon: 'camera', toggle: true },
    { id: 'labels', label: 'Show or hide the labels (Shift+N)', icon: 'labels', toggle: true },
    { id: 'help', label: 'How it works', icon: 'help' },
  ],
  keys: [
    { keys: ['1', '2', '3', '4'], does: 'Try a setup' },
    { keys: ['L'], does: 'Try it step by step: each step waits until you have done it' },
    { keys: ['[', ']'], does: 'Turn the analyzer 1° (Shift: 5°)' },
    { keys: ['0'], does: 'Align the analyzer with the polarizer' },
    { keys: ['Shift+M'], does: 'Lower the middle filter in or lift it out' },
    { keys: [',', '.'], does: 'Turn the middle filter 1° (Shift: 5°)' },
    { keys: ['Shift+V', 'Shift+X'], does: 'Next view, exploded view' },
    { keys: ['C'], does: 'Cinematic tour, the one the exhibit opens with' },
    { keys: ['R'], does: 'Reset the camera' },
    { keys: ['Shift+N'], does: 'Labels on or off' },
    { keys: ['/'], does: 'Hide the interface' },
    { keys: ['H'], does: 'Collapse or expand the controls' },
    { keys: ['W', 'A', 'S', 'D', 'Q', 'E'], does: 'Fly the camera; drag to orbit, right-drag to pan, scroll to zoom' },
    { keys: ["Cmd+'"], does: 'Render tuning panel' },
  ],
  help: {
    h2: 'Why two filters go dark',
    intro: 'A lamp sends unpolarized light along an optical rail, through two sheet polarizers in brass rotation mounts and into a light meter. The first, the **polarizer**, stays fixed with its axis vertical; the second, the **analyzer**, is the one you turn. A third filter waits beside the rail. Every number comes from Malus\'s law for ideal filters, and the beam after each filter is drawn at that intensity.',
    sections: [
      {
        h3: 'What a polarizer keeps',
        body: [
          'Light is a wave whose electric field oscillates across the beam. Lamp light is **unpolarized**: the direction of its oscillation changes at random, far faster than anything could follow. A sheet polarizer passes only the part of the oscillation along its **transmission axis** and absorbs the rest, so on average it keeps exactly half. The beam leaves at 50% of the lamp, oscillating in one plane. The cyan trace shows it: a shimmer of directions before the polarizer, one vertical plane after it.',
        ],
      },
      {
        h3: 'Turn the analyzer',
        body: [
          'Drag the analyzer\'s brass ring, turn the knob on the console, use the card\'s slider, or press `[` `]` (Shift for 5°). The analyzer passes the part of the arriving field along its own axis: the field times cos θ. Intensity goes as the field squared, so the light through is cos²θ of what arrives. That is **Malus\'s law**. At 45° the analyzer passes half (25% of the lamp); at 90°, **crossed**, it passes nothing.',
        ],
      },
      {
        h3: 'Bring the light back',
        body: [
          'Slide the middle filter in by clicking its mount, using the card, or pressing Shift+M; turn it with its ring or `,` `.`. With the analyzer crossed, a middle filter at 45° lets 12.5% of the lamp through. Nothing is added: every filter only removes light. The middle filter turns the plane of what remains to 45°, and the analyzer, now only 45° away, passes half of that again: 50% × cos²45° × cos²45° = 12.5%. Turn the middle filter to 0° or 90° and the dark returns.',
        ],
      },
      {
        h3: 'Where you have seen this',
        body: [
          'Glare off water and wet roads is mostly polarized horizontally. Water\'s refractive index is 1.33 (CRC Handbook of Chemistry and Physics: 1.333 at 20 °C for yellow light), so its **Brewster\'s angle** is arctan 1.33 = 53° from the vertical: for sunlight arriving 37° above the horizon, the reflection is polarized completely. Polarized sunglasses have a vertical transmission axis, so they block that glare like a crossed analyzer. An LCD screen sends its light out through a polarizer of its own: tilt a phone while wearing polarized sunglasses and the screen can go dark.',
        ],
      },
    ],
    exact: {
      h3: 'What is exact and what is not',
      body: [
        '**Exact:** Malus\'s law for ideal filters. Every number on screen follows I = ½ I₀ · cos²φ · cos²(θ − φ), with the middle filter at φ and the analyzer at θ. The discs hanging in the window are ideal polarizers too: where two cross, their overlap goes dark, and where a third sits between them at 45°, an eighth of the window light comes back.',
        '**Ideal, unlike real sheets:** real sheet polarizers absorb some light along their axis and leak a little across it. Most pass 32 to 42% of unpolarized light; the number in names like HN38 is that figure. One HN38-type sheet (Knight Optical POL-HN38-R data sheet) passes 38% instead of 50%, an aligned pair 30%, and a crossed pair still 0.033%, more in deep blue. Those figures are averages over the visible spectrum, so they do not multiply out: if every color behaved alike, 38% alone would predict 28.9% for an aligned pair, but the sheet\'s transmission varies with color, and the average of the squares is always more than the square of the average.',
        '**Theatre:** a real beam is invisible in clean air; the glow is drawn. Its brightness follows the intensity and its width the field amplitude (√I), so each filter\'s step reads at a glance, and each film glows where the beam crosses it, at about a quarter of the beam\'s own brightness, far more than a real sheet scatters. The cyan trace draws green light\'s 550 nm wave 8 cm long, about 150,000 times its real length, and slows it about 10¹⁵ times: one swing every 1.6 s instead of every 1.8 femtoseconds. The loupe is a drawing: real polymer chains lie a few nanometers apart, far finer than any ×20,000 view could show.',
      ],
    },
    footnote: 'Angles are measured from vertical, the polarizer\'s axis. Percentages are of the lamp\'s output.',
  },
  semanticColors: {},
  credit: { label: 'Daniel Escalante', href: 'https://github.com/scalinity' },
};

/** One causal sentence per regime; live numbers in the color of what they describe. */
export function caption(s: BenchState, r: Reading): string {
  const through = fmt.percent(r.through);
  if (s.middle === 'in') {
    const rel = Math.abs(((s.analyzer - s.middleAngle + 90) % 180 + 180) % 180 - 90);
    const cos2 = (deg: number) => Math.cos((deg * Math.PI) / 180) ** 2;
    const keepMiddle = cos2(s.middleAngle);
    if (r.through < 0.05) {
      return keepMiddle < 0.001
        ? `The middle filter at {amber:${fmt.angle(s.middleAngle)}} is crossed with the polarizer and passes nothing, so the meter reads {cyan:${through}}.`
        : `The middle filter at {amber:${fmt.angle(s.middleAngle)}} passes {text:${fmt.num(keepMiddle, 3)}}, but the analyzer is crossed with it, so the meter reads {cyan:${through}}.`;
    }
    return `The middle filter at {amber:${fmt.angle(s.middleAngle)}} keeps {text:${fmt.num(keepMiddle, 3)}} and turns the plane; the analyzer, {amber:${fmt.angle(rel)}} from it, keeps {text:${fmt.num(cos2(rel), 3)}} of that: {text:${fmt.num(r.factor, 3)}} in all, {cyan:${through}} of the lamp.`;
  }
  if (r.angle < 0.25 || r.angle > 179.75) {
    return `The polarizer keeps only the {cyan:vertical} half of the lamp's light, {cyan:50.0%}; the analyzer is aligned with it, so all of that gets through.`;
  }
  if (Math.abs(r.angle - 90) < 0.25) {
    return `Crossed at {amber:${fmt.angle(r.angle)}}, the analyzer only passes oscillation the polarizer already removed, so {cyan:${through}} of the lamp gets through.`;
  }
  return `The analyzer is turned {amber:${fmt.angle(r.angle)}} from the polarizer, so it passes cos²θ = {text:${fmt.num(r.factor, 3)}} of what reaches it: {cyan:${through}} of the lamp.`;
}
