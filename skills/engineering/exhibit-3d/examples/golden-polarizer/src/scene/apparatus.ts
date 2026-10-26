// The polarizer bench: a console with the analyzer knob and two screens, a breadboard, an optical
// rail, a lamp, three filters in brass rotation mounts (the middle one on a lift) and a
// light meter. Built from the kit; reads the displayed state every frame.
// World units: 1 = 10 cm. Bench top y = 0; the beam runs along +x at y = BEAM_Y, z = 0.
// Filter angles are degrees from vertical; a ring turned by θ about +x carries its axis to
// (0, cos θ, sin θ).

import * as THREE from 'three/webgpu';
import { atan, degrees, exp, float, mod, positionLocal, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import {
  anodized, benchTop, brass, darkSteel, emissiveStrip, emitterMaterial, followEnvironment, glowSpot, lacquer, machined,
  organic, rubber, thinGlass,
} from '../kit/materials';
import { bolt, breadboard, dialTexture, knurledRing, lathe, lightStrip, lowPoly, makeRng, mergeStatic, rail, roundedBox } from '../kit/geometry';
import { Chart, DiegeticScreen, SCREEN_COLORS } from '../kit/screens';
import { read, throughAt, type BenchState } from '../model/polarizer';

export const BEAM_Y = 2.6;
export const RAIL_TOP = 0.36;
const FILM_R = 0.84;
/** Emissive level of the soft spot where the beam crosses a film, per unit of arriving intensity (lamp = 1). */
const FILM_GLOW = 0.9;
export const LAB_X = { lamp: -6.5, polarizer: -3.2, middle: 0.1, analyzer: 3.3, meter: 6.6 };
export const EXPLODED_X = { lamp: -8.6, polarizer: -4.4, middle: 0, analyzer: 4.4, meter: 8.8 };
/** When it is out, the middle filter waits this far up its lift: its housing clears the beam from every camera. */
export const MIDDLE_LIFT = 1.85;
/** The lift's column stands behind the beam at this z, just outside the housing (radius 1.14). */
const LIFT_Z = -1.35;

export interface Display extends BenchState {
  /** 0 assembled, 1 exploded. */
  explode: number;
  /** 0 lifted clear of the beam, 1 in the beam. */
  slide: number;
}

export interface FilterMount {
  group: THREE.Group;
  /** Turns about +x with the filter's axis. */
  ring: THREE.Group;
  /** Drag target: the knurled brass ring and the film. */
  grip: THREE.Object3D;
  label: THREE.Object3D;
  /** The film disc: slides out of its cell along the beam in the exploded view. */
  film: THREE.Mesh;
  /** Below the ring, toward the viewer: where a drag hint can sit on the part. */
  hint: THREE.Object3D;
  /** World-space center of the film, for drags and the loupe. */
  center(): THREE.Vector3;
}

export interface Apparatus {
  group: THREE.Group;
  console: THREE.Group;
  bench: THREE.Group;
  lamp: THREE.Group;
  polarizer: FilterMount;
  middle: FilterMount & { carriage: THREE.Group; slideBody: THREE.Group };
  analyzer: FilterMount;
  meter: THREE.Group;
  knob: THREE.Group;
  anchors: { lamp: THREE.Object3D; meter: THREE.Object3D };
  /** Beam path stations along x for the current display. */
  stations(): { lamp: number; polarizer: number; middle: number; analyzer: number; meter: number; middleOnAxis: number };
  meterSpot: ReturnType<typeof glowSpot>;
  update(d: Display): void;
}

// ---------- textures ----------

function filmTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, 512, 512);
  // Smoky neutral gray film (an HN38 sheet passes 38% of lamp light), slightly denser toward the rim.
  const rad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  rad.addColorStop(0, 'rgba(50,52,56,0.84)');
  rad.addColorStop(1, 'rgba(34,36,40,0.9)');
  g.fillStyle = rad;
  g.beginPath();
  g.arc(256, 256, 256, 0, Math.PI * 2);
  g.fill();
  // Faint chain direction: lines across the transmission axis (the axis is vertical here).
  g.strokeStyle = 'rgba(190,200,215,0.07)';
  g.lineWidth = 2;
  for (let y = 8; y < 512; y += 14) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  // The transmission axis, scribed like an index line.
  g.strokeStyle = 'rgba(235,240,248,0.42)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(256, 10);
  g.lineTo(256, 502);
  g.stroke();
  // A light bevel where the sheet meets its cell, so the disc reads as a sheet even edge-on.
  g.strokeStyle = 'rgba(228,232,238,0.62)';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(256, 256, 250, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * One film's material. A soft sheen, not a mirror: a clearcoat's grazing reflection of a bright room
 * washes the gray out. It writes depth: a sheet that wrote none would take the far background's
 * depth, and depth of field would blur it away with the background. Where the beam crosses it the
 * film glows softly with the light arriving there (`glow`, lamp = 1), which marks every filter plane
 * against a dark room.
 */
function filmMaterial(map: THREE.Texture): { mat: THREE.MeshPhysicalNodeMaterial; glow: THREE.UniformNode<'float', number> } {
  const glow = uniform(0);
  const d = uv().sub(0.5).length().mul(2); // 0 at the center, 1 at the rim
  const mat = followEnvironment(new THREE.MeshPhysicalNodeMaterial({
    map, transparent: true, roughness: 0.42, metalness: 0, side: THREE.DoubleSide,
  }), 0.3);
  mat.emissiveNode = vec3(1, 0.94, 0.86).mul(glow.mul(FILM_GLOW)).mul(exp(d.mul(d).mul(-6)));
  return { mat, glow };
}

/** Brass dial: numbers run counterclockwise so the fixed index at the top reads the turn. */
function dialMaterial(): THREE.MeshPhysicalNodeMaterial {
  const tex = dialTexture({
    radius: 1, ticks: 72, majorEvery: 9, direction: 'ccw', face: '#9a6c30', engrave: '#2a1a08',
    tickScale: 0.75, labelRadius: 0.84, innerRing: false, size: 1024,
    label: (deg) => `${Math.round(deg)}`,
  });
  const mat = machined('#ffffff');
  mat.map = tex;
  mat.roughness = 0.38;
  return mat;
}

// ---------- parts ----------

function carrier(width = 1.0): THREE.Group {
  const g = new THREE.Group();
  const block = new THREE.Mesh(roundedBox(width, 0.28, 1.15, 0.06), anodized('#1c2027'));
  block.position.y = RAIL_TOP + 0.14;
  const screw = new THREE.Mesh(knurledRing({ radius: 0.09, width: 0.14, ridges: 16, depth: 0.012, inner: 0.001 }).rotateX(Math.PI / 2), brass());
  screw.position.set(0, RAIL_TOP + 0.14, 0.64);
  g.add(block, screw);
  for (const m of [block, screw]) m.castShadow = m.receiveShadow = true;
  return g;
}

function post(from: number, to: number, r = 0.11): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, to - from, 24), darkSteel('#4d525b'));
  m.position.y = (from + to) / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}

