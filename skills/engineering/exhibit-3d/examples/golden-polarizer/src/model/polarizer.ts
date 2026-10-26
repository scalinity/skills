// The polarizer bench: ideal sheet polarizers and Malus's law. Pure TypeScript, no three imports.
// Every number on screen comes from read().

/** Lamp intensity in percent. The lamp's light is unpolarized. */
export const LAMP = 100;
/** The first filter's transmission axis, degrees from vertical. It does not turn. */
export const POLARIZER_AXIS = 0;
export const ANGLE_MIN = 0;
export const ANGLE_MAX = 180;

export interface BenchState {
  /** Analyzer transmission axis, degrees from vertical. */
  analyzer: number;
  middle: 'out' | 'in';
  /** Middle filter transmission axis, degrees from vertical. */
  middleAngle: number;
}

export const DEFAULT_STATE: BenchState = { analyzer: 0, middle: 'out', middleAngle: 45 };

const rad = (d: number) => (d * Math.PI) / 180;

/** Malus's law (1809): light left after an ideal polarizer turned Δ from the light's polarization. */
export function malus(intensity: number, deltaDeg: number): number {
  const c = Math.cos(rad(deltaDeg));
  return intensity * c * c;
}

/**
 * Unpolarized light left after a stack of ideal polarizers, axes in the order the light meets them:
 * the first keeps half, each next one passes cos² of its turn from the one before. The window discs
 * in the Lab (the echo) follow it.
 */
export function discTransmission(axes: number[]): number {
  if (axes.length === 0) return 1;
  let t = 0.5;
  for (let i = 1; i < axes.length; i++) t = malus(t, axes[i] - axes[i - 1]);
  return t;
}

/** An angle folded into [0°, 180°): a polarizer's axis has no head or tail. */
export function axisAngle(deg: number): number {
  return ((deg % 180) + 180) % 180;
}

export interface Reading {
  /** Analyzer angle relative to the polarizer, degrees (0 to 180 over the analyzer's range). */
  angle: number;
  /** The cos² product the filters after the first one apply. */
  factor: number;
  /** Percent of the lamp reaching the meter. */
  through: number;
  /** Percent of the lamp after each element (null when the middle filter is out). */
  stages: { lamp: number; afterPolarizer: number; afterMiddle: number | null; afterAnalyzer: number };
  /** Polarization direction after each element, degrees from vertical (null: unpolarized or absent). */
  planes: { lamp: null; afterPolarizer: number; afterMiddle: number | null; afterAnalyzer: number };
}

export function read(s: BenchState): Reading {
  const afterPolarizer = LAMP / 2;
  const middleIn = s.middle === 'in';
  const afterMiddle = middleIn ? malus(afterPolarizer, s.middleAngle - POLARIZER_AXIS) : null;
  const incoming = afterMiddle ?? afterPolarizer;
  const incomingPlane = middleIn ? s.middleAngle : POLARIZER_AXIS;
  const afterAnalyzer = malus(incoming, s.analyzer - incomingPlane);
  return {
    angle: s.analyzer - POLARIZER_AXIS,
    factor: afterAnalyzer / afterPolarizer,
    through: afterAnalyzer,
    stages: { lamp: LAMP, afterPolarizer, afterMiddle, afterAnalyzer },
    planes: { lamp: null, afterPolarizer: POLARIZER_AXIS, afterMiddle: middleIn ? s.middleAngle : null, afterAnalyzer: s.analyzer },
  };
}

/** Light through, percent of the lamp, as the analyzer turns (the console chart). */
export function throughAt(analyzer: number, middleAngle: number | null): number {
  return read({ analyzer, middle: middleAngle === null ? 'out' : 'in', middleAngle: middleAngle ?? 0 }).through;
}

/** Field amplitude relative to the lamp's (I ∝ E², so E ∝ √I), for drawing the field trace. */
export function amplitude(intensity: number): number {
  return Math.sqrt(Math.max(0, intensity) / LAMP);
}
