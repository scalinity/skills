// Wiring: stage, sets, apparatus, camera rig, HUD, labels, loupe, input paths, keys, cinematic,
// tune panel and the debug handle. One state object; every input path writes it through
// setState(); the scene, HUD, labels and screens read the eased display values every frame.

import '@fontsource-variable/outfit';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import * as THREE from 'three/webgpu';
import {
  bindKeys, buildExplodedStage, buildLabSet, buildStudioSet, CameraRig, Cinematic, cloneLooks, createStage, crystal,
  Eased, fmt, HOUSE_LOOKS, hudText, installDebugHandle, Lesson, Loupe, lowPoly, makeRng, mountHud, mountTune,
  opensWithTour, PartDragger, plainLoad, prefersReducedMotion, readUrlParams, WorldLabels, type HeroShot, type PoseSpec,
  type Shot, type Vec3,
} from './kit';
import { caption, PRESETS, schema } from './hud/schema';
import { DEFAULT_STATE, insideAngle, N_BK7, readouts, TILT_MAX, TILT_MIN, type SlabState } from './model/slab';
import { BEAM_Y, buildApparatus } from './scene/apparatus';

const params = readUrlParams();
const instant = params.instant || prefersReducedMotion();
const root = document.getElementById('app') as HTMLElement;
const world = document.getElementById('world') as HTMLElement;

const hud = mountHud(root, schema);
const looks = cloneLooks(HOUSE_LOOKS);
const stage = await createStage({
  container: world, looks, initialLook: 'lab', lightTarget: { x: 0, y: 1, z: 0 }, forceWebGL: params.backend === 'webgl2',
});
const { scene, camera } = stage;

// ---------- scene ----------
const app = buildApparatus();
scene.add(app.group);
stage.registerSet('console', app.console);
stage.registerSet('rail', app.rail);

// Background echo of the topic: glass blocks and a prism on the top shelf, out of focus.
const echo = new THREE.Group();
const rng = makeRng(params.seed ?? 11);
const glassMat = crystal('#e3f6ff');
for (let i = 0; i < 4; i++) {
  const g = i === 2
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 3).rotateZ(Math.PI / 2), glassMat)
    : new THREE.Mesh(lowPoly.crystal(rng, { height: 1.4 + rng(), radius: 0.4 }), glassMat);
  g.position.set(-3 + i * 1.9, 0.8, 0);
  echo.add(g);
}
const lab = buildLabSet({ floorY: -8.85, seed: params.seed ?? 3 });
lab.anchors.shelf.add(echo);
scene.add(lab.group);
stage.registerSet('room', lab.group);
const exploded = buildExplodedStage({ makerPlate: ['DANIEL ESCALANTE', 'GLASS SLAB · 2026'], width: 24, depth: 9 });
exploded.group.position.y = -0.27 - exploded.top;
scene.add(exploded.group);
stage.registerSet('plinth', exploded.group);
const studio = buildStudioSet({ floorY: -0.005 });
scene.add(studio);
stage.registerSet('cyclorama', studio);

// ---------- state ----------
const state: SlabState = { ...DEFAULT_STATE };
const tilt = new Eased(state.tilt);
const explode = new Eased(0);
let presetId: string | null = null;

function matchPreset(): string | null {
  return PRESETS.find((p) => p.state.slab === state.slab && Math.abs(p.state.tilt - state.tilt) < 0.25)?.id ?? null;
}

function setState(partial: Partial<SlabState>, o: { tween?: boolean; instant?: boolean } = {}): void {
  if (partial.tilt !== undefined) {
    state.tilt = THREE.MathUtils.clamp(partial.tilt, TILT_MIN, TILT_MAX);
    if (o.instant || instant) tilt.jump(state.tilt);
    else if (o.tween) tilt.to(state.tilt, 0.9);
    else tilt.follow(state.tilt);
  }
  if (partial.slab !== undefined) state.slab = partial.slab;
  presetId = matchPreset();
  hud.setPreset(presetId);
  hud.setControl('slab', state.slab);
  stage.invalidateShadows();
}

function applyPreset(i: number, o: { instant?: boolean } = {}): void {
  const p = PRESETS[i];
  if (!p) return;
  setState(p.state, { tween: true, instant: o.instant });
}