function filterMount(film: THREE.Material, dial: THREE.Material, housingMat: THREE.Material, indexMat: THREE.Material, onLift = false): FilterMount {
  const group = new THREE.Group();
  // On the lift the ring hangs from a clamp at its lower back, so nothing under it rises into the beam.
  if (!onLift) group.add(carrier(), post(RAIL_TOP + 0.28, BEAM_Y - 1.08));
  // Housing: a dark ring on the post.
  const housing = new THREE.Mesh(
    lathe([[0.86, -0.17], [1.1, -0.17], [1.14, -0.13], [1.14, 0.13], [1.1, 0.17], [0.86, 0.17], [0.86, -0.17]], 96).rotateZ(-Math.PI / 2),
    housingMat,
  );
  housing.position.y = BEAM_Y;
  housing.castShadow = housing.receiveShadow = true;
  const clamp = new THREE.Mesh(roundedBox(0.34, 0.3, 0.42, 0.06), housingMat);
  if (onLift) clamp.position.set(0, BEAM_Y - 0.8, -0.95);
  else clamp.position.y = BEAM_Y - 1.12;
  group.add(housing, clamp);
  // Fixed amber index at the top, reading the dial.
  const index = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 3).rotateZ(Math.PI), indexMat);
  index.position.set(-0.33, BEAM_Y + 1.08, 0);
  group.add(index);
  // The turning ring: knurled brass grip, engraved dial face, the film.
  const ring = new THREE.Group();
  ring.position.y = BEAM_Y;
  const grip = new THREE.Mesh(knurledRing({ radius: 0.98, width: 0.17, ridges: 120, depth: 0.03, inner: 0.84 }).rotateZ(-Math.PI / 2), brass());
  grip.position.x = -0.24;
  grip.castShadow = true;
  const face = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.985, 128, 1).rotateY(-Math.PI / 2), dial);
  face.position.x = -0.33;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(FILM_R, 96).rotateY(-Math.PI / 2), film);
  disc.renderOrder = 2;
  disc.userData.occluder = false;
  // The transmission axis, drawn on the film in cyan like the field it lets through, so the turn reads
  // on the part itself: aligned filters show | |, crossed ones | —.
  const axisLine = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, FILM_R * 1.86, 8), emitterMaterial('#7fe3ff', 0.75));
  // Centered on the sheet: whichever half faces the camera stands in front of the gray film.
  axisLine.userData.occluder = false;
  disc.add(axisLine);
  ring.add(grip, face, disc);
  group.add(ring);
  // On top of the housing, so a leader line ends on the part itself.
  const label = new THREE.Object3D();
  label.position.set(0, BEAM_Y + 1.18, 0);
  group.add(label);
  const center = new THREE.Vector3();
  const pick = new THREE.Group();
  pick.add(grip, face, disc);
  ring.add(pick);
  const hint = new THREE.Object3D();
  hint.position.set(-0.3, BEAM_Y - 1.5, 0.75);
  group.add(hint);
  return { group, ring, grip: pick, label, film: disc, hint, center: () => disc.getWorldPosition(center) };
}

