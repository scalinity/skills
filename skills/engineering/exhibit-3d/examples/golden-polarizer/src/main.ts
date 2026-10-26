// Polarizer bench: wiring. One state object; every input path (drag a ring, the console knob, the
// card, keys, click the middle mount) writes it through setState(); the scene, HUD, labels,
// screens and loupe read the eased display values every frame.

import '@fontsource-variable/outfit';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import * as THREE from 'three/webgpu';
import {
  bindKeys, buildExplodedStage, buildLabSet, buildStudioSet, CameraRig, Cinematic, cloneLooks, createStage, Eased, fmt,
  HOUSE_LOOKS, hudText, installDebugHandle, Lesson, Loupe, mountHud, mountTune, opensWithTour, PartDragger, plainLoad,
  prefersReducedMotion, readUrlParams, WorldLabels, type HeroShot, type PoseSpec, type Shot, type Vec3,
} from './kit';
import { caption, PRESETS, schema } from './hud/schema';
import { ANGLE_MAX, ANGLE_MIN, DEFAULT_STATE, read, type BenchState } from './model/polarizer';
import { BEAM_Y, buildApparatus, LAB_X, type Display } from './scene/apparatus';
import { buildEcho } from './scene/echo';
import { Field } from './scene/field';
import { filmDrawing } from './scene/film-loupe';

const params = readUrlParams();
const instant = params.instant || prefersReducedMotion();
const root = document.getElementById('app') as HTMLElement;
const world = document.getElementById('world') as HTMLElement;

const hud = mountHud(root, schema);
const looks = cloneLooks(HOUSE_LOOKS);
looks.lab.sets = ['room', 'console', 'bench'];
// A little more dusk haze than the house default, a shade lighter than the wall, so the room steps
// back behind the bench in planes.
looks.lab.fog = { color: '#252e43', density: 0.0105 };
looks.exploded.sets = ['plinth', 'bench'];
looks.studio.sets = ['cyclorama'];
// On paper the beam needs a deeper core; its shade (house beamShade) gives it an edge.
looks.studio.beamGain = 0.8;
// On the plinth the glossy breadboard mirrors the beam as a broad hot patch, and the warm key turns
// the plinth's left slope muddy: both softened so the beam stays the brightest thing.
looks.exploded.reflection = 0.22;
looks.exploded.key.intensity = 1.25;
looks.exploded.rim.relative = 0.35;
looks.exploded.environmentIntensity = 0.62;
looks.exploded.hemisphere.intensity = 0.4;
const stage = await createStage({
  container: world, looks, initialLook: 'lab', lightTarget: { x: 0, y: 1.6, z: 0 }, forceWebGL: params.backend === 'webgl2',
});
const { scene, camera } = stage;

// ---------- scene ----------
const app = buildApparatus();
scene.add(app.group);
stage.registerSet('console', app.console);
stage.registerSet('bench', app.bench);
const field = new Field();
scene.add(field.group);

const FLOOR_Y = -9.05;
const lab = buildLabSet({ floorY: FLOOR_Y, seed: params.seed ?? 5 });
// The echo hangs in the window: polarizer discs that shade the window light with Malus's law.
const echo = buildEcho(lab.window, lab.anchors.window, FLOOR_Y + 44);
scene.add(lab.group);
stage.registerSet('room', lab.group);
const exploded = buildExplodedStage({ makerPlate: ['DANIEL ESCALANTE', 'POLARIZER BENCH · 2026'], width: 23, depth: 9.5 });
exploded.group.position.y = -0.27 - exploded.top;
scene.add(exploded.group);
stage.registerSet('plinth', exploded.group);
const studio = buildStudioSet({ floorY: -0.005 });
scene.add(studio);
stage.registerSet('cyclorama', studio);

// ---------- state ----------
const state: BenchState = { ...DEFAULT_STATE };
const analyzer = new Eased(state.analyzer);
const middleAngle = new Eased(state.middleAngle);
const slide = new Eased(state.middle === 'in' ? 1 : 0);
const explode = new Eased(0);
let presetId: string | null = null;

