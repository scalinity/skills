import { describe, expect, it } from 'vitest';
import { discTransmission } from '../model/polarizer';
import { DISCS } from './echo-discs';

describe('Window discs (the echo)', () => {
  it('lists the discs in the order the window light meets them', () => {
    const dz = DISCS.map((d) => d.dz);
    expect(dz).toEqual([...dz].sort((a, b) => a - b));
  });
  it('hangs the 45° disc between the crossed pair, so an eighth of the light comes back through all three', () => {
    const order = DISCS.filter((d) => [0, 45, 90].includes(d.deg)).map((d) => d.deg);
    expect(order).toEqual([0, 45, 90]);
    expect(discTransmission(order)).toBeCloseTo(0.125, 12);
  });
});
