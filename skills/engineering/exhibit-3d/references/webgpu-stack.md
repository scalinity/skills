# WebGPU stack: Daniel's defaults and the port from the reference

The reference exhibits run on three r183 with `WebGLRenderer` and `EffectComposer`. Daniel builds on the latest three with `WebGPURenderer` and never on legacy WebGL. This file maps every reference technique to its WebGPU equivalent and lists what breaks.

API facts here were checked against three r186 (0.186.0 published September 8, 2026; the 0.186.1 patch on September 24), its source tree and its examples. three moves fast: before writing pipeline code, open the examples listed in §5 and copy their wiring rather than trusting memory or this file. The npm package ships only `examples/jsm/` and `src/`, not the example pages: read those at the installed release's tag, `https://github.com/mrdoob/three.js/blob/r<NNN>/examples/<name>.html` (r186 for 0.186.x), and read the node implementations in `node_modules/three/examples/jsm/` and `node_modules/three/src/`.

## 1. Defaults

- **Tooling:** Vite, TypeScript (strict), `three` at the newest release (`npm view three version`), Vitest for the model, Playwright for captures.
- **Renderer:** `WebGPURenderer` from `three/webgpu` only. Never construct `WebGLRenderer`. The WebGPU renderer falls back to its own WebGL2 backend on browsers without WebGPU; treat that as degraded support, never as the development target.
- **UI:** vanilla TypeScript components and CSS custom properties (hud-spec). No React or R3F by default: post-processing on WebGPU needs TSL `RenderPipeline` (EffectComposer, pmndrs `postprocessing` and `@react-three/postprocessing` don't run on it), and several drei helpers misbehave there. If Daniel asks for React, keep the 3D in a vanilla module mounted from a component.
- **Single-file build (optional):** `vite-plugin-singlefile` gives one shareable HTML file per exhibit, like the reference's "one HTML lab" pages. Self-host fonts for it.
- **Companion skill (optional):** `dgreenheck/webgpu-claude-skill` (folder `skills/webgpu-threejs-tsl`, MIT) covers TSL, compute and WGSL in depth. Context7 has current three docs. Use them for low-level questions; this skill owns the look and the exhibit.

## 2. Import shape (verify every name against the installed version)

```ts
import * as THREE from 'three/webgpu';   // WebGPURenderer, RenderPipeline, node materials, PMREMGenerator
import { pass, mrt, output, normalView, emissive, velocity, uniform, float, vec3, vec4,
         color, mix, saturation, screenUV, reflector } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { lensflare } from 'three/addons/tsl/display/LensflareNode.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
```

Signatures confirmed in r186: `bloom(node, strength, radius, threshold)`, `ao(depthNode, normalNode, camera)`, `dof(node, viewZNode, focusDistance, focalLength, bokehScale)`, `traa(beautyNode, depthNode, velocityNode, camera)`, `smaa(node)`, `film(inputNode, intensityNode, uvNode)`, `lensflare(node, params)`, `godrays(depthNode, camera, light)`, `chromaticAberration(node, strength, center, scale)`, `oitPass(scene, camera, options)`. `reflector()` lives in core TSL; `saturation()` in core TSL's color adjustments.

## 3. Renderer setup

- Create with antialias off (anti-aliasing happens in the pipeline). Call `await renderer.init()` before the first render: in r186 rendering before init throws (`setAnimationLoop` initializes for you).
- After init, read `renderer.backend.isWebGPUBackend` (note `renderer.isWebGPURenderer` is true on both backends). Expose it on the debug handle and show a small dev badge when it is false.
- Adaptive pixel ratio (from the reference): `clamp(min(devicePixelRatio, 2, sqrt(PIXEL_BUDGET / (w × h))), 1, 2)` with a budget around 3 million pixels (rec). Recompute on resize.
- Tone mapping and exposure come from the active look preset (ACES Filmic for Lab and Exploded, Neutral for Studio).
- Shadows: enabled, `PCFShadowMap` (`PCFSoftShadowMap` was removed for `WebGPURenderer` in r186; PCF is soft now), 2048 for the key. Keep casters few; if the renderer offers manual shadow updates, update only when casters move.
- Pre-compile with `await renderer.compileAsync(scene, camera)`, then hide the loading line after two rendered frames.
- `Timer` instead of `Clock` (deprecated since r183). `screenSize` instead of `viewportResolution` (removed in r186). `CubeRenderTarget` instead of `WebGLCubeRenderTarget`.
- WebGPU needs a secure context: localhost is fine; LAN testing on a phone needs HTTPS.

## 4. Post pipeline, in order

1. **Pre-pass and scene pass**: an opaque-only pre-pass (`prePass.transparent = false`) writes packed view-space normals and velocity, and its depth comes free; the scene pass writes `output` and `emissive` with MRT. This split is how r186's `webgpu_postprocessing_ao.html` composes AO and TRAA.
2. **Ambient occlusion**: `ao(preDepth, preNormal, camera)`, radius about 0.9, fed into the scene pass's ambient light with `scenePass.contextNode = builtinAOContext(aoPass.getTextureNode().sample(screenUV).r)`. r186 does not multiply AO into the final color, which would also darken emitters (copy the composition from `webgpu_postprocessing_ao.html`).
3. **Depth of field**: `dof(color, viewZ, focusDistance, focalLength, bokehScale)` driven by uniforms the camera rig updates every frame (focus on the hero; far blur stronger than near). Start from `webgpu_postprocessing_dof.html`. In r186, `dof()` gathers neighbors without weighting them by depth, so sharp foreground edges smear into the blurred background as halos and stepped copies, worst on bright parts against a dark room. The kit's `stage.ts` replaces it with a depth-aware gather in which a sample counts only if its own blur reaches the pixel. Feed it the main pass depth, with beams writing depth where they are visible, so a beam focuses at its own distance rather than the wall's.
4. **Bloom, emissive only**: feed the emissive target, not the beauty pass, so only designated emitters glow (the phenomenon and LED strips). This is stricter than the reference's threshold bloom and enforces law 1 by construction. See `webgpu_postprocessing_bloom_emissive.html` and `_bloom_selective.html`. Strength and threshold come from the look preset; radius about 0.55. Keep the emissive target in half float (the example's `UnsignedByteType` clips HDR emitters at 1, below every threshold), and blend it like color with `mrt.setBlendMode('emissive', new THREE.BlendMode(THREE.MaterialBlending))` so additive beams accumulate (MRT targets other than `output` default to no blending).
5. **Grade**: `saturation(…, global 1.16 × view multiplier)`; optional LUT later (`webgpu_postprocessing_3dlut.html`).
6. **Grain**: `film(…)` at a barely visible intensity.
7. **Anti-aliasing**: `traa(sceneColor, preDepth, preVelocity, camera)` runs on the scene pass color right after step 2, before depth of field: GTAO needs TRAA's temporal resolve, and TRAA's depth and velocity only line up with unblurred color (`webgpu_postprocessing_ao.html`, `_traa.html`). The other steps keep their order. If thin beams or rays ghost while moving, drop TRAA and run `smaa(…)` on the display-referred output instead.
8. **Output**: `pipeline.outputNode = …`, then `pipeline.render()` in the loop instead of `renderer.render`. `RenderPipeline` was called `PostProcessing` before r183; the old name logs a deprecation warning.
9. **HTML overlays** after the canvas: the CSS vignette and the label renderer.