const clampAngle = (v: number) => THREE.MathUtils.clamp(v, ANGLE_MIN, ANGLE_MAX);

function matchPreset(): string | null {
  return PRESETS.find((p) => p.state.middle === state.middle && Math.abs(p.state.analyzer - state.analyzer) < 0.25
    && (state.middle === 'out' || Math.abs(p.state.middleAngle - state.middleAngle) < 0.25))?.id ?? null;
}

function setState(partial: Partial<BenchState>, o: { tween?: boolean; seconds?: number; instant?: boolean } = {}): void {
  const jump = o.instant || instant;
  const move = (e: Eased, v: number) => (jump ? e.jump(v) : o.tween ? e.to(v, o.seconds ?? 0.9) : e.follow(v));
  if (partial.analyzer !== undefined) move(analyzer, (state.analyzer = clampAngle(partial.analyzer)));
  if (partial.middleAngle !== undefined) move(middleAngle, (state.middleAngle = clampAngle(partial.middleAngle)));
  if (partial.middle !== undefined && partial.middle !== state.middle) {
    state.middle = partial.middle;
    if (jump) slide.jump(state.middle === 'in' ? 1 : 0);
    else slide.to(state.middle === 'in' ? 1 : 0, 0.8);
  } else if (partial.middle !== undefined && jump) {
    slide.jump(state.middle === 'in' ? 1 : 0);
  }
  presetId = matchPreset();
  hud.setPreset(presetId);
  hud.setControl('middle', state.middle);
  hud.setControlEnabled('middleAngle', state.middle === 'in');
  stage.invalidateShadows();
}

function applyPreset(i: number, o: { instant?: boolean } = {}): void {
  const p = PRESETS[i];
  if (p) setState(p.state, { tween: true, instant: o.instant });
}

// ---------- camera ----------
const views: Record<string, HeroShot> = {
  lab: { target: [0.3, 0.2, 1.2], yaw: -0.3, pitch: 0.2, fit: { width: 17.2, height: 11.2 }, bounds: lab.bounds, limits: { zoom: [0.45, 1.25], pan: 6 } },
  // The whole plinth, with navy margin on every side.
  exploded: { target: [0.3, 1.4, 0.6], yaw: -0.2, pitch: 0.1, fit: { width: 23.5, height: 9.6 } },
  studio: { target: [0, 1.6, 0], yaw: 0.42, pitch: 0.17, fit: { width: 17.5, height: 5.6 } },
};
const CLOSEUP: PoseSpec = { target: [3.3, BEAM_Y, 0], yaw: -0.62, pitch: 0.1, distance: 9.5 };
let dragger: PartDragger | null = null;
const rig = new CameraRig(camera, world, views, {
  safeArea: () => hud.safeArea(),
  interactionFilter: (e) => dragger?.filter(e) ?? true,
});
rig.idleDrift = !params.instant;
// Depth of field focuses on the beam between the filters.
rig.focusPoint = new THREE.Vector3(0, BEAM_Y, 0);
// The rail's two ends: looking along the rail widens the focus band so the whole bench stays sharp.
const railEnds: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(LAB_X.lamp, BEAM_Y, 0), new THREE.Vector3(LAB_X.meter, BEAM_Y, 0)];
rig.focusSpan = railEnds;

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
// Studio is a beauty shot: a deeper focus band keeps the lamp and the meter sharp.
const FOCUS_BAND = stage.uniforms.focusBand.value;
let lookBand = FOCUS_BAND;
stage.onLook((look) => {
  hud.setLightTheme(look.hudTheme === 'light');
  lookBand = look.name === 'studio' ? FOCUS_BAND * 2.4 : FOCUS_BAND;
});