// ---------- camera ----------
const views: Record<string, HeroShot> = {
  lab: { target: [0.3, 0.2, 0.6], yaw: -0.36, pitch: 0.17, fit: { width: 16.5, height: 9 }, bounds: lab.bounds, limits: { zoom: [0.45, 1.25], pan: 6 } },
  exploded: { target: [0, 0.4, 0], yaw: -0.36, pitch: 0.24, fit: { width: 25, height: 8 } },
  studio: { target: [0, 1.5, 0], yaw: 0.46, pitch: 0.2, fit: { width: 15.5, height: 5 } },
};
const CLOSEUP: PoseSpec = { target: [0, BEAM_Y, 0], yaw: -0.32, pitch: 0.16, distance: 9 };
let dragger: PartDragger | null = null;
const rig = new CameraRig(camera, world, views, {
  safeArea: () => hud.safeArea(),
  interactionFilter: (e) => dragger?.filter(e) ?? true,
});
rig.idleDrift = !params.instant;
// Depth of field focuses on the phenomenon, not on the orbit target.
rig.focusPoint = new THREE.Vector3(0, BEAM_Y, 0);
// The bench's two ends: looking along the beam widens the focus band so the whole bench stays sharp.
const benchEnds: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
rig.focusSpan = benchEnds;
const FOCUS_BAND = stage.uniforms.focusBand.value;

async function setView(name: string, o: { instant?: boolean } = {}): Promise<void> {
  if (!views[name]) return;
  hud.setView(name);
  const inst = o.instant || instant;
  await stage.setLook(name, {
    instant: inst,
    onSwap: () => {
      void rig.setView(name, { instant: true });
      explode.jump(0);
      if (name === 'exploded') {
        if (inst) explode.jump(1);
        else explode.to(1, 1.2);
      }
      loupe.setVisible(name !== 'studio');
      stage.invalidateShadows();
    },
  });
}

stage.onLook((look) => hud.setLightTheme(look.hudTheme === 'light'));

// ---------- in-world information ----------
const labels = new WorldLabels(scene, camera, root);
/** Shift+N, the card's labels tool, ?labels= and the debug handle all switch labels here, so the tool shows the state. */
function setLabels(visible: boolean): void {
  labels.setVisible(visible);
  hud.setTool('labels', visible);
}
setLabels(labels.visible);
let shown = readouts(state);
labels.add(app.anchors.lamp, { name: 'Lamp', value: () => 'white', color: 'amber' });
const slabLabel = labels.add(app.anchors.slab, {
  name: 'Slab', color: 'cyan', leader: true,
  value: () => (state.slab === 'in' ? `bends ${fmt.angle(Math.abs(shown.inside ?? 0))}` : 'out'),
});
labels.add(app.anchors.target, { name: 'Target', color: 'cyan', value: () => `${fmt.num(Math.abs(shown.shift), 1)} cm aside` });
// Amber hint pills on the parts themselves, each shown only while a lesson step waits on that part:
// below the beam, toward the viewer, clear of the beam and of the part's own label.
const hintPill = { color: 'amber', priority: -1, occlude: false };
const tiltHint = labels.add(app.anchors.slab, { name: 'Drag the slab to tilt it', ...hintPill, offset: { x: 0, y: -2.7, z: 0.8 } });
const outHint = labels.add(app.anchors.slab, { name: 'Shift+S slides it out', ...hintPill, offset: { x: 0, y: -2.7, z: 0.8 } });
for (const h of [tiltHint, outHint]) h.setVisible(false);

