// The phenomenon: the beam, drawn at the model's intensity after each filter, and a thin cyan
// trace of the electric field: many orientations before the polarizer (unpolarized), one plane
// after each filter, along that filter's axis, with amplitude ∝ √I (I ∝ E²). The beam's brightness
// follows the intensity and its width the field amplitude, so every filter is a visible step.

import * as THREE from 'three/webgpu';
import { Ribbon } from '../kit/beams';
import { beam } from '../kit/materials';
import { amplitude, read, type BenchState } from '../model/polarizer';
import { BEAM_Y } from './apparatus';

/** HDR multiple of white for the full lamp; every segment scales with its intensity. Low enough
 * that the full lamp stays below clipping and the step to 50% shows. */
const BEAM_GAIN = 2.4;
/** Ribbon width at the full lamp, world units; a segment at intensity I is √(I/I₀) of it. */
const BEAM_WIDTH = 0.42;
const LAMP_COLOR = new THREE.Color('#fff0dc');
/** A touch cooler once polarized, so the lamp's warm segment reads as different light. */
const POLARIZED_COLOR = new THREE.Color('#f2f5ff');
/** Drawn wavelength of the field trace, world units (8 cm): theatre, declared in the help sheet. */
export const TRACE_WAVELENGTH = 0.8;
const TRACE_SPEED = 0.5;
const TRACE_AMPLITUDE = 0.6;
const UNPOLARIZED_TRACES = 5;
const POINTS = 96;

export interface Stations { lamp: number; polarizer: number; middle: number; analyzer: number; meter: number; middleOnAxis: number }

export class Field {
  readonly group = new THREE.Group();
  private beam: Ribbon;
  private shimmer: Ribbon[] = [];
  private planes: Ribbon[] = [];
  private beamPts = Array.from({ length: 8 }, () => new THREE.Vector3());
  private beamCols = Array.from({ length: 8 }, () => new THREE.Color());
  private beamWidths = new Array<number>(8).fill(BEAM_WIDTH);
  private pts = Array.from({ length: POINTS }, () => new THREE.Vector3());
  private xs = new Float64Array(8);
  private pcts = new Float64Array(8);
  private cols = Array.from({ length: POINTS }, () => new THREE.Color());

  constructor() {
    this.beam = new Ribbon({
      points: [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], width: BEAM_WIDTH, material: beam('#ffffff', 1, { core: 18, halo: 0.42 }),
      dynamic: true, shade: true,
    });
    this.group.add(this.beam.mesh);
    const traceMat = beam('#7fe3ff', 1, { core: 9, halo: 0.25 });
    for (let i = 0; i < UNPOLARIZED_TRACES; i++) {
      const r = new Ribbon({ points: [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], width: 0.032, material: traceMat, renderOrder: 11, dynamic: true, shade: true });
      this.shimmer.push(r);
      this.group.add(r.mesh);
    }
    for (let i = 0; i < 3; i++) {
      const r = new Ribbon({ points: [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], width: 0.036, material: traceMat, renderOrder: 11, dynamic: true, shade: true });
      this.planes.push(r);
      this.group.add(r.mesh);
    }
  }

  /** `m` is how far the middle filter covers the beam (0 waiting, 1 in). */
  update(t: number, st: Stations, s: BenchState): void {
    const m = st.middleOnAxis;
    const out = read({ ...s, middle: 'out' });
    const inn = read({ ...s, middle: 'in' });
    const afterMiddle = THREE.MathUtils.lerp(out.stages.afterPolarizer, inn.stages.afterMiddle ?? 0, m);
    const final = THREE.MathUtils.lerp(out.through, inn.through, m);
    const planeAfterMiddle = m > 0.5 ? s.middleAngle : 0;

    // ---- beam: steps at each film plane, tapered over a few millimeters so no segment ends in a cap ----
    const eps = 0.05;
    const xs = this.xs;
    const pcts = this.pcts;
    xs[0] = st.lamp; pcts[0] = 100;
    xs[1] = st.polarizer - eps; pcts[1] = 100;
    xs[2] = st.polarizer + eps; pcts[2] = 50;
    xs[3] = st.middle - eps; pcts[3] = 50;
    xs[4] = st.middle + eps; pcts[4] = afterMiddle;
    xs[5] = st.analyzer - eps; pcts[5] = afterMiddle;
    xs[6] = st.analyzer + eps; pcts[6] = final;
    xs[7] = st.meter; pcts[7] = final;
    for (let i = 0; i < 8; i++) {
      this.beamPts[i].set(xs[i], BEAM_Y, 0);
      this.beamCols[i].copy(i < 2 ? LAMP_COLOR : POLARIZED_COLOR).multiplyScalar((BEAM_GAIN * pcts[i]) / 100);
      this.beamWidths[i] = BEAM_WIDTH * amplitude(pcts[i]);
    }
    this.beam.setPath(this.beamPts, this.beamWidths, this.beamCols);

    // ---- field trace ----
    const k = (Math.PI * 2) / TRACE_WAVELENGTH;
    const phase = (x: number) => k * (x - st.lamp) - k * TRACE_SPEED * t;
    const draw = (r: Ribbon, x0: number, x1: number, plane: number, amp: number, gain: number, phaseOffset = 0) => {
      const vis = THREE.MathUtils.smoothstep(amp, 0, 0.06);
      const ry = Math.cos(THREE.MathUtils.degToRad(plane));
      const rz = Math.sin(THREE.MathUtils.degToRad(plane));
      for (let i = 0; i < POINTS; i++) {
        const u = i / (POINTS - 1);
        const x = x0 + (x1 - x0) * u;
        const d = amp * TRACE_AMPLITUDE * Math.sin(phase(x) + phaseOffset);
        this.pts[i].set(x, BEAM_Y + d * ry, d * rz);
        const fade = Math.min(1, u / 0.04, (1 - u) / 0.04);
        this.cols[i].setRGB(1, 1, 1).multiplyScalar(gain * vis * fade);
      }
      r.setPath(this.pts, 0.034, this.cols);
    };
    // Unpolarized: several orientations that keep drifting, dimmer each.
    this.shimmer.forEach((r, i) => {
      const plane = (i * 180) / UNPOLARIZED_TRACES + 40 * Math.sin(0.7 * t + i * 1.9) + 18 * t;
      draw(r, st.lamp + 0.05, st.polarizer, plane, amplitude(100) * (0.75 + 0.25 * Math.sin(1.3 * t + i)), 0.85, i * 1.3);
    });
    draw(this.planes[0], st.polarizer, st.middle, 0, amplitude(50), 1.6);
    draw(this.planes[1], st.middle, st.analyzer, planeAfterMiddle, amplitude(afterMiddle), 1.6);
    draw(this.planes[2], st.analyzer, st.meter, s.analyzer, amplitude(final), 1.6);
  }
}