// ---------- in-world information ----------
const labels = new WorldLabels(scene, camera, root);
/** Shift+N, the card's labels tool, ?labels= and the debug handle all switch labels here, so the tool shows the state. */
function setLabels(visible: boolean): void {
  labels.setVisible(visible);
  hud.setTool('labels', visible);
}
setLabels(labels.visible);
let shown = read(state);
labels.add(app.anchors.lamp, { name: 'Lamp', value: () => 'unpolarized', color: 'amber', priority: 1 });
// Filter anchors sit on top of each housing; the pills float a little under 0.1 m above.
const pill = { x: 0, y: 0.97, z: 0 };
labels.add(app.polarizer.label, { name: 'Polarizer', value: () => '0°', color: 'cyan', priority: 2, offset: pill });
const middleLabel = labels.add(app.middle.label, {
  name: 'Middle filter', color: 'cyan', leader: true, priority: 0, offset: pill,
  value: () => (state.middle === 'in' ? fmt.angle(middleAngle.value, { decimals: 0 }) : 'out'),
});
// On phones (hud-spec: ≤ 900 wide) the lifted filter's pill would run into the loupe; the card shows Out/In there.
const phone = matchMedia('(max-width: 900px)');
const fitMiddleLabel = () => middleLabel.setVisible(!phone.matches);
phone.addEventListener('change', fitMiddleLabel);
fitMiddleLabel();
const analyzerLabel = labels.add(app.analyzer.label, { name: 'Analyzer', color: 'cyan', leader: true, priority: 4, offset: pill, value: () => fmt.angle(analyzer.value, { decimals: 0 }) });
labels.add(app.anchors.meter, { name: 'Meter', color: 'cyan', priority: 3, value: () => `${fmt.percent(shown.through)} of lamp` });
// Amber hint pills on the parts themselves, as the house does, each shown only while a lesson step
// waits on that part.
const hintPill = { color: 'amber', priority: -1, offset: { x: 0, y: 0, z: 0 }, occlude: false };
const turnHint = labels.add(app.analyzer.hint, { name: 'Drag the ring to turn it', ...hintPill });
// The lifted filter's own hint anchor sits on the beam, so the click hint rides the carriage's shoe, below it.
const shoeHint = new THREE.Object3D();
shoeHint.position.set(-0.3, 0, 0.75);
app.middle.carriage.add(shoeHint);
const lowerHint = labels.add(shoeHint, { name: 'Click to lower it', ...hintPill });
const middleHint = labels.add(app.middle.hint, { name: 'Drag its ring to turn it', ...hintPill });
for (const h of [turnHint, lowerHint, middleHint]) h.setVisible(false);

const loupeAnchor = new THREE.Object3D();
loupeAnchor.position.set(0, BEAM_Y + 0.75, 0);
app.analyzer.group.add(loupeAnchor);
const loupe = new Loupe({
  radius: 1.3, title: 'Polarizing film ×20,000', anchor: loupeAnchor, focus: stage.uniforms.focusDistance, fps: 30, pixels: 1024,
  draw: filmDrawing(() => {
    const d = display();
    const on = app.stations().middleOnAxis > 0.5;
    const r = read({ ...d, middle: on ? 'in' : 'out' });
    return { analyzer: d.analyzer, incomingPlane: on ? d.middleAngle : 0, incoming: r.stages.afterMiddle ?? r.stages.afterPolarizer };
  }),
});
// Above the analyzer it shows, high enough to clear the analyzer's label; it follows the analyzer
// when the bench explodes.
const LOUPE_HOME = new THREE.Vector3(0.1, 6.55, -1.4);
// Placed from the assembled layout: the apparatus is laid out on the first frame, after the cinematic
// shots below have read this position for the push into the loupe.
loupe.group.position.copy(LOUPE_HOME).setX(LAB_X.analyzer + LOUPE_HOME.x);
loupe.addTo(scene);
labels.keepClearOf(loupe, analyzerLabel);

