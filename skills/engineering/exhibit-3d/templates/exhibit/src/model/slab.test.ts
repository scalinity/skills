import { describe, expect, it } from 'vitest';
import { beamPath, insideAngle, lateralShift, N_BK7, readouts, THICKNESS_CM } from './slab';

describe('glass slab invariants', () => {
  it('does not shift a beam that meets the slab square on', () => {
    expect(lateralShift(0)).toBeCloseTo(0, 12);
    expect(insideAngle(0)).toBeCloseTo(0, 12);
  });

  it('obeys Snell at the entry face', () => {
    for (const tilt of [10, 30, 45, 60]) {
      expect(N_BK7 * Math.sin((insideAngle(tilt) * Math.PI) / 180)).toBeCloseTo(Math.sin((tilt * Math.PI) / 180), 12);
    }
  });

  it('shifts the other way when tilted the other way', () => {
    for (const tilt of [5, 20, 45, 60]) expect(lateralShift(-tilt)).toBeCloseTo(-lateralShift(tilt), 12);
  });

  it('grows monotonically with tilt and stays below the thickness', () => {
    let prev = 0;
    for (let tilt = 1; tilt <= 60; tilt++) {
      const d = lateralShift(tilt);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThan(THICKNESS_CM);
      prev = d;
    }
  });

  it('matches a hand calculation at 45°: 3.345 cm for a 10 cm N-BK7 block', () => {
    // θt = asin(sin 45° / 1.5168) = 27.789°; d = 10 × sin(17.211°) / cos(27.789°) = 3.3447 cm
    expect(lateralShift(45)).toBeCloseTo(3.3447, 3);
  });

  it('leaves the slab parallel to the incoming beam, offset by the shift', () => {
    const p = beamPath({ tilt: 35, slab: 'in' }, -60, 60, 0);
    expect(p[3].z).toBeCloseTo(p[2].z, 12);
    expect(p[3].z).toBeCloseTo(lateralShift(35), 9);
  });

  it('reads zero shift and no inside angle with the slab out', () => {
    expect(readouts({ tilt: 40, slab: 'out' })).toEqual({ tilt: 40, inside: null, shift: 0 });
  });
});
