// The sample apparatus: a lamp, a glass block on a rotation stage and a target on a breadboard,
// a console with a brass knob and a chart screen. Built from the kit; reads the model state.
// World units: 1 = 10 cm. The bench top is y = 0; the beam runs along +x at y = BEAM_Y.

import * as THREE from 'three/webgpu';
import {
  anodized, benchTop, brass, darkSteel, emissiveStrip, glowSpot, heroGlass, lacquer, machined, organic, rubber, thinGlass,
} from '../kit/materials';
import { breadboard, knurledRing, lathe, roundedBox, rotationStage } from '../kit/geometry';
import { Ribbon } from '../kit/beams';
import { Chart, DiegeticScreen, SCREEN_COLORS } from '../kit/screens';
import { beamPath, lateralShift, THICKNESS_CM, TILT_MAX, TILT_MIN, type SlabState } from '../model/slab';

export const BEAM_Y = 1.8;
const LAMP_X = -6.2;
const TARGET_X = 6.6;

export interface Apparatus {
  group: THREE.Group;
  /** Set groups for the looks: the console and the bench top. */
  console: THREE.Group;
  rail: THREE.Group;
  reflector: THREE.Object3D | null;
  slab: THREE.Mesh;
  knob: THREE.Group;
  anchors: { lamp: THREE.Object3D; slab: THREE.Object3D; target: THREE.Object3D };
  chart: DiegeticScreen;
  /** Apply displayed (smoothed) values. `explode` is 0 assembled to 1 pulled apart. */
  update(display: SlabState & { explode: number }): void;
}

function targetCardTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#e9e5dc';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#4b4f58';
  g.fillStyle = '#4b4f58';
  g.font = '500 22px "DM Mono", ui-monospace, monospace';
  g.textAlign = 'center';
  // Card spans 32 cm across; ticks every centimeter, numbers every 5.
  for (let cm = -16; cm <= 16; cm++) {
    const x = 256 + (cm / 32) * 512;
    const major = cm % 5 === 0;
    g.lineWidth = major ? 3 : 1.5;
    g.beginPath();
    g.moveTo(x, 300);
    g.lineTo(x, 300 + (major ? 34 : 18));
    g.stroke();
    if (major) g.fillText(String(cm), x, 362);
  }
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 300);
  g.lineTo(512, 300);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildApparatus(): Apparatus {
  const group = new THREE.Group();
  group.name = 'apparatus';

  // ---- console (Lab only) ----
  const consoleGroup = new THREE.Group();
  const body = new THREE.Mesh(roundedBox(17.4, 8.6, 7.6, 0.28, 4), lacquer('#1b1f27'));
  body.position.set(0, -4.55, 0);
  body.castShadow = body.receiveShadow = true;
  const facePanel = new THREE.Mesh(roundedBox(16.2, 5.6, 0.3, 0.12, 3), lacquer('#12151b'));
  facePanel.position.set(0, -3.6, 3.75);
  consoleGroup.add(body, facePanel);
  for (const x of [-8.1, 8.1]) {
    for (const y of [-1.2, -6.0]) {
      const b = new THREE.Mesh(lathe([[0, 0], [0.11, 0], [0.11, 0.05], [0.08, 0.08], [0, 0.08]], 6).rotateX(Math.PI / 2), brass());
      b.position.set(x * 0.97, y, 3.9);
      consoleGroup.add(b);
    }
  }
  // Brass knob with an amber ring: a second way to tilt the slab.
  const knob = new THREE.Group();
  const grip = new THREE.Mesh(knurledRing({ radius: 0.78, width: 0.55, ridges: 64, depth: 0.04, inner: 0.05 }).rotateX(Math.PI / 2), rubber('#15171b'));
  const cap = new THREE.Mesh(lathe([[0, 0], [0.7, 0], [0.7, 0.28], [0.6, 0.38], [0, 0.4]], 64).rotateX(Math.PI / 2), brass());
  cap.position.z = 0.28;
  const index = new THREE.Mesh(roundedBox(0.08, 0.45, 0.04, 0.02, 1), emissiveStrip('#ffb454', 2.2));
  index.position.set(0, 0.32, 0.7);
  knob.add(grip, cap, index);
  knob.position.set(-5.6, -3.5, 3.9);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.022, 8, 96), emissiveStrip('#ffb454', 1.5));
  ring.position.set(-5.6, -3.5, 3.93);
  consoleGroup.add(knob, ring);
  // Chart screen
  const chart = new DiegeticScreen(8.2, 3.7, 1024);
  chart.mesh.position.set(1.9, -3.5, 3.97);
  const bezel = new THREE.Mesh(roundedBox(8.7, 4.2, 0.18, 0.12, 3), anodized('#0d1016'));
  bezel.position.set(1.9, -3.5, 3.86);
  consoleGroup.add(bezel, chart.mesh);
  consoleGroup.name = 'console';
  group.add(consoleGroup);

  // ---- bench top: breadboard with a planar reflection ----
  const rail = new THREE.Group();
  const top = benchTop({ reflect: true });
  const board = breadboard({ width: 16.4, depth: 6.6, thickness: 0.26, plate: top.material, hole: rubber('#07080a') });
  rail.add(board);
  if (top.reflectorTarget) {
    top.reflectorTarget.position.y = 0.001;
    rail.add(top.reflectorTarget);
  }
  rail.name = 'rail';
  group.add(rail);

  // ---- lamp with a collimator ----
  const lamp = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, BEAM_Y - 0.4, 24), darkSteel());
  post.position.y = (BEAM_Y - 0.4) / 2;
  const foot = new THREE.Mesh(roundedBox(1.3, 0.18, 1.3, 0.06), darkSteel('#2c3038'));
  foot.position.y = 0.09;
  const housing = new THREE.Mesh(
    lathe([[0, -1.1], [0.62, -1.1], [0.7, -0.95], [0.7, 0.6], [0.5, 0.75], [0.38, 0.75], [0.38, 1.25], [0, 1.25]], 64).rotateZ(-Math.PI / 2),
    lacquer('#20242c'),
  );
  housing.position.y = BEAM_Y;
  const fins = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.05, 48).rotateZ(Math.PI / 2), machined('#6b727d'));
    fin.position.set(-0.85 + i * 0.22, BEAM_Y, 0);
    fins.add(fin);
  }
  const collar = new THREE.Mesh(knurledRing({ radius: 0.42, width: 0.22, ridges: 40, depth: 0.025, inner: 0.3 }).rotateZ(-Math.PI / 2), brass());
  collar.position.set(1.12, BEAM_Y, 0);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.33, 48).rotateY(Math.PI / 2), thinGlass({ opacity: 0.25 }));
  lens.position.set(1.26, BEAM_Y, 0);
  const aperture = glowSpot('#ffe6c4', 4);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateY(Math.PI / 2), aperture.material);
  glow.position.set(1.28, BEAM_Y, 0);
  lamp.add(post, foot, housing, fins, collar, lens, glow);
  lamp.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== glow && o !== lens) o.castShadow = true; });
  lamp.position.x = LAMP_X;
  group.add(lamp);

  // ---- rotation stage carrying the glass block ----
  const stage = rotationStage({ radius: 1.35, height: 0.38, base: anodized('#1e222a'), platter: machined('#8d949e'), knob: brass(), ring: anodized('#2a2f38') });
  const pedestal = new THREE.Mesh(roundedBox(1.4, 0.2, 3.0, 0.05), darkSteel('#30353e'));
  pedestal.position.y = 0.2;
  stage.platter.add(pedestal);
  const slab = new THREE.Mesh(roundedBox(THICKNESS_CM / 10, 2.5, 3.0, 0.05, 3), heroGlass({ ior: 1.5168, dispersion: 0.25 }));
  slab.position.y = BEAM_Y - stage.platter.position.y;
  slab.castShadow = true;
  stage.platter.add(slab);
  const stageGroup = new THREE.Group();
  stageGroup.add(stage.group);
  group.add(stageGroup);

  // ---- target card with a ruler ----
  const target = new THREE.Group();
  const card = new THREE.Mesh(roundedBox(0.08, 3.2, 3.2, 0.03), organic('#ffffff', 0.85));
  (card.material as THREE.MeshStandardNodeMaterial).map = targetCardTexture();
  card.position.y = BEAM_Y;
  card.receiveShadow = true;
  const frame = new THREE.Mesh(roundedBox(0.18, 3.5, 3.5, 0.05), darkSteel('#2a2e36'));
  frame.position.set(0.1, BEAM_Y, 0);
  const tpost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, BEAM_Y - 1.6, 20), darkSteel());
  tpost.position.y = (BEAM_Y - 1.6) / 2;
  const tfoot = new THREE.Mesh(roundedBox(1.0, 0.16, 1.4, 0.05), darkSteel('#2c3038'));
  tfoot.position.y = 0.08;
  const spot = glowSpot('#fff0dc', 3);
  const spotMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75).rotateY(-Math.PI / 2), spot.material);
  spotMesh.position.set(-0.06, BEAM_Y, 0);
  target.add(frame, card, tpost, tfoot, spotMesh);
  target.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== spotMesh) o.castShadow = true; });
  target.position.x = TARGET_X;
  group.add(target);

  // ---- the beam (traced from the model every frame) ----
  const beamColor = new THREE.Color('#ffe7c9').multiplyScalar(5);
  const ribbon = new Ribbon({ points: [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)], width: 0.16, colors: beamColor, shade: true });
  group.add(ribbon.mesh);

  // ---- label anchors ----
  const anchors = { lamp: new THREE.Object3D(), slab: new THREE.Object3D(), target: new THREE.Object3D() };
  anchors.lamp.position.set(0.2, BEAM_Y + 0.9, 0);
  lamp.add(anchors.lamp);
  anchors.slab.position.set(0, BEAM_Y + 1.5, 0);
  stageGroup.add(anchors.slab);
  anchors.target.position.set(0, BEAM_Y + 1.9, 0);
  target.add(anchors.target);

  const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  return {
    group,
    console: consoleGroup,
    rail,
    reflector: top.reflectorTarget,
    slab,
    knob,
    anchors,
    chart,
    update(d) {
      // Exploded: parts slide apart along the beam axis, the block lifts off its stage.
      const e = d.explode;
      lamp.position.x = LAMP_X - 2.6 * e;
      target.position.x = TARGET_X + 2.6 * e;
      slab.position.y = BEAM_Y - stage.platter.position.y + 0 * e;
      stage.platter.rotation.y = -THREE.MathUtils.degToRad(d.tilt);
      slab.visible = d.slab === 'in';
      knob.rotation.z = -THREE.MathUtils.degToRad(d.tilt * 3);
      const x0 = (lamp.position.x + 1.3) * 10;
      const x1 = (target.position.x - 0.05) * 10;
      const path = beamPath(d, x0, x1, 0);
      const n = path.length;
      for (let i = 0; i < 4; i++) {
        const p = path[Math.min(i, n - 1)];
        pts[i].set(p.x / 10, BEAM_Y, p.z / 10);
      }
      ribbon.setPath(n === 2 ? [pts[0], pts[1]] : pts, 0.16, beamColor);
      const end = path[n - 1];
      spotMesh.position.z = end.z / 10;
      chart.draw([Math.round(d.tilt * 10), d.slab], (ctx, size) => {
        const plot = new Chart(ctx, { x: size.w * 0.08, y: size.h * 0.2, w: size.w * 0.86, h: size.h * 0.62 }, [TILT_MIN, TILT_MAX], [-6.5, 6.5]);
        plot.grid({ xStep: 15, yStep: 2.5 }).xLabels([-60, -30, 0, 30, 60], (v) => `${v}°`);
        plot.caption('Sideways step against tilt');
        if (d.slab === 'in') {
          plot.curve((x) => lateralShift(x));
          const y = lateralShift(d.tilt);
          plot.marker(d.tilt, y, { drop: true }).annotate(d.tilt, y, `${Math.abs(y).toFixed(1)} cm`, { dx: d.tilt > 20 ? -14 : 14 });
        } else {
          plot.curve(() => 0, { color: SCREEN_COLORS.text, glow: 0, dash: [6, 6] });
          plot.caption('Slab out', { align: 'right', color: SCREEN_COLORS.amber });
        }
      });
    },
  };
}