// ---------- input paths ----------
dragger = new PartDragger(camera, world, hud);
const xAxis = new THREE.Vector3(1, 0, 0);
const deg = THREE.MathUtils.radToDeg;
dragger.add({
  object: app.analyzer.grip, tip: 'Drag to turn the analyzer',
  mode: {
    kind: 'rotate', axis: xAxis, center: () => app.analyzer.center(),
    onTurn: (r) => setState({ analyzer: state.analyzer + deg(r) }),
  },
});
dragger.add({
  object: app.middle.grip, tip: 'Drag to turn the middle filter', enabled: () => state.middle === 'in',
  mode: { kind: 'rotate', axis: xAxis, center: () => app.middle.center(), onTurn: (r) => setState({ middleAngle: state.middleAngle + deg(r) }) },
});
dragger.add({
  object: app.middle.carriage, tip: () => (state.middle === 'in' ? 'Click to lift the middle filter out' : 'Click to lower the middle filter in'),
  mode: { kind: 'click', onClick: () => setState({ middle: state.middle === 'in' ? 'out' : 'in' }) },
});
dragger.add({
  object: app.knob, tip: 'Turn the knob to turn the analyzer',
  mode: { kind: 'rotate', axis: new THREE.Vector3(0, 0, 1), center: () => app.knob.getWorldPosition(new THREE.Vector3()), onTurn: (r) => setState({ analyzer: state.analyzer - deg(r) / 1.5 }) },
});

// ---------- lesson ----------
// "Let me try" beside the presets' "show me": each step asks for one thing in the caption, waits until
// the bench shows it done, then answers with the visitor's own numbers. Tour shot one performs the
// same steps.
const sweep = (to: number, seconds: number) => () => setState({ analyzer: to }, { tween: true, seconds });
const settled = () => analyzer.settled && middleAngle.settled && slide.settled;
const now = () => read(state);
const lesson = new Lesson([
  {
    ask: 'Drag the analyzer\'s brass ring partway round, to about 45°.',
    hint: turnHint,
    enter: () => setState({ analyzer: 0, middle: 'out' }, { tween: true }),
    done: () => state.analyzer >= 20 && state.analyzer <= 70 && settled(),
    said: () => `At {amber:${fmt.angle(state.analyzer)}} the analyzer passes cos²θ = {text:${fmt.num(now().factor, 3)}} of the light reaching it: {cyan:${fmt.percent(now().through)}} of the lamp.`,
    perform: () => setState({ analyzer: 45 }, { tween: true }),
  },
  {
    ask: 'Keep turning until the meter reads zero.',
    hint: turnHint,
    done: () => now().through < 0.05 && settled(),
    hold: 0.8,
    said: () => `The meter reads {cyan:${fmt.percent(now().through)}} at {amber:${fmt.angle(state.analyzer)}}: crossed, the analyzer passes only oscillation the polarizer already removed.`,
    perform: sweep(90, 5),
  },
  {
    ask: 'Now click the middle filter to lower it into the beam.',
    hint: lowerHint,
    // The lifted filter turns to 15° first, so the light it lets back is faint and the brightest angle is left to find.
    enter: () => setState({ middleAngle: 15 }, { tween: true }),
    done: () => state.middle === 'in' && settled(),
    hold: 0.3,
    said: () => `A third filter at {amber:${fmt.angle(state.middleAngle)}}, and {cyan:${fmt.percent(now().through)}} of the lamp gets through two crossed filters.`,
    perform: () => setState({ middle: 'in', middleAngle: 15 }, { tween: true }),
  },
  {
    ask: 'Turn the middle filter to find where the most light gets through.',
    hint: middleHint,
    done: () => state.middle === 'in' && now().through >= 12.3 && settled(),
    hold: 0.6,
    said: () => `You found {cyan:${fmt.percent(now().through)}} at {amber:${fmt.angle(state.middleAngle)}}. Each filter passes cos² of its turn from the one before, so at 45° each keeps half: that is **Malus's law**, once per filter.`,
    perform: () => setState({ middleAngle: 45 }, { tween: true, seconds: 2.5 }),
  },
], {
  onChange: (on) => {
    hud.setTool('lesson', on);
    if (on) cinematic.stop();
  },
});

