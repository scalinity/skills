# HUD spec: the glass-card interface

Measured from the reference exhibits' stylesheets (identical across Prism Room, Root Finder and The Plane of Focus apart from per-exhibit color tokens and title sizes). Token names below are ours; values are the reference's. Build these as plain CSS custom properties and small TypeScript components. Do not use a UI framework's default look, Tailwind defaults, or lil-gui for anything user-facing.

## 1. Principles

- The HUD is a museum label plus an instrument panel. Four regions only: title column top left, control card top right, utilities bottom right, transient toasts and tips.
- Dark navy glass on a dark scene; one accent (cyan) with fixed meanings; values always in mono (§11); micro labels uppercase and letterspaced.
- The HUD never explains with paragraphs. One live sentence does that; the help dialog holds the rest.

## 2. Type

- Display and UI: **Outfit**, weights 300 to 800.
- Values, key hints, tooltips, chart captions: **DM Mono**, weights 400 and 500.
- Load both from Google Fonts in development; self-host for single-file builds. Set `font-synthesis: none`. Numbers use `font-variant-numeric: tabular-nums`.

## 3. Tokens

```css
:root {
  --font-ui: "Outfit", Arial, sans-serif;
  --font-mono: "DM Mono", ui-monospace, Menlo, monospace;

  --ink: #0b0f1a;            /* page background, veil, theme-color */
  --text: #eef2fa;
  --text-kicker: #dfe6f5;
  --text-lede: #c7cee0;
  --text-caption: #c3cadc;
  --text-seg: #cfd6e8;
  --text-tool: #dfe4f3;
  --mute: #9ea8c2;           /* group labels */
  --mute-stat: #8d97b3;      /* stat labels */
  --mute-unit: #9aa4bf;
  --mute-hint: #7d87a4;      /* key hints */
  --mute-dialog: #8f98b3;

  --glass: linear-gradient(150deg, #141a2ae8, #0d1220e3);  /* control card */
  --chip: #0d1220c4;         /* stat tiles */
  --caption-bg: #0d1220b0;
  --float-bg: #0e1220b8;     /* bottom-right buttons */
  --toast-bg: #0e1220dd;
  --tip-bg: #0b1020e8;
  --dialog-bg: #101526;
  --tune-bg: #0e1220f5;

  --seg-bg: #ffffff0c;
  --tool-bg: #ffffff12;
  --hover: #ffffff14;
  --hover-strong: #ffffff24;
  --on-bg: #eef4ff;
  --on-text: #101626;
  --track: #ffffff1f;
  --tick: #ffffff38;

  --cyan: #7fe3ff;
  --amber: #ffb454;
  --coral: #ff6b86;
  --violet: #b99cff;
  --green: #8fe8a8;
  /* per exhibit, e.g. --leaf: #9be07a; --root: #f1e2c0; */

  --shadow: 0 18px 50px -20px #000b;
  --r-card: 16px; --r-stat: 10px; --r-caption: 12px; --r-seg: 11px;
  --r-seg-btn: 9px; --r-tool: 10px; --r-float: 12px; --r-dialog: 20px;
}
```

## 4. Layout

| Region | Position and size |
|---|---|
| Canvas | full bleed, behind everything; cursor grab, grabbing while dragging; `touch-action: none` |
| Veil | full screen, ink color, opacity 0 except during view transitions |
| Vignette | full screen HTML overlay above the canvas (see style bible §9) |
| Title column | left 24, top 22, width 300 to 304, vertical stack with gap 11: brand, stats, caption. The column ignores pointer events except on its children |
| Control card | right 24, top 22, width 410 to 468 (never more than viewport minus 48), padding 9 10 10, vertical gap 8 to 9, up to three rows |
| Utilities | right 24, bottom 22: a row of 32 px icon buttons plus an optional credit link pill |
| Hint toast | top 22, horizontally centered |
| Tooltip | follows the pointer, offset up by 150% of its height |
| Help | native `<dialog>` |
| Tune panel | right 24, top 76, width up to 320 |
| Loading line | centered at 47% height |

DOM skeleton:

```html
<div id="app">
  <main id="world" role="img" aria-label="[set sentence]"><div id="loading">[themed loading line]</div></main>
  <div id="veil"></div>
  <div class="vignette"></div>
  <aside class="side">
    <div class="brand"><h1><span>[kicker]</span> <b>[title]</b></h1><small>[lede]</small></div>
    <div class="stats"><!-- exactly three .stat --></div>
    <p class="why" aria-live="polite"><!-- live caption --></p>
  </aside>
  <section class="ctl card" aria-label="Controls"><!-- rows of groups --></section>
  <div class="br"><!-- utility buttons, credit link --></div>
  <div id="ui-hint"></div>
  <div id="tip"></div>
  <dialog id="help"><!-- help sheet --></dialog>
  <div id="tune" hidden><!-- lookdev rows --></div>
</div>
```

## 5. Components

