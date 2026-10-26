// The loupe's drawing: the analyzer's polarizing film at ×20,000, a drawing, not a simulation.
// Stretched polymer chains run across the analyzer's transmission axis and turn with it. The
// arriving field (white) splits into the part across the chains, which passes (cyan), and the
// part along them, which the chains absorb (coral, shrinking).

import { amplitude } from '../model/polarizer';

export interface LoupeInput {
  /** Analyzer axis, degrees from vertical. */
  analyzer: number;
  /** Polarization plane arriving at the analyzer, degrees from vertical. */
  incomingPlane: number;
  /** Intensity arriving at the analyzer, percent of the lamp. */
  incoming: number;
}

const CYAN = '#7fe3ff';
const CORAL = '#ff6b86';

function arrow(g: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, len: number, color: string, width: number, double = true): void {
  if (len < 1) return;
  const hx = dx * len;
  const hy = dy * len;
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - (double ? hx : 0), cy - (double ? hy : 0));
  g.lineTo(cx + hx, cy + hy);
  g.stroke();
  const head = (sx: number, sy: number, ux: number, uy: number) => {
    const s = Math.min(len * 0.35, width * 4.2);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx - ux * s - uy * s * 0.55, sy - uy * s + ux * s * 0.55);
    g.lineTo(sx - ux * s + uy * s * 0.55, sy - uy * s - ux * s * 0.55);
    g.closePath();
    g.fill();
  };
  head(cx + hx, cy + hy, dx, dy);
  if (double) head(cx - hx, cy - hy, -dx, -dy);
}

let cached: HTMLCanvasElement | null = null;

/** Horizontal chains (across a vertical transmission axis) on a canvas wide enough to turn. */
function chainLayer(size: number): HTMLCanvasElement {
  if (cached && cached.width === Math.ceil(size * 1.5)) return cached;
  const w = Math.ceil(size * 1.5);
  const cv = document.createElement('canvas');
  cv.width = cv.height = w;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  const c = w / 2;
  const spacing = size / 15;
  for (let k = -11; k <= 11; k++) {
    const y = c + k * spacing;
    g.strokeStyle = 'rgba(214,170,104,0.55)';
    g.lineWidth = size / 180;
    g.beginPath();
    for (let x = 0; x <= w; x += size / 40) {
      const yy = y + Math.sin(x / (size / 9) + k * 1.7) * size * 0.006;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
    g.fillStyle = 'rgba(240,196,120,0.75)';
    for (let x = (k % 3) * 9; x <= w; x += size / 13) {
      g.beginPath();
      g.arc(x, y, size / 220, 0, Math.PI * 2);
      g.fill();
    }
  }
  cached = cv;
  return cv;
}

export function filmDrawing(input: () => LoupeInput): (g: CanvasRenderingContext2D, size: number, t: number) => void {
  return (g, size, t) => {
    const { analyzer, incomingPlane, incoming } = input();
    const c = size / 2;
    g.fillStyle = '#081222';
    g.fillRect(0, 0, size, size);
    // Directions on the page, seen from the lamp: angles turn clockwise from straight up.
    const dir = (deg: number): [number, number] => {
      const r = (deg * Math.PI) / 180;
      return [Math.sin(r), -Math.cos(r)];
    };
    const [ax, ay] = dir(analyzer);
    const [chx, chy] = [-ay, ax]; // chains run across the transmission axis
    // Polymer chains: long, slightly wavy strands with iodine beads, drawn once and turned.
    const layer = chainLayer(size);
    g.save();
    g.translate(c, c);
    g.rotate((analyzer * Math.PI) / 180);
    g.drawImage(layer, -layer.width / 2, -layer.height / 2);
    g.restore();
    // The field: arriving, passing (across the chains), absorbed (along them).
    const cycle = (t % 2.6) / 2.6;
    const pulse = 0.82 + 0.18 * Math.sin(t * Math.PI * 2 * 1.2);
    const base = size * 0.3 * (amplitude(incoming) / amplitude(50)) * pulse;
    const delta = ((analyzer - incomingPlane) * Math.PI) / 180;
    const pass = base * Math.abs(Math.cos(delta));
    const absorb = base * Math.abs(Math.sin(delta)) * (1 - Math.min(1, Math.max(0, (cycle - 0.25) / 0.6)));
    const [ix, iy] = dir(incomingPlane);
    g.save();
    g.globalAlpha = 1 - Math.min(1, cycle / 0.3) * 0.75;
    arrow(g, c, c, ix, iy, base, 'rgba(240,246,255,0.85)', size / 150);
    g.restore();
    g.shadowBlur = size / 40;
    g.shadowColor = CORAL;
    arrow(g, c, c, chx, chy, absorb, CORAL, size / 110);
    g.shadowColor = CYAN;
    arrow(g, c, c, ax, ay, pass, CYAN, size / 95);
    g.shadowBlur = 0;
    g.font = `500 ${Math.round(size * 0.052)}px "DM Mono", ui-monospace, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = CYAN;
    g.fillText('passes', c + ax * (pass + size * 0.07), c + ay * (pass + size * 0.07) + size * 0.035);
    if (absorb > size * 0.04) {
      g.fillStyle = CORAL;
      g.fillText('absorbed', c + chx * (absorb + size * 0.1), c + chy * (absorb + size * 0.1) + size * 0.035);
    }
  };
}