// A drawing, not a simulation: wavefronts slow and crowd together inside the glass (spacing 1 : n).
const loupe = new Loupe({
  radius: 1.3, title: 'Wavefronts ×20,000', anchor: app.anchors.slab, focus: stage.uniforms.focusDistance,
  draw: (g, size, t) => {
    const th = THREE.MathUtils.degToRad(Math.abs(tilt.value));
    const tt = THREE.MathUtils.degToRad(Math.abs(insideAngle(tilt.value)));
    g.fillStyle = '#0a1426';
    g.fillRect(0, 0, size, size);
    g.fillStyle = state.slab === 'in' ? '#123049' : '#0a1426';
    g.fillRect(size / 2, 0, size / 2, size);
    const lambda = size / 9;
    g.lineWidth = size / 170;
    g.strokeStyle = '#7fe3ff';
    g.shadowColor = '#7fe3ff';
    g.shadowBlur = size / 60;
    const phase = (t * 0.6) % 1;
    const drawSide = (dir: [number, number], spacing: number, x0: number, x1: number) => {
      g.save();
      g.beginPath();
      g.rect(x0, 0, x1 - x0, size);
      g.clip();
      for (let k = -14; k < 14; k++) {
        const d = (k + phase) * spacing;
        // Points p with p·dir = d relative to the center; draw a long line perpendicular to dir.
        const cx = size / 2 + dir[0] * d;
        const cy = size / 2 - dir[1] * d;
        g.beginPath();
        g.moveTo(cx - dir[1] * size, cy - dir[0] * size);
        g.lineTo(cx + dir[1] * size, cy + dir[0] * size);
        g.stroke();
      }
      g.restore();
    };
    drawSide([Math.cos(th), Math.sin(th)], lambda, 0, size / 2);
    if (state.slab === 'in') drawSide([Math.cos(tt), Math.sin(tt)], lambda / N_BK7, size / 2, size);
    else drawSide([Math.cos(th), Math.sin(th)], lambda, size / 2, size);
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(230,245,255,0.55)';
    g.lineWidth = size / 220;
    g.beginPath();
    g.moveTo(size / 2, 0);
    g.lineTo(size / 2, size);
    g.stroke();
  },
});
loupe.group.position.set(3.1, 4.7, -1.4);
loupe.addTo(scene);
labels.keepClearOf(loupe, slabLabel);

// ---------- input paths: drag the part, the console knob, the HUD, keys ----------
dragger = new PartDragger(camera, world, hud);
const up = new THREE.Vector3(0, 1, 0);
dragger.add({
  object: app.slab, tip: 'Drag to tilt the slab',
  enabled: () => state.slab === 'in',
  mode: { kind: 'rotate', axis: up, center: () => app.slab.getWorldPosition(new THREE.Vector3()), onTurn: (r) => setState({ tilt: state.tilt - THREE.MathUtils.radToDeg(r) }) },
});
dragger.add({
  object: app.knob, tip: 'Turn the knob to tilt the slab',
  mode: { kind: 'rotate', axis: new THREE.Vector3(0, 0, 1), center: () => app.knob.getWorldPosition(new THREE.Vector3()), onTurn: (r) => setState({ tilt: state.tilt - THREE.MathUtils.radToDeg(r) / 3 }) },
});

// ---------- lesson ----------
// "Let me try" beside the presets' "show me": each step asks for one thing in the caption, waits until
// the model shows it done, then answers with the visitor's own numbers. Tour shot one performs the same
// steps. Replace these with your exhibit's lesson (EXHIBIT.md, Lesson).
const settled = () => tilt.settled;
const lesson = new Lesson([
  {
    ask: 'Drag the slab to tilt it.',
    hint: tiltHint,
    enter: () => setState({ tilt: 0, slab: 'in' }, { tween: true }),
    done: () => state.slab === 'in' && Math.abs(state.tilt) >= 20 && settled(),
    said: () => `Tilted {amber:${fmt.angle(Math.abs(state.tilt))}}, the beam bends to {text:${fmt.angle(Math.abs(insideAngle(state.tilt)))}} inside the glass and leaves parallel, {cyan:${fmt.num(Math.abs(readouts(state).shift), 1)} cm} aside.`,
    perform: () => setState({ tilt: 30 }, { tween: true }),
  },
  {
    ask: 'Tilt it further, past 50°.',
    hint: tiltHint,
    done: () => state.slab === 'in' && Math.abs(state.tilt) >= 50 && settled(),
    said: () => `At {amber:${fmt.angle(Math.abs(state.tilt))}} it steps {cyan:${fmt.num(Math.abs(readouts(state).shift), 1)} cm} aside: the steeper the slab, the longer the path through the glass.`,
    perform: () => setState({ tilt: 60 }, { tween: true }),
  },
  {
    ask: 'Now slide the slab out of the beam.',
    hint: outHint,
    done: () => state.slab === 'out' && settled(),
    hold: 0.3,
    said: () => `Without the glass the beam runs straight, {cyan:${fmt.num(Math.abs(readouts(state).shift), 1)} cm} aside. Its two bends were equal and opposite, so it kept its direction and only its place moved: that is **refraction** at both faces.`,
    perform: () => setState({ slab: 'out' }),
  },
], {
  onChange: (on) => {
    hud.setTool('lesson', on);
    if (on) cinematic.stop();
  },
});