### Brand (title block)
- `h1`: uppercase, weight 800, line height 0.92, letter spacing −0.5 px, text shadow `0 2px 18px #000a`.
- Kicker (first line): block, 19 px, weight 600, letter spacing 0.6 px, `--text-kicker`.
- Title (second line): block, 35 to 39 px, weight 800, `--cyan`. Pick the size that fits the column; long titles go smaller, never wrap to three lines.
- Lede: 12.5 px, line height 1.5, `--text-lede`, max width 27em, 9 px above.
- Three ways to split the title: name + question ("Root Finder" / "How roots know down"), hook + name ("Where white light splits" / "Prism room"), one phrase split in two ("The plane" / "of focus").

### Stats (exactly three)
- Row with gap 6; each tile flexes equally, padding 6 9 7, radius 10, `--chip` background with an 8 px backdrop blur.
- Label: mono 500, 9 px, letter spacing 0.12em, uppercase, `--mute-stat`, no wrap.
- Value: mono 500, 16 px, white, tabular, 4 px below the label. Unit as a smaller span (10.5 px, `--mute-unit`, 2 px gap): `72 h`, `37 cm`.
- Variants: `hot` turns the value cyan (the headline quantity, or the one the current action changes most). Semantic variants use the exhibit's object colors (root cream, leaf green).
- Unknown values show an em dash.

### Caption ("why" sentence)
- Padding 9 11, radius 12, `--caption-bg` with 8 px blur, 12 px, line height 1.5, `--text-caption`, minimum height 3.6em so the layout doesn't jump.
- Bold for named quantities (white, 600). Colored spans for keywords and live numbers, using the same color as the thing in the scene: cyan, amber, coral, violet, green, plus exhibit tokens.
- One or two sentences, rewritten whenever the state changes meaningfully. `aria-live="polite"`.
- While the lesson runs (exhibit-design §5), the caption is the lesson: the answer to the last step, then the next request in bold, three sentences at most. The root then carries `lesson-on`, and the caption shows in every layout, short windows and phones included, until the live sentence takes over again. Compact (H) still folds it away.

### Group label (above every control)
- Flex row, space between, baseline aligned: 10 px, letter spacing 1.2 px, uppercase, weight 600, `--mute`.
- Optional key hint after the label: mono 10 px, `--mute-hint` (hidden below 1180 px width).
- Optional live value at the right end: mono 500, 11.5 px, white, signed when the quantity is signed (`+13.3°`).

### Segmented control
- Container: gap 2, padding 2, radius 11, `--seg-bg`.
- Buttons: radius 9, height 28, padding 0 10, 12.5 px, weight 500, `--text-seg`, no wrap, 0.15 s transitions. Hover `--hover`. Selected: `--on-bg` background, `--on-text` text. Optional 14 px stroke icons (stroke 2, round caps) before the text, e.g. ↺ 90° and 90° ↻.
- Used for: TRY presets, categorical parameters, inserts (Waiting / In), views (Lab / Exploded / Studio, or Assembled / Exploded).
- In every group except the TRY row, the buttons share the track evenly (`flex: 1 1 0`), so no dead space follows the last button. The TRY row keeps its buttons left-aligned at their natural width.

### Slider
- Height 32 with 6 px side margins.
- Track: 4 px tall at y 14, radius 3, `--track`.
- Fill: left to knob, gradient from cyan at 25% alpha to cyan, with a `0 0 10px` cyan glow at 50% alpha.
- Knob: 16 px circle at y 8, vertical gradient `#f4f7ff` to `#aab4c8`, ring `0 0 0 3px` cyan at 20%, drop shadow `0 3px 8px #0009`.
- Ticks: 1 by 5 px at y 21, `--tick`, at meaningful values (0, presets, limits).
- Event markers (timelines): small amber downward triangles above the track at moments that matter (a turn at 48 h).
- Keyboard: arrows step, Shift for coarse steps.

### Play and speed (time-based exhibits)
- Play: 32 px square, radius 10, cyan at 15% background, filled icon in `#bff2ff`; hover cyan at 23%.
- Speed: small segmented `1× | 4×` beside the scrubber.

### Tool buttons (inside the card, right end of the last row)
- 32 px square, radius 10, `--tool-bg`, 15 px stroke icons (stroke 1.9, round). Hover `--hover-strong`. Active: `--on-bg` / `--on-text`.
- Standard set, in order: one exhibit action if needed (sow again, reset sample), the lesson (steps icon `lesson`, a toggle, L, "Try it step by step"), cinematic cameras (video camera icon), world labels (tag icon `labels`, a toggle, §9), help (question mark), collapse (chevron; it folds the HUD into its compact mode, §9).

### Utilities (bottom right)
- Icon buttons 32 px, radius 12, `--float-bg` with 8 px blur; a credit or home link pill 32 px tall, radius 12, 12 px weight 500, `#c9cfe2`. Hidden on phones.

### Hint toast
- 11.5 px, `#dfe5ee`, `--toast-bg`, radius 14, padding 6 13, shadow `0 10px 24px -12px #000c`, 0.4 s fade. Used for "Drag, click or press a key to take over" during the opening ("Tap to take over" on touch screens) and "Press / to show the interface".