Optional upgrades the reference didn't have: `lensflare(…)` or the anamorphic example for the glint where a beam enters glass; `godrays(…)` for a lamp's visible shaft; `oitPass(…)` when several glass layers overlap; `webgpu_postprocessing_transition.html` for a shader cross-fade between views instead of the HTML veil.

## 5. Port table (reference WebGL technique → WebGPU r186)

| Reference | WebGPU equivalent | Example to copy from |
|---|---|---|
| `EffectComposer` + `RenderPass` | `RenderPipeline` + `pass()` | `webgpu_postprocessing.html` |
| `UnrealBloomPass` with threshold | `bloom()` on the emissive MRT target | `webgpu_postprocessing_bloom_emissive.html` |
| `GTAOPass` | `ao()` | `webgpu_postprocessing_ao.html` |
| custom bokeh depth-of-field pass | `dof()` | `webgpu_postprocessing_dof.html`, `_dof_basic.html` |
| `SMAAPass` plus MSAA | `traa()` or `smaa()` | `webgpu_postprocessing_traa.html`, `_smaa.html` |
| `OutputPass` (tone map, color space) | renderer tone mapping plus the pipeline's output transform | `webgpu_postprocessing.html` |
| planar floor reflection patched in with `onBeforeCompile` | `reflector()` node on the bench or floor material | `webgpu_reflection.html`, `_reflection_roughness.html` |
| gradient sky drawn with `ShaderMaterial` then prefiltered | a small environment scene (back-side sphere with a TSL node material, emissive panels) prefiltered by `PMREMGenerator` | `webgpu_pmrem_scene.html` |
| canvas-texture label planes inside the scene | `CSS2DRenderer` objects anchored to parts (crisp, outside depth of field) | addons `CSS2DRenderer` |
| canvas-texture console screens | same: `CanvasTexture` on an unlit node material, color multiplier about 1.5 | — |
| `PCFShadowMap`, manual updates | `PCFShadowMap` | — |
| physical glass with transmission and dispersion | `MeshPhysicalNodeMaterial` (transmission, thickness, IOR, dispersion, attenuation all supported) | `webgpu_materials_transmission.html` |
| saturation in a shader pass | `saturation()` | — |
| fog (exponential squared) | `scene.fog` works, or TSL fog nodes | `webgpu_postprocessing_fog.html` |