// ---------- cinematic ----------
const SLAB: Vec3 = [0, BEAM_Y, 0];
const LOUPE_AT = loupe.group.position.toArray() as Vec3;
const step = (i: number) => lesson.perform(i);
// The opening, in the Lab only: a few seconds wide and slow, then closer and lower, every shot still
// moving, the experiment starting in shot three. Shot one's setup resets the bench in the black, so
// the loop closes without a seam. Replace these with your exhibit's shots (EXHIBIT.md).
const shots: Shot[] = [
  // Wide and slow, the room at dusk: a 17° arc and nothing else moving.
  { view: 'lab', pose: { yaw: -0.6, pitch: 0.2, distanceScale: 1.04 }, dolly: { yaw: 0.3 }, hold: 9, setup: () => applyPreset(0, { instant: true }) },
  // Closer and lower, tracking along the rail from the lamp end, the beam at eye level.
  { view: 'lab', pose: { target: [-3, BEAM_Y, 0], yaw: -0.8, pitch: 0.05, distance: 13 }, dolly: { pan: [4, 0, 0], yaw: 0.1 }, hold: 9 },
  // Arcing round the slab as the lesson's first two steps play: tilted, then steep.
  { view: 'lab', pose: CLOSEUP, dolly: { yaw: 0.22, distanceScale: 0.95 }, hold: 10, focus: SLAB, beats: [[1, step(0)], [5, step(1)]] },
  // Round the loupe: the wavefronts crowd and turn inside the glass.
  { view: 'lab', pose: { target: LOUPE_AT, yaw: -0.4, pitch: 0.05, distance: 9 }, dolly: { yaw: 0.28 }, hold: 9, focus: LOUPE_AT, beats: [[0.5, () => setState({ tilt: 50 }, { tween: true })]] },
  // The payoff, low and slow: tilted, then the slab slides out and the beam runs straight.
  { view: 'lab', pose: { yaw: -0.2, pitch: 0.07, distanceScale: 0.82 }, dolly: { yaw: -0.25 }, hold: 10, setup: () => applyPreset(1, { instant: true }), beats: [[3, step(2)]] },
];
/** The tour is playing as the opening: the control card waits faded until the first input. */
let opening = false;
/** The opening just ended: next frame the lesson invites the visitor, unless their input chose something else. */
let handover = false;
const cinematic = new Cinematic(shots, {
  rig, setView: (n) => setView(n), fade: (to, ms, color) => stage.fade(to, ms, color),
  onChange: (on) => {
    hud.setTool('cinematic', on);
    if (on) lesson.stop();
    else if (opening) {
      opening = false;
      hud.setPresenting(false);
      handover = true;
    }
  },
});
dragger.onInput = () => cinematic.stop();

hud.on('control', (id, v) => {
  cinematic.stop();
  if (id === 'tilt') setState({ tilt: Number(v) });
  if (id === 'slab') setState({ slab: v === 'out' ? 'out' : 'in' });
});
/** A setup the visitor picks ("show me") ends the lesson. */
function pick(i: number): void {
  handover = false;
  lesson.stop();
  applyPreset(i);
}
function toggleLesson(): void {
  handover = false;
  lesson.toggle();
}
hud.on('preset', (id) => {
  cinematic.stop();
  pick(PRESETS.findIndex((p) => p.id === id));
});
hud.on('view', (name) => {
  cinematic.stop();
  void setView(String(name));
});
hud.on('tool', (id) => {
  if (id === 'help') hud.openHelp();
  if (id === 'cinematic') cinematic.toggle();
  if (id === 'labels') setLabels(!labels.visible);
  if (id === 'lesson') toggleLesson();
});

const viewOrder = schema.views;
bindKeys(schema.keys, {
  '1': () => pick(0),
  '2': () => pick(1),
  '3': () => pick(2),
  '4': () => pick(3),
  '[': (e) => setState({ tilt: state.tilt - (e.shiftKey ? 5 : 0.5) }),
  ']': (e) => setState({ tilt: state.tilt + (e.shiftKey ? 5 : 0.5) }),
  '0': () => setState({ tilt: 0 }, { tween: true }),
  'Shift+S': () => setState({ slab: state.slab === 'in' ? 'out' : 'in' }),
  'Shift+V': () => void setView(viewOrder[(viewOrder.indexOf(rig.view as (typeof viewOrder)[number]) + 1) % viewOrder.length]),
  'Shift+X': () => void setView('exploded'),
  L: () => toggleLesson(),
  C: () => cinematic.toggle(),
  R: () => void rig.reset(),
  'Shift+N': () => setLabels(!labels.visible),
  '/': () => hud.setUiVisible(!hud.uiVisible),
  H: () => hud.setCompact(!hud.compact),
}, { repeat: ['[', ']'] });