// ---------- cinematic ----------
// The close-ups aim at these and focus on them.
const ANALYZER: Vec3 = [LAB_X.analyzer, BEAM_Y, 0];
const LOUPE_AT = loupe.group.position.toArray() as Vec3;
// The console's two screens, between the chart (x −0.9) and the meter screen (x 5.2).
const SCREENS: Vec3 = [0.5, -2.3, 4.16];
const WINDOW = lab.window.center.toArray() as Vec3;
// Halfway up from the bench toward the window: the shot looks over the bench at the discs.
const OVER_BENCH: Vec3 = [WINDOW[0], 9, -20];
const step = (i: number) => lesson.perform(i);
// The opening, in the Lab only: a few seconds wide and slow, then closer and lower, every shot still
// moving, the experiment starting in shot three. Shot one's setup resets the bench in the black, so
// the loop closes without a seam.
const shots: Shot[] = [
  // Wide and slow, the room at dusk: a 17° arc and nothing else moving.
  { view: 'lab', pose: { yaw: -0.55, pitch: 0.2, distanceScale: 1.04 }, dolly: { yaw: 0.3 }, hold: 9, setup: () => applyPreset(0, { instant: true }) },
  // Closer and lower, tracking along the bench from the lamp end, the beam at eye level.
  { view: 'lab', pose: { target: [-2, BEAM_Y, 0], yaw: -0.75, pitch: 0.05, distance: 15 }, dolly: { pan: [4, 0, 0], yaw: 0.1 }, hold: 9 },
  // Arcing round the analyzer as the lesson's first two steps play: half the light, then none.
  { view: 'lab', pose: CLOSEUP, dolly: { yaw: 0.22, distanceScale: 0.95 }, hold: 10, focus: ANALYZER, beats: [[1, step(0)], [4.5, step(1)]] },
  // Round the loupe: the film's chains turn with the analyzer. The pose follows the loupe's position.
  { view: 'lab', pose: { target: LOUPE_AT, yaw: -0.4, pitch: 0.05, distance: 10 }, dolly: { yaw: 0.28 }, hold: 9, focus: LOUPE_AT, beats: [[0.5, () => setState({ analyzer: 30 }, { tween: true })], [2, sweep(75, 6)]] },
  // Along the console's two screens while the analyzer makes a half turn.
  { view: 'lab', pose: { target: SCREENS, yaw: 0.08, pitch: 0.1, distance: 15 }, dolly: { pan: [3.5, 0, 0] }, hold: 10, focus: SCREENS, beats: [[0.3, () => setState({ analyzer: 0 }, { tween: true })], [1.2, sweep(180, 8)]] },
  // Over the bench, out of focus, rising to the window's discs: the same law at the scale of the room.
  { view: 'lab', pose: { target: OVER_BENCH, yaw: 0.12, pitch: 0.02, distance: 34 }, dolly: { pan: [0, 4, 0], distanceScale: 0.85 }, hold: 9, focus: WINDOW },
  // The payoff, low and slow: crossed filters, then the middle filter lowered and turned brings light back.
  { view: 'lab', pose: { yaw: -0.15, pitch: 0.07, distanceScale: 0.8 }, dolly: { yaw: -0.25 }, hold: 11, setup: () => applyPreset(2, { instant: true }), beats: [[1.5, step(2)], [4.5, step(3)]] },
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
  if (id === 'analyzer') setState({ analyzer: Number(v) });
  if (id === 'middleAngle') setState({ middleAngle: Number(v) });
  if (id === 'middle') setState({ middle: v === 'in' ? 'in' : 'out' });
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
  '[': (e) => setState({ analyzer: state.analyzer - (e.shiftKey ? 5 : 1) }),
  ']': (e) => setState({ analyzer: state.analyzer + (e.shiftKey ? 5 : 1) }),
  '0': () => setState({ analyzer: 0 }, { tween: true }),
  'Shift+M': () => setState({ middle: state.middle === 'in' ? 'out' : 'in' }),
  ',': (e) => state.middle === 'in' && setState({ middleAngle: state.middleAngle - (e.shiftKey ? 5 : 1) }),
  '.': (e) => state.middle === 'in' && setState({ middleAngle: state.middleAngle + (e.shiftKey ? 5 : 1) }),
  'Shift+V': () => void setView(viewOrder[(viewOrder.indexOf(rig.view as (typeof viewOrder)[number]) + 1) % viewOrder.length]),
  'Shift+X': () => void setView('exploded'),
  L: () => toggleLesson(),
  C: () => cinematic.toggle(),
  R: () => void rig.reset(),
  'Shift+N': () => setLabels(!labels.visible),
  '/': () => hud.setUiVisible(!hud.uiVisible),
  H: () => hud.setCompact(!hud.compact),
}, { repeat: ['[', ']', ',', '.'] });

