// The exhibit's HUD as data, plus the caption writer. Copy the shape, not the content.

import type { ExhibitSchema } from '../kit/schema';
import { fmt } from '../kit/hud';
import { N_BK7, THICKNESS_CM, type Readouts, type SlabState } from '../model/slab';

export const PRESETS: { id: string; label: string; state: SlabState }[] = [
  { id: 'straight', label: 'Straight', state: { tilt: 0, slab: 'in' } },
  { id: 'tilted', label: 'Tilted', state: { tilt: 30, slab: 'in' } },
  { id: 'steep', label: 'Steep', state: { tilt: 60, slab: 'in' } },
  { id: 'out', label: 'Slab out', state: { tilt: 30, slab: 'out' } },
];

export const schema: ExhibitSchema = {
  id: 'glass-slab',
  brand: {
    kicker: 'Why the beam steps aside',
    title: 'Glass slab',
    lede: 'A tilted block of glass moves a beam without turning it. Tilt the slab, slide it out, and watch the beam step sideways and leave parallel.',
  },
  setSentence: 'A glass block on a rotation stage in a study at dusk: a lamp, a slab of crown glass and a target, with a beam that steps sideways in the glass.',
  loading: 'Polishing the slab…',
  stats: [
    { id: 'tilt', label: 'Tilt', unit: '' },
    { id: 'inside', label: 'Inside', unit: '' },
    { id: 'shift', label: 'Shift', unit: 'cm', hot: true },
  ],
  presets: PRESETS.map(({ id, label }) => ({ id, label })),
  controls: [
    [
      {
        kind: 'slider', id: 'tilt', label: 'Tilt', min: -60, max: 60, step: 0.5, coarse: 5, value: 30, signed: true,
        ticks: [-60, -30, 0, 30, 60], keyHint: '[ ]',
        format: (v) => fmt.angle(v, { signed: true }), valueText: (v) => `${v.toFixed(1)} degrees`,
      },
      {
        kind: 'segmented', id: 'slab', label: 'Slab', keyHint: '⇧S', value: 'in',
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
    { keys: ['[', ']'], does: 'Tilt the slab 0.5° (Shift: 5°)' },
    { keys: ['0'], does: 'Square the slab to the beam' },
    { keys: ['Shift+S'], does: 'Slide the slab in or out' },
    { keys: ['Shift+V', 'Shift+X'], does: 'Next view, exploded view' },
    { keys: ['C'], does: 'Cinematic tour, the one the exhibit opens with' },
    { keys: ['R'], does: 'Reset the camera' },
    { keys: ['Shift+N'], does: 'Labels on or off' },
    { keys: ['H'], does: 'Collapse or expand the controls' },
    { keys: ['/'], does: 'Hide the interface' },
    { keys: ['W', 'A', 'S', 'D', 'Q', 'E'], does: 'Fly the camera; drag to orbit, right-drag to pan, scroll to zoom' },
    { keys: ["Cmd+'"], does: 'Render tuning panel' },
  ],
  help: {
    h2: 'Why a slab shifts a beam',
    intro: `A lamp sends a beam along the bench through a ${THICKNESS_CM} cm block of N-BK7 crown glass on a rotation stage. The path is traced with **Snell's law** at both faces, using the glass's real index, n = ${N_BK7}.`,
    sections: [
      {
        h3: 'Tilt the slab',
        body: [
          'Drag the slab, turn the brass knob on the console, use the card\'s slider, or press `[` `]`. Light slows in glass, so where it meets a tilted face it bends toward the face\'s **normal**, the line square to the surface.',
        ],
      },
      {
        h3: 'Why it leaves parallel',
        body: [
          'The two faces are parallel, so the bend on the way out exactly undoes the bend on the way in. The beam leaves in its old direction, moved sideways by the **lateral shift**, which grows with the tilt and the thickness.',
        ],
      },
    ],
    exact: {
      h3: 'What is exact and what is not',
      body: [
        `**Exact:** Snell's law at both faces with n = ${N_BK7} (N-BK7 at 587.6 nm), and the shift d = t sin(θ − θt) / cos θt.`,
        '**Not modeled:** reflection at each face (about 4% near square-on, more when steep) and dispersion (the index changes by about 1% across visible colors, which would split a white beam very slightly).',
        '**Theatre:** a real beam is invisible in clean air; the glow here is drawn. The loupe is a drawing; its wavefront spacing uses the real ratio of 1 to 1.517.',
      ],
    },
    footnote: `Numbers are for a ${THICKNESS_CM} cm block; the shift scales with thickness.`,
  },
  credit: { label: 'Daniel Escalante', href: 'https://github.com/scalinity' },
};

/** One causal sentence per regime, live numbers colored like the thing they describe. */
export function caption(s: SlabState, r: Readouts): string {
  if (s.slab === 'out') return 'With the slab out, the beam runs straight to the target. Slide it in to see the step.';
  if (Math.abs(s.tilt) < 0.25) return 'Square on, the light enters along the face\'s normal, so it does not bend and the beam {cyan:does not move}.';
  const shift = fmt.num(Math.abs(r.shift), 1, 'cm');
  if (Math.abs(s.tilt) > 50) {
    return `Near grazing, the path through the glass is long and steep, so the beam steps a full {cyan:${shift}} to the side.`;
  }
  return `Glass slows light (n = ${N_BK7}), so at {amber:${fmt.angle(Math.abs(s.tilt))}} the beam bends to {cyan:${fmt.angle(Math.abs(r.inside ?? 0))}} inside, then bends back and leaves {cyan:${shift}} to the side, still parallel.`;
}