mountTune(root, { stage, rig });

// ---------- frame ----------
const last = { tilt: '', inside: '', shift: '', caption: '' };
stage.onFrame((dt) => {
  cinematic.update(dt);
  const display = { tilt: tilt.update(dt), slab: state.slab, explode: explode.update(dt) };
  app.update(display);
  shown = readouts(display);
  const t = fmt.angle(shown.tilt, { signed: true });
  if (t !== last.tilt) hud.setStat('tilt', (last.tilt = t));
  const inside = shown.inside === null ? '' : fmt.angle(Math.abs(shown.inside));
  if (inside !== last.inside) hud.setStat('inside', (last.inside = inside) || null);
  const shift = fmt.num(Math.abs(shown.shift), 1);
  if (shift !== last.shift) hud.setStat('shift', (last.shift = shift), 'cm');
  lesson.update(dt);
  if (handover) {
    handover = false;
    lesson.start();
  }
  // While the lesson runs, the caption is its request and its answers; otherwise the live sentence.
  const c = lesson.caption(caption(display, shown));
  if (c !== last.caption) hud.setCaption((last.caption = c));
  root.classList.toggle('lesson-on', lesson.speaking);
  hud.setControl('tilt', display.tilt);
  rig.update(dt);
  lab.cutaway(camera);
  stage.uniforms.focusDistance.value = rig.focusDistance;
  app.anchors.lamp.getWorldPosition(benchEnds[0]);
  app.anchors.target.getWorldPosition(benchEnds[1]);
  stage.uniforms.focusBand.value = FOCUS_BAND + Math.max(0, rig.focusSpanDepth - 4) * 5;
  labels.update(dt);
  labels.render();
  loupe.update(dt, camera);
});
stage.onResize((w, h) => {
  labels.setSize(w, h);
  rig.refit();
});

// ---------- start ----------
async function boot(): Promise<void> {
  setState({}, { instant: true });
  await stage.start();
  if (params.view && views[params.view]) await setView(params.view, { instant: true });
  if (params.orbit) rig.setPose(rig.orbitPose(params.orbit.yaw, params.orbit.pitch, params.orbit.distanceScale));
  if (params.preset) applyPreset(params.preset - 1, { instant: params.instant });
  if (params.ui === false) hud.setUiVisible(false, { quiet: true });
  if (params.compact) hud.setCompact(true);
  if (params.labels !== null) setLabels(params.labels);
  if (params.pose === 'closeup') rig.setPose(rig.resolve(CLOSEUP));
  // A plain first load opens with the tour, the control card faded away, and the first input hands over
  // to the lesson. Reduced motion opens still on the lesson's first step; links and captures open still.
  if (opensWithTour(params)) {
    opening = true;
    hud.setPresenting(true);
    cinematic.play(0, { opening: true });
    hud.hint(matchMedia('(pointer: coarse)').matches ? 'Tap to take over' : 'Drag, click or press a key to take over', 4200);
  } else if (plainLoad(params)) {
    lesson.start();
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// Development only (stripped from builds): inspect the scene from the browser console.
if (import.meta.env.DEV) Object.assign(window, { __dev: { THREE, stage, rig, app, labels, loupe, cinematic, lesson } });

installDebugHandle({
  ready: boot(),
  backend: stage.backend,
  fps: () => stage.fps(),
  fpsStats: (ms) => stage.fpsStats(ms),
  getState: () => ({ ...state, view: rig.view, preset: presetId, readouts: readouts(state) }),
  setState: (p, o) => setState(p as Partial<SlabState>, { instant: o?.instant ?? true }),
  applyPreset: (i) => applyPreset(i - 1, { instant: true }),
  setView: (name, o) => setView(name, o),
  setUi: (v) => hud.setUiVisible(v, { quiet: true }),
  setCompact: (on) => hud.setCompact(on),
  setLabels,
  cinematic: (on) => (on ? cinematic.play() : cinematic.stop()),
  lesson: (on) => (on ? lesson.start() : lesson.stop()),
  pose: (name) => rig.setPose(name === 'closeup' ? rig.resolve(CLOSEUP) : rig.heroPose()),
  orbit: (y, p, s) => rig.setPose(rig.orbitPose(y, p, s)),
  text: () => hudText(root),
});
