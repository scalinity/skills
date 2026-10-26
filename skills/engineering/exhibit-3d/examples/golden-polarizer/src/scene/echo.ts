// Background echo for the Lab: large polarizer discs hung in the dusk window like a mobile. The
// window pane is shaded with the same law as the bench (discTransmission in the model): along each
// view ray the first disc keeps half of the window light and every next disc passes cos² of its turn
// from the one before, so two crossed discs overlap black and a third at 45° between them lets light
// back. One disc turns once every two minutes. Out of focus, the discs read by silhouette: big
// circles, dark where they cross. The discs themselves draw only as thin rims, axis bars and wires,
// so nothing is darkened twice. Positions assume the room sits at the world origin.

import * as THREE from 'three/webgpu';
import { cameraPosition, cos, float, max, mix, positionWorld, smoothstep, step, uniform, vec2, vec4 } from 'three/tsl';
import { darkSteel } from '../kit/materials';
import type { LabSet } from '../kit/sets';
import { DISCS } from './echo-discs';

const TURN_SECONDS = 120;
const RAD = Math.PI / 180;

export interface Echo {
  group: THREE.Group;
  /** Advance the turning disc; `still` (reduced motion) holds it. */
  update(dt: number, still: boolean): void;
}

/** Builds the discs on the window anchor and shades the window pane through them. */
export function buildEcho(win: LabSet['window'], anchor: THREE.Object3D, ceilingY: number): Echo {
  const group = new THREE.Group();
  group.name = 'echo-discs';
  const angles = DISCS.map((d) => uniform(d.deg * RAD));

  const mat = win.pane.material as THREE.MeshBasicNodeMaterial;
  const sky = mat.colorNode as THREE.Node<'vec4'>;
  let T: THREE.Node<'float'> = float(1);
  let prev: THREE.Node<'float'> = float(0);
  let seen: THREE.Node<'float'> = float(0);
  DISCS.forEach((d, i) => {
    // Where the ray from the camera to this pane fragment crosses the disc's plane.
    const t = float(win.center.z + d.dz).sub(cameraPosition.z).div(positionWorld.z.sub(cameraPosition.z));
    const q = cameraPosition.add(positionWorld.sub(cameraPosition).mul(t));
    const off = q.xy.sub(vec2(win.center.x + d.dx, win.center.y + d.dy)).length();
    const hit = float(1).sub(smoothstep(d.r - 0.06, d.r + 0.06, off)).mul(step(0, t)).mul(step(t, 1));
    const turn = cos(angles[i].sub(prev));
    const pass = mix(float(0.5), turn.mul(turn), seen);
    T = mix(T, T.mul(pass), hit);
    prev = mix(prev, angles[i], hit);
    seen = max(seen, hit);
  });
  mat.colorNode = vec4(sky.xyz.mul(T), 1);
  mat.needsUpdate = true;

  // Rims, axis bars and hanging wires, placed relative to the window anchor.
  const steel = darkSteel('#2a2e36');
  const a = anchor.position;
  const bars: THREE.Mesh[] = [];
  DISCS.forEach((d) => {
    const x = win.center.x + d.dx - a.x;
    const y = win.center.y + d.dy - a.y;
    const z = win.center.z + d.dz - a.z;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.07, 6, 64), steel);
    rim.position.set(x, y, z);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, d.r * 1.9, 5), steel);
    bar.position.set(x, y, z);
    bar.rotation.z = d.deg * RAD;
    bars.push(bar);
    const top = y + d.r;
    const wireLen = ceilingY - a.y - top;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, wireLen, 4), steel);
    wire.position.set(x, top + wireLen / 2, z);
    group.add(rim, bar, wire);
  });
  anchor.add(group);

  const turning = DISCS.findIndex((d) => d.turns);
  return {
    group,
    update(dt, still) {
      if (still || turning < 0) return;
      angles[turning].value += (2 * Math.PI * dt) / TURN_SECONDS;
      bars[turning].rotation.z = angles[turning].value;
    },
  };
}