## 6. Things that break on WebGPU

- `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile` don't work on either backend of `WebGPURenderer`. All custom shading is TSL.
- Libraries that patch shaders don't work unless they ship a WebGPU path: drei's `MeshTransmissionMaterial`, most custom-shader text libraries. Use `CSS2DRenderer` for text, `CanvasTexture` for in-world screens, `MeshPhysicalNodeMaterial` for glass.
- `EffectComposer`, pmndrs `postprocessing`, `@react-three/postprocessing`.
- drei `Text` and `Environment` with children are broken on the WebGL2 fallback.
- `renderAsync()` is deprecated (r181), as are `clearAsync()`, `clearColorAsync()`, `clearDepthAsync()`, `clearStencilAsync()` and `hasFeatureAsync()`. `computeAsync()` is not: it awaits `init()` and then computes.
- Node materials honor `envMapIntensity` only when `material.envMap` is set; with `scene.environment` alone every material gets `scene.environmentIntensity` (`src/nodes/accessors/MaterialProperties.js`). To keep per-material environment intensities, assign the environment texture to each material.
- A material with its own `mrtNode`, rendered into a target without MRT (a `reflector()`, a render-to-texture), uses only its own MRT; when none of its outputs exist there, the shader fails with an empty `OutputType` struct. Write emitters through the `emissive` property instead of a per-material MRT.
- Assigning a new `scene.fog` object recompiles every material that uses fog, a hitch of several hundred milliseconds. Create one `FogExp2` and change its `color` and `density` when the look changes; keep one `scene.background` color and `set()` it.
- Inside a full-screen pass (an `rtt()` or the pipeline output), the TSL `cameraNear` and `cameraFar` nodes describe the quad's camera, not the scene's. Convert a pass's depth with `pass.getViewZNode()`, or with near and far uniforms you copy from the scene camera.
- Importing `WebGLRenderer` next to `three/webgpu` bloats the bundle by roughly half; don't.

## 7. Building blocks

- **Beams and rays:** compute paths analytically on the CPU (or in compute for many rays), then draw camera-facing ribbon meshes along each path with an unlit additive node material: HDR color 2 to 10, soft falloff across the width, no fog, written to the emissive target. Thin measurement rays can use `Line2NodeMaterial`.
- **Spectrum:** sample 16 to 32 wavelengths (the reference uses 24 from 400 to 700 nm), convert each with CIE 1931 color matching to linear sRGB, normalize, trace each wavelength through the model.
- **Labels:** `CSS2DObject` pills (dot, bold name, mono value). Fade by distance and when the anchor is occluded (raycast or depth compare a few times per second, not per frame).
- **Screens:** `CanvasTexture` redrawn only when the state they show changes; mark `needsUpdate`; draw at 2× and let mipmaps handle distance.
- **Loupe:** either a second camera rendered to a texture (`RTTNode` or a render target) shown on a circular plane with a brass bezel, or a canvas drawing when the mechanism is schematic. Declare which in the help sheet.
- **Environment:** build the dusk environment once (navy zenith, warm low band, faint window panel) and prefilter it; build a separate soft studio environment.
- **Instancing:** soil pebbles, crystals, foliage clusters, rail ticks, gear teeth.
- **Static geometry:** merge static set pieces per material (`BufferGeometryUtils.mergeGeometries`).

## 8. Code shape

```
src/
  model/          pure TypeScript, no three imports: state, parameters, the physics, derived readouts
  model/*.test.ts invariants and known values (Vitest)
  scene/          apparatus, set pieces, materials use, phenomenon geometry; reads model state
  hud/            schema for this exhibit, caption writer, help sheet content
  main.ts         wires kit stage, camera rig, HUD, input paths, keys, debug handle
```

- One state object; every input path writes it; the scene, HUD, labels and screens read it. Smooth displayed values separately from target values.
- **Debug handle** on `window.__exhibit`: `ready` (a promise that resolves after compile and two frames), `backend`, `fps()`, `getState()`, `setState(partial, {instant})`, `applyPreset(i)`, `setView(name, {instant})`, `setUi(visible)`, `setLabels(visible)`, `cinematic(on)`. Screenshots and tests drive the exhibit through it.
- **URL parameters** for deterministic captures: `?view=exploded&preset=2&ui=0&labels=1&instant=1&seed=1&tune=1`.

## 9. Performance budget (rec)

- 60 fps at 1600×900 on an Apple M1 Pro class GPU (the reference creator reports smooth playback on an M1 Pro). Daniel's M5 Pro should hold 120 fps on the WebGPU backend.
- Under about 300 draw calls; one hero transmission material; other glass as thin panes.
- Throttle anything not visual-critical: screens redraw on change, labels occlusion at 5 to 10 Hz, shadows on change.
- Measure with the r181+ Inspector (`three/addons/inspector/Inspector.js`) or stats-gl in development; never ship either.