### Tooltip
- Mono 500, 11 px, `#e9f7ff`, `--tip-bg`, radius 9, padding 5 9, 0.15 s fade. Verb first: "Drag to turn the prism", "Turn to tilt the light · click for 32° 42° 55°". Can also explain a non-interactive part.

### Help dialog
- `--dialog-bg`, radius 20, padding 28, max width 580 to 600, max height 84vh with scroll, shadow `0 30px 80px #000a`. Backdrop `#05070fa8` with 3 px blur.
- h2 23 px, weight 700, letter spacing −0.4 px. h3 11 px, letter spacing 1.5 px, uppercase, weight 600, `--mute-dialog`, 20 px above. Paragraphs 13.5 px, line height 1.65, `#c0c7dc`. Bold white 600. `code` and `kbd` in mono 12 px on `#ffffff12`, radius 5.
- Close button top right, 24 px ×, `--mute-dialog`. Structure: see exhibit-design §8.

### Tune panel (lookdev, developer facing)
- Opens with Cmd+' (Ctrl+' elsewhere) or `?tune` in the URL. `--tune-bg`, radius 16, mono 11.5 px.
- One row per look parameter: name, a 70 px mini track with a 9 px white knob, a right-aligned value. Selected row highlighted. Arrow keys move and change; Shift for coarse; 0 resets a row, Shift+0 resets all; C copies all values as JSON into a small textarea for pasting back into code.

## 6. States and focus

- Focus visible: 2 px cyan outline, 2 px offset, on buttons, links and anything with a tabindex.
- Buttons reset (inherit font and color, no border or background, pointer cursor). No tap highlight. No text selection inside the app.

## 7. Responsive

- Below 1180 px wide: hide key hints; segmented padding 0 8.
- Short desktop windows (height ≤ 760 and width ≥ 901): hide the lede and the caption. This is why the exemplar screenshots, taken in short windows, show neither.
- Phones (≤ 900 wide): the title column spans the top (12 px margins); kicker 11 to 12 px, title 21 to 25 px; lede and caption hidden; stats compact (padding 5 7 4, values 13 px); the control card docks to the bottom (10 px from the edges, padding 8, rows wrap with gap 6, segmented buttons stretch, sliders take a full row); utilities hidden; vignette becomes radial only (ellipse at 50% 46%, clear to 52%, about 61% black at the edges).

## 8. Light theme (Studio view)

- Add `light` to the app root: vignette at 18% opacity, kicker `#2a3040`, title `#1f6f95`, lede `#4a5165`, no text shadow. Cards stay dark glass.

## 9. Hide-UI and labels

- `/` toggles a `ui-off` class that fades out every HUD element except the canvas, veil, vignette and hint toast (0.25 s). Show the hint "Press / to bring the interface back" once.
- H, or the card's collapse button (a tool button, chevron icon, `aria-expanded`), toggles a compact HUD for a more immersive view: the card folds into a pill reading "‹active preset or Custom› · ‹view›" that expands on click, and the title column keeps only its three stats. World labels, keys and the bottom-right utilities stay. 0.16 s, instant under reduced motion; hidden parts are `inert`. On phones the docked card folds into a slim bar. Compact survives view switches, presets and `/`; each load starts expanded.
- The opening (exhibit-design §11) fades out the control card and the bottom-right utilities (`presenting`, 0.25 s; hidden parts are `inert`) while the title column, world labels and the toast stay: the title column is the tour's title card. The card keeps its place while invisible, so the camera's framing does not move when it returns. The first input brings both back as the view fades home to the hero framing.
- Shift+N, or the card's labels tool, toggles world labels. Both call one function that also sets the tool's pressed state, so the button always shows whether labels are on, and a visitor who never opens the help sheet still finds the switch.

## 10. Accessibility

- Real `<button>` elements; `aria-label` on icon-only buttons; segmented groups as `role="group"` with `aria-pressed` on options; sliders as `role="slider"` with min, max, now and a human `aria-valuetext` ("13.3 degrees").
- The canvas region gets `role="img"` and an `aria-label` with the set sentence ("An optical bench in a showroom at dusk: a lamp, a glass prism and a screen, with a rainbow fan of light between them").
- Every action reachable by keyboard (see exhibit-design §7). Honor `prefers-reduced-motion`.

## 11. Number formatting

- Angles: one decimal and the degree sign; sign when the quantity is signed (`+13.3°`). Directions with arrows (`82° off ↓`, `42° up`).
- Lengths and times with units and sensible precision (`37 cm`, `0.7 cm`, `72 h`). f-numbers as `f/2`. Multipliers as `1×`, `4×`; magnification as `×40`. Wavelengths in `nm`.
- Mono and tabular everywhere a number is a value: readouts, slider values, world labels, chart captions, tooltips. Option names on segmented buttons stay in the UI face even when they are numbers, as the exemplars set `1 g`, `0 g`, `90°` and `4×`.