mountTune(root, { stage, rig });

// ---------- frame ----------
function display(): Display {
  return { analyzer: analyzer.value, middleAngle: middleAngle.value, middle: state.middle, slide: slide.value, explode: explode.value };
}

const last = { angle: '', factor: '', through: '', caption: '' };
stage.onFrame((dt, elapsed) => {
  cinematic.update(dt);
  analyzer.update(dt);
  middleAngle.update(dt);
  slide.update(dt);
  explode.update(dt);
  const d = display();
  app.update(d);
  loupe.group.position.x = app.analyzer.group.position.x + LOUPE_HOME.x;
  const st = app.stations();
  field.update(elapsed, st, d);
  railEnds[0].x = st.lamp;
  railEnds[1].x = st.meter;
  echo.update(dt, prefersReducedMotion());
  // Readouts follow the displayed angles; the middle filter counts once it covers the beam.
  shown = read({ ...d, middle: app.stations().middleOnAxis > 0.5 ? 'in' : 'out' });
  const angle = fmt.angle(shown.angle);
  if (angle !== last.angle) hud.setStat('angle', (last.angle = angle));
  const factor = fmt.num(shown.factor, 3);
  if (factor !== last.factor) hud.setStat('factor', (last.factor = factor));
  const through = fmt.percent(shown.through);
  if (through !== last.through) hud.setStat('through', (last.through = through));
  lesson.update(dt);
  if (handover) {
    handover = false;
    lesson.start();
  }
  // While the lesson runs, the caption is its request and its answers; otherwise the live sentence.
  const c = lesson.caption(caption({ ...d, middle: shown.stages.afterMiddle === null ? 'out' : 'in' }, shown));
  if (c !== last.caption) hud.setCaption((last.caption = c));
  root.classList.toggle('lesson-on', lesson.speaking);
  hud.setControl('analyzer', d.analyzer);
  hud.setControl('middleAngle', d.middleAngle);
  rig.update(dt);
  lab.cutaway(camera);
  stage.uniforms.focusDistance.value = rig.focusDistance;
  stage.uniforms.focusBand.value = lookBand + Math.max(0, rig.focusSpanDepth - 4) * 5;
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
if (import.meta.env.DEV) Object.assign(window, { __dev: { THREE, stage, rig, app, lab, labels, loupe, cinematic, lesson } });

installDebugHandle({
  ready: boot(),
  backend: stage.backend,
  fps: () => stage.fps(),
  fpsStats: (ms) => stage.fpsStats(ms),
  getState: () => ({ ...state, view: rig.view, preset: presetId, reading: read(state) }),
  setState: (p, o) => setState(p as Partial<BenchState>, { instant: o?.instant ?? true }),
  applyPreset: (i) => applyPreset(i - 1, { instant: true }),
  setView: (name, o) => setView(name, o),
  setUi: (v) => hud.setUiVisible(v, { quiet: true }),
  setLabels,
  cinematic: (on) => (on ? cinematic.play() : cinematic.stop()),
  lesson: (on) => (on ? lesson.start() : lesson.stop()),
  pose: (name) => rig.setPose(name === 'closeup' ? rig.resolve(CLOSEUP) : rig.heroPose()),
  orbit: (yawDeg, pitchDeg, distanceScale) => rig.setPose(rig.orbitPose(yawDeg, pitchDeg, distanceScale)),
  setCompact: (on) => hud.setCompact(on),
  text: () => hudText(root),
});