export function buildApparatus(): Apparatus {
  const group = new THREE.Group();
  group.name = 'polarizer-bench';
  const indexMat = emissiveStrip('#ffb454', 1.3);
  const housingMat = anodized('#1b1f26');
  const filmTex = filmTexture();
  const films = { polarizer: filmMaterial(filmTex), middle: filmMaterial(filmTex), analyzer: filmMaterial(filmTex) };
  const dial = dialMaterial();

  // ---- console (Lab) ----
  const consoleGroup = new THREE.Group();
  consoleGroup.name = 'console';
  const body = new THREE.Mesh(roundedBox(19.6, 8.4, 8.0, 0.32, 4), lacquer('#1a1e26'));
  body.position.set(0, -4.48, 0);
  const lip = new THREE.Mesh(roundedBox(19.9, 0.28, 8.3, 0.1, 3), lacquer('#14171d'));
  lip.position.set(0, -0.42, 0);
  const face = new THREE.Mesh(roundedBox(18.4, 5.2, 0.28, 0.14, 3), lacquer('#101318'));
  face.position.set(0, -3.55, 3.96);
  const strip = new THREE.Mesh(lightStrip({ length: 18.6, thickness: 0.04, depth: 0.04 }), emissiveStrip('#ffb15a', 1.15));
  strip.position.set(0, -0.62, 4.1);
  consoleGroup.add(body, lip, face, strip);
  for (const x of [-8.85, 8.85]) {
    for (const y of [-1.25, -5.85]) {
      const b = new THREE.Mesh(bolt({ radius: 0.12, height: 0.06 }).rotateX(Math.PI / 2), brass());
      b.position.set(x, y, 4.1);
      consoleGroup.add(b);
    }
  }
  for (const x of [-9.0, 9.0]) {
    for (const z of [-3.4, 3.4]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.35, 24), rubber('#101114'));
      foot.position.set(x, -8.85, z);
      consoleGroup.add(foot);
    }
  }
  // The back is finished too, for the camera that circles the room: a service panel with vent slots,
  // a cable gland with the mains cable dropping to the floor, a small brass plate and four bolts.
  const backPanel = new THREE.Mesh(roundedBox(17.6, 5.6, 0.2, 0.1, 3), lacquer('#101318'));
  backPanel.position.set(0, -4.2, -4.02);
  const slots: THREE.Mesh[] = [];
  for (const x of [-4.6, 4.6]) {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(roundedBox(3.4, 0.16, 0.08, 0.03, 1), rubber('#07080b'));
      s.position.set(x, -2.3 - i * 0.42, -4.14);
      slots.push(s);
    }
  }
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 16).rotateX(Math.PI / 2), brass());
  gland.position.set(6.6, -6.3, -4.3);
  const mains = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), rubber('#15171b'));
  mains.position.set(6.6, -7.6, -4.5);
  const backPlate = new THREE.Mesh(roundedBox(2.6, 0.9, 0.06, 0.04, 2), brass());
  backPlate.position.set(-6.2, -6.4, -4.14);
  consoleGroup.add(backPanel, mergeStatic(slots, rubber('#07080b')), gland, mains, backPlate);
  for (const x of [-8.3, 8.3]) {
    for (const y of [-1.85, -6.55]) {
      const b = new THREE.Mesh(bolt({ radius: 0.12, height: 0.06 }).rotateX(-Math.PI / 2), brass());
      b.position.set(x, y, -4.14);
      consoleGroup.add(b);
    }
  }
  consoleGroup.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== strip) { o.castShadow = true; o.receiveShadow = true; } });

  // Analyzer knob: rubber grip, brass cap, amber ring, a cyan arc for the angle (0° to 180° over 270°).
  const knob = new THREE.Group();
  const kGrip = new THREE.Mesh(knurledRing({ radius: 0.86, width: 0.6, ridges: 60, depth: 0.045, inner: 0.05 }).rotateX(Math.PI / 2), rubber('#15171b'));
  const kCap = new THREE.Mesh(lathe([[0, 0], [0.76, 0], [0.76, 0.3], [0.64, 0.42], [0, 0.45]], 64).rotateX(Math.PI / 2), brass());
  kCap.position.z = 0.3;
  const kIndex = new THREE.Mesh(roundedBox(0.09, 0.5, 0.05, 0.02, 1), emissiveStrip('#ffb454', 1.0));
  kIndex.position.set(0, 0.36, 0.76);
  knob.add(kGrip, kCap, kIndex);
  // Knob and screens share one band under the bench lip, so the hero shot can hold all of it.
  const BAND_Y = -2.5;
  knob.position.set(-7.0, BAND_Y, 4.1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.016, 8, 120), brass());
  ring.position.set(-7.0, BAND_Y, 4.12);
  const sweep = uniform(0);
  const a = degrees(atan(positionLocal.y, positionLocal.x));
  const fromStart = mod(float(225).sub(a).add(360), 360);
  const arcMask = float(1).sub(smoothstep(sweep.sub(0.8), sweep.add(0.8), fromStart));
  const arc = new THREE.Mesh(new THREE.RingGeometry(1.27, 1.34, 160, 1), emitterMaterial('#ffb454', 1.1, arcMask));
  arc.position.set(-7.0, BAND_Y, 4.12);
  const track = new THREE.Mesh(new THREE.RingGeometry(1.27, 1.34, 160, 1), new THREE.MeshBasicNodeMaterial({ color: '#232a36' }));
  track.position.set(-7.0, BAND_Y, 4.115);
  consoleGroup.add(knob, ring, track, arc);

  // Screens: the Malus curve and the meter.
  const chart = new DiegeticScreen(7.4, 2.7, 1024, { gain: 1.05 });
  chart.mesh.position.set(-0.9, BAND_Y, 4.16);
  const meterScreen = new DiegeticScreen(4.0, 2.7, 640, { gain: 1.05 });
  meterScreen.mesh.position.set(5.2, BAND_Y, 4.16);
  for (const s of [chart, meterScreen]) {
    const bezel = new THREE.Mesh(roundedBox(s === chart ? 7.9 : 4.5, 3.2, 0.16, 0.14, 3), anodized('#0b0d12'));
    bezel.position.set(s.mesh.position.x, s.mesh.position.y, 4.06);
    consoleGroup.add(bezel, s.mesh);
  }
  group.add(consoleGroup);

  // ---- bench: breadboard with a planar reflection ----
  const bench = new THREE.Group();
  bench.name = 'bench';
  const top = benchTop({ reflect: true });
  bench.add(breadboard({ width: 18.6, depth: 7.4, thickness: 0.26, plate: top.material, hole: rubber('#07080a') }));
  if (top.reflectorTarget) {
    top.reflectorTarget.position.y = 0.001;
    bench.add(top.reflectorTarget);
  }
  // A low-poly succulent in a faceted cream pot on the bench's front corner: the toy beside the
  // precision parts, in the focus band.
  const rng = makeRng(11);
  const succulent = new THREE.Group();
  const pot = new THREE.Mesh(lowPoly.pot({ radius: 0.48, height: 0.7, sides: 7 }), organic('#e9e0cf', 0.75));
  succulent.add(pot);
  const leaves = organic('#6f9a52', 0.7);
  for (let i = 0; i < 2; i++) {
    const f = new THREE.Mesh(lowPoly.foliage(rng, { size: 0.62 - i * 0.16, leaves: 6 }), leaves);
    f.position.y = 0.66 + i * 0.22;
    f.rotation.y = rng() * Math.PI;
    succulent.add(f);
  }
  succulent.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  succulent.position.set(8.25, 0.02, 2.75);
  bench.add(succulent);
  group.add(bench);

  // ---- optical rail ----
  const optRail = rail({ length: 18.4, width: 0.6, height: 0.3, body: anodized('#252a33'), tick: machined('#d9dee6') });
  group.add(optRail);

  // ---- lamp ----
  const lamp = new THREE.Group();
  lamp.add(carrier(1.3), post(RAIL_TOP + 0.28, BEAM_Y - 0.6, 0.13));
  const housingGeo = lathe([[0, -1.45], [0.55, -1.45], [0.68, -1.3], [0.72, -1.0], [0.72, 0.55], [0.62, 0.7], [0.5, 0.76], [0.42, 0.76], [0.42, 1.32], [0.36, 1.38], [0, 1.38]], 72).rotateZ(-Math.PI / 2);
  const housing = new THREE.Mesh(housingGeo, lacquer('#20242c'));
  housing.position.y = BEAM_Y;
  lamp.add(housing);
  for (let i = 0; i < 7; i++) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.045, 56).rotateZ(Math.PI / 2), machined('#727985'));
    fin.position.set(-0.95 + i * 0.2, BEAM_Y, 0);
    lamp.add(fin);
  }
  const collar = new THREE.Mesh(knurledRing({ radius: 0.45, width: 0.24, ridges: 44, depth: 0.025, inner: 0.32 }).rotateZ(-Math.PI / 2), brass());
  collar.position.set(1.18, BEAM_Y, 0);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.34, 48).rotateY(Math.PI / 2), thinGlass({ opacity: 0.22 }));
  lens.position.set(1.33, BEAM_Y, 0);
  const aperture = glowSpot('#ffe9cc', 5);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0).rotateY(Math.PI / 2), aperture.material);
  glow.position.set(1.35, BEAM_Y, 0);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.5, BEAM_Y - 0.1, 0), new THREE.Vector3(-2.1, BEAM_Y - 0.9, 0.15), new THREE.Vector3(-2.2, 0.35, 0.9),
    new THREE.Vector3(-1.4, 0.07, 2.1), new THREE.Vector3(0.6, 0.07, 3.0),
  ]), 48, 0.055, 10, false), rubber('#0f1013'));
  // The collimator pulls forward off the housing in the exploded view.
  const lampFront = new THREE.Group();
  lampFront.add(collar, lens, glow);
  // The cable ends in a small power supply on the bench, not in mid-air.
  const supply = new THREE.Mesh(roundedBox(0.95, 0.5, 0.62, 0.08, 2), lacquer('#1d2128'));
  supply.position.set(1.1, 0.25, 3.0);
  const supplyLed = new THREE.Mesh(roundedBox(0.08, 0.08, 0.02, 0.01, 1), emissiveStrip('#7fe3ff', 1.1));
  supplyLed.position.set(1.4, 0.36, 3.315);
  lamp.add(lampFront, cable, supply, supplyLed);
  lamp.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== glow && o !== lens) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(lamp);

  // ---- filters ----
  const polarizer = filterMount(films.polarizer.mat, dial, housingMat, indexMat);
  const analyzer = filterMount(films.analyzer.mat, dial, housingMat, indexMat);
  group.add(polarizer.group, analyzer.group);
  // Middle filter on a lift behind the beam. It rises straight up out of the beam: sliding it back
  // instead would leave it overlapping the beam on screen from the front cameras.
  const slideBody = new THREE.Group();
  const liftTop = BEAM_Y - 0.8 + 0.35 + MIDDLE_LIFT + 0.15;
  const column = new THREE.Mesh(roundedBox(0.3, liftTop, 0.3, 0.05), anodized('#252a33'));
  column.position.set(0, liftTop / 2, LIFT_Z);
  const foot = new THREE.Mesh(roundedBox(0.8, 0.24, 0.8, 0.06), anodized('#1c2027'));
  foot.position.set(0, 0.12, LIFT_Z);
  slideBody.add(column, foot);
  slideBody.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const carriage = new THREE.Group();
  const shoe = new THREE.Mesh(roundedBox(0.46, 0.7, 0.46, 0.06), anodized('#1c2027'));
  shoe.position.set(0, BEAM_Y - 0.8, LIFT_Z);
  shoe.castShadow = true;
  carriage.add(shoe);
  const middleMount = filterMount(films.middle.mat, dial, housingMat, indexMat, true);
  carriage.add(middleMount.group);
  slideBody.add(carriage);
  group.add(slideBody);
  const middle = { ...middleMount, carriage, slideBody };

  // ---- meter ----
  const meter = new THREE.Group();
  meter.add(carrier(1.2), post(RAIL_TOP + 0.28, BEAM_Y - 0.8, 0.13));
  // The housing lifts off in the exploded view to show the photodiode on its board.
  const meterHousing = new THREE.Group();
  const head = new THREE.Mesh(roundedBox(1.5, 1.8, 1.6, 0.16, 3), lacquer('#20242c'));
  head.position.y = BEAM_Y;
  const bezelRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 64).rotateY(Math.PI / 2), brass());
  bezelRing.position.set(-0.77, BEAM_Y, 0);
  const sensor = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48).rotateY(-Math.PI / 2), anodized('#07080b'));
  sensor.position.set(-0.765, BEAM_Y, 0);
  const meterSpot = glowSpot('#fff1df', 0);
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateY(-Math.PI / 2), meterSpot.material);
  spot.position.set(-0.78, BEAM_Y, 0);
  const meterFace = new DiegeticScreen(1.15, 0.62, 512);
  meterFace.mesh.position.set(0, BEAM_Y + 0.35, 0.81);
  meterHousing.add(head, bezelRing, sensor, meterFace.mesh);
  const board = new THREE.Mesh(roundedBox(0.08, 1.3, 1.3, 0.03, 1), anodized('#14403a'));
  board.position.set(-0.42, BEAM_Y, 0);
  const standoff = new THREE.Mesh(roundedBox(0.3, 0.2, 0.3, 0.04, 1), darkSteel('#4d525b'));
  standoff.position.set(-0.42, BEAM_Y - 0.72, 0);
  const diodeFrame = new THREE.Mesh(roundedBox(0.04, 0.64, 0.64, 0.02, 1), brass());
  diodeFrame.position.set(-0.47, BEAM_Y, 0);
  const diode = new THREE.Mesh(roundedBox(0.05, 0.5, 0.5, 0.02, 1), anodized('#090a0e'));
  diode.position.set(-0.5, BEAM_Y, 0);
  meter.add(meterHousing, board, standoff, diodeFrame, diode, spot);
  meter.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== spot && o !== meterFace.mesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(meter);

  const anchors = { lamp: new THREE.Object3D(), meter: new THREE.Object3D() };
  anchors.lamp.position.set(0, BEAM_Y + 1.25, 0);
  lamp.add(anchors.lamp);
  anchors.meter.position.set(0, BEAM_Y + 1.35, 0);
  meterHousing.add(anchors.meter);

  const xs = { ...LAB_X };
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  let slideNow = 0;
  const st = { lamp: 0, polarizer: 0, middle: 0, analyzer: 0, meter: 0, middleOnAxis: 0 };

  return {
    group, console: consoleGroup, bench, lamp, polarizer, middle, analyzer, meter, knob, anchors, meterSpot,
    stations: () => {
      // The beam steps at each film, wherever its cell has put it.
      st.lamp = xs.lamp + 1.35 + lampFront.position.x;
      st.polarizer = xs.polarizer + polarizer.film.position.x;
      st.middle = xs.middle + middle.film.position.x;
      st.analyzer = xs.analyzer + analyzer.film.position.x;
      st.meter = xs.meter + spot.position.x;
      st.middleOnAxis = slideNow;
      return st;
    },
    update(d) {
      const e = d.explode;
      for (const k of Object.keys(xs) as (keyof typeof xs)[]) xs[k] = lerp(LAB_X[k], EXPLODED_X[k], e);
      lamp.position.x = xs.lamp;
      polarizer.group.position.x = xs.polarizer;
      analyzer.group.position.x = xs.analyzer;
      slideBody.position.x = xs.middle;
      meter.position.x = xs.meter;
      // Exploded along the beam: films out of their cells, collimator forward, meter housing up.
      for (const f of [polarizer, middle, analyzer]) f.film.position.x = 1.5 * e;
      lampFront.position.x = 1.1 * e;
      meterHousing.position.y = 2.3 * e;
      spot.position.x = lerp(-0.78, -0.54, e);
      // The middle filter rides its lift from MIDDLE_LIFT above the beam down into it.
      carriage.position.y = lerp(MIDDLE_LIFT, 0, d.slide);
      // Its film covers the beam once its lower edge passes the axis.
      slideNow = 1 - THREE.MathUtils.smoothstep(carriage.position.y, FILM_R - 0.25, FILM_R + 0.05);
      polarizer.ring.rotation.x = 0;
      middle.ring.rotation.x = THREE.MathUtils.degToRad(d.middleAngle);
      analyzer.ring.rotation.x = THREE.MathUtils.degToRad(d.analyzer);
      // The pointer starts where the value arc starts (7:30) and turns clockwise with it: 0° to 180° over 270°.
      knob.rotation.z = THREE.MathUtils.degToRad(135 - d.analyzer * 1.5);
      sweep.value = (d.analyzer / 180) * 270;

      const r = read(d);
      const pct = r.through;
      // Light arriving at each film, following the beam (the middle counts as it covers the axis).
      const atAnalyzer = lerp(50, read({ ...d, middle: 'in' }).stages.afterMiddle ?? 50, slideNow);
      films.polarizer.glow.value = 1;
      films.middle.glow.value = 0.5 * slideNow;
      films.analyzer.glow.value = atAnalyzer / 100;
      meterSpot.intensity.value = 3.2 * (pct / 50);
      chart.draw([Math.round(d.analyzer * 4), d.middle, Math.round(d.middleAngle * 4)], (ctx, size) => {
        const plot = new Chart(ctx, { x: size.w * 0.09, y: size.h * 0.2, w: size.w * 0.86, h: size.h * 0.6 }, [0, 180], [0, 55]);
        plot.grid({ xStep: 45, yStep: 12.5 }).xLabels([0, 45, 90, 135, 180], (v) => `${v}°`);
        plot.region(80, 100, { label: 'dark' });
        plot.caption(d.middle === 'in' ? `Light through · middle at ${Math.round(d.middleAngle)}°` : 'Light through as the analyzer turns');
        if (d.middle === 'in') {
          plot.curve((x) => throughAt(x, null), { color: SCREEN_COLORS.text, glow: 0, width: 1.4, dash: [5, 5] });
          plot.curve((x) => throughAt(x, d.middleAngle));
        } else {
          plot.curve((x) => throughAt(x, null));
        }
        plot.marker(d.analyzer, pct, { drop: true }).annotate(d.analyzer, pct, `${pct.toFixed(1)}%`, { color: SCREEN_COLORS.cyan, dx: d.analyzer > 120 ? -14 : 14, dy: pct > 40 ? 14 : -12 });
      });
      meterScreen.draw([Math.round(pct * 10)], (ctx, size) => drawMeter(ctx, size, pct));
      meterFace.draw([Math.round(pct * 10)], (ctx, size) => {
        ctx.fillStyle = SCREEN_COLORS.cyan;
        ctx.font = `500 ${Math.round(size.h * 0.52)}px "DM Mono", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = SCREEN_COLORS.cyan;
        ctx.shadowBlur = size.h * 0.06;
        ctx.fillText(`${pct.toFixed(1)}%`, size.w / 2, size.h * 0.54);
      });
    },
  };
}

function drawMeter(ctx: CanvasRenderingContext2D, size: { w: number; h: number }, pct: number): void {
  const k = size.h / 256;
  ctx.fillStyle = SCREEN_COLORS.text;
  ctx.font = `500 ${Math.round(10 * k)}px "DM Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText('METER · % OF LAMP', size.w * 0.08, size.h * 0.1);
  // The meter reading is the hot value: cyan at every level, as in the THROUGH readout.
  ctx.fillStyle = SCREEN_COLORS.cyan;
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 4 * k;
  ctx.font = `500 ${Math.round(34 * k)}px "DM Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${pct.toFixed(1)}%`, size.w * 0.08, size.h * 0.47);
  ctx.shadowBlur = 0;
  const bx = size.w * 0.08;
  const by = size.h * 0.74;
  const bw = size.w * 0.84;
  const bh = size.h * 0.07;
  ctx.fillStyle = 'rgba(160,190,230,0.14)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = SCREEN_COLORS.cyan;
  ctx.shadowColor = SCREEN_COLORS.cyan;
  ctx.shadowBlur = 8 * k;
  ctx.fillRect(bx, by, (bw * Math.min(100, pct)) / 100, bh);
  ctx.shadowBlur = 0;
  ctx.fillStyle = SCREEN_COLORS.text;
  ctx.font = `500 ${Math.round(9 * k)}px "DM Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  for (const v of [0, 25, 50, 75, 100]) {
    ctx.textAlign = v === 0 ? 'left' : v === 100 ? 'right' : 'center';
    ctx.fillText(`${v}`, bx + (bw * v) / 100, by + bh + 6 * k);
  }
}
