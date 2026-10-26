import { describe, expect, it } from 'vitest';
import { amplitude, axisAngle, discTransmission, malus, read, throughAt, type BenchState } from './polarizer';

const two = (analyzer: number): BenchState => ({ analyzer, middle: 'out', middleAngle: 45 });
const three = (middleAngle: number, analyzer: number): BenchState => ({ analyzer, middle: 'in', middleAngle });

describe('Malus invariants', () => {
  it('repeats every 180°: I(θ) = I(θ + 180°)', () => {
    for (const t of [0, 17, 45, 90, 123.4, 170]) {
      expect(read(two(t + 180)).through).toBeCloseTo(read(two(t)).through, 12);
      expect(read(three(30, t + 180)).through).toBeCloseTo(read(three(30, t)).through, 12);
      expect(read(three(30 + 180, t)).through).toBeCloseTo(read(three(30, t)).through, 12);
    }
  });

  it('passes 50% of the lamp with the analyzer aligned (0°)', () => {
    expect(read(two(0)).through).toBeCloseTo(50, 12);
  });

  it('passes nothing with the analyzer crossed (90°)', () => {
    expect(read(two(90)).through).toBeCloseTo(0, 12);
  });

  it('passes 25% at 45°', () => {
    expect(read(two(45)).through).toBeCloseTo(25, 12);
  });

  it('passes 12.5% through three filters at 0°, 45°, 90°', () => {
    expect(read(three(45, 90)).through).toBeCloseTo(12.5, 12);
  });

  it('passes nothing when a middle filter at 0° or 90° sits before a crossed analyzer', () => {
    expect(read(three(0, 90)).through).toBeCloseTo(0, 12);
    expect(read(three(90, 90)).through).toBeCloseTo(0, 12);
  });

  it('falls monotonically from 0° to 90°', () => {
    let prev = Infinity;
    for (let t = 0; t <= 90; t += 0.5) {
      const i = read(two(t)).through;
      expect(i).toBeLessThan(prev);
      prev = i;
    }
  });

  it('shows the four presets exactly: 50%, 25%, 0%, 12.5%', () => {
    expect(read(two(0)).through).toBeCloseTo(50, 12);
    expect(read(two(45)).through).toBeCloseTo(25, 12);
    expect(read(two(90)).through).toBeCloseTo(0, 12);
    expect(read(three(45, 90)).through).toBeCloseTo(12.5, 12);
  });
});

describe('readouts', () => {
  it('FACTOR is the cos² product after the first filter, THROUGH is 50% of it', () => {
    const r = read(three(30, 70));
    const factor = Math.cos((30 * Math.PI) / 180) ** 2 * Math.cos((40 * Math.PI) / 180) ** 2;
    expect(r.factor).toBeCloseTo(factor, 12);
    expect(r.through).toBeCloseTo(50 * factor, 12);
  });

  it('ANGLE is the analyzer relative to the polarizer; axes fold into [0°, 180°)', () => {
    expect(read(two(135)).angle).toBe(135);
    expect(read(two(180)).angle).toBe(180);
    expect(axisAngle(180)).toBe(0);
    expect(axisAngle(-30)).toBe(150);
  });

  it('matches a hand calculation: middle 30°, analyzer 70° gives 50 · 0.75 · 0.5868 = 22.005%', () => {
    // cos²30° = 0.75; cos²40° = 0.586824; 50 × 0.75 × 0.586824 = 22.0059
    expect(read(three(30, 70)).through).toBeCloseTo(22.0059, 3);
  });

  it('the chart helper agrees with read()', () => {
    expect(throughAt(60, null)).toBeCloseTo(12.5, 12);
    expect(throughAt(90, 45)).toBeCloseTo(12.5, 12);
  });

  it('field amplitude goes as the square root of intensity', () => {
    expect(amplitude(100)).toBe(1);
    expect(amplitude(25)).toBeCloseTo(0.5, 12);
    expect(malus(1, 60)).toBeCloseTo(0.25, 12);
  });
});

describe('Window discs (the echo)', () => {
  it('passes the window light through ideal polarizers in order: ½ then cos² per step', () => {
    expect(discTransmission([])).toBe(1);
    expect(discTransmission([0])).toBeCloseTo(0.5, 12);
    expect(discTransmission([0, 90])).toBeCloseTo(0, 12);
    expect(discTransmission([0, 45, 90])).toBeCloseTo(0.125, 12);
    expect(discTransmission([0, 30])).toBeCloseTo(0.375, 12);
  });
});
