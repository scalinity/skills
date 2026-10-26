// The window discs of the Lab echo (scene/echo.ts) as plain data, so the model tests can check the
// physics they show. Ordered from the pane into the room: the order the window light meets them.

export interface Disc {
  /** Offset of the disc's center from the pane's center: right, up, and out into the room. */
  dx: number;
  dy: number;
  dz: number;
  r: number;
  /** Transmission axis, degrees from vertical. */
  deg: number;
  turns?: boolean;
}

export const DISCS: Disc[] = [
  { dx: -4, dy: -10, dz: 3, r: 3.4, deg: 0 },
  { dx: 5.6, dy: -9.5, dz: 3.8, r: 3.2, deg: 30, turns: true },
  { dx: -1.8, dy: -8.5, dz: 4.4, r: 3, deg: 45 },
  { dx: 0.8, dy: -10.5, dz: 5.4, r: 3.6, deg: 90 },
];
