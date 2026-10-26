// Sample model: a beam through a tilted glass block. Pure TypeScript, no three imports.
// Every number the exhibit shows comes from here.

/** N-BK7 refractive index at the helium d line, 587.6 nm (SCHOTT N-BK7 data sheet). */
export const N_BK7 = 1.5168;
/** Block thickness between its two faces, cm. */
export const THICKNESS_CM = 10;
export const TILT_MIN = -60;
export const TILT_MAX = 60;

export interface SlabState {
  /** Rotation of the block about the vertical axis, degrees. 0 = faces square to the beam. */
  tilt: number;
  slab: 'in' | 'out';
}

export const DEFAULT_STATE: SlabState = { tilt: 30, slab: 'in' };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Angle of the ray inside the glass from the face normal (Snell: sin θ = n sin θt). Degrees, signed like tilt. */
export function insideAngle(tilt: number, n = N_BK7): number {
  return deg(Math.asin(Math.sin(rad(tilt)) / n));
}

/** Sideways step between the entering and the leaving beam, cm: d = t sin(θ − θt) / cos θt. */
export function lateralShift(tilt: number, n = N_BK7, t = THICKNESS_CM): number {
  const ti = rad(tilt);
  const tt = Math.asin(Math.sin(ti) / n);
  return (t * Math.sin(ti - tt)) / Math.cos(tt);
}

export interface Readouts {
  tilt: number;
  /** Refraction angle inside the glass; null when the slab is out. */
  inside: number | null;
  /** Lateral shift of the beam at the target, cm. */
  shift: number;
}

export function readouts(s: SlabState): Readouts {
  if (s.slab === 'out') return { tilt: s.tilt, inside: null, shift: 0 };
  return { tilt: s.tilt, inside: insideAngle(s.tilt), shift: lateralShift(s.tilt) };
}

/**
 * The beam in the bench plane (x along the bench, z toward the visitor), cm, from `x0` to `x1`
 * through a block centered at `cx`. The block's face normal is (cos tilt, sin tilt).
 */
export function beamPath(s: SlabState, x0: number, x1: number, cx: number): { x: number; z: number }[] {
  if (s.slab === 'out') return [{ x: x0, z: 0 }, { x: x1, z: 0 }];
  const ti = rad(s.tilt);
  const tt = Math.asin(Math.sin(ti) / N_BK7);
  const xIn = cx - THICKNESS_CM / (2 * Math.cos(ti));
  const len = THICKNESS_CM / Math.cos(tt);
  const xOut = xIn + len * Math.cos(ti - tt);
  const zOut = len * Math.sin(ti - tt);
  return [{ x: x0, z: 0 }, { x: xIn, z: 0 }, { x: xOut, z: zOut }, { x: x1, z: zOut }];
}
