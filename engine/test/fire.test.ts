import { describe, expect, it } from 'vitest';
import { createFireModel } from '../src/sim/fire';
import { fromXY } from '../src/sim/geo';

const ign = { lat: 42.3732, lng: -72.5199 };
const cfg = (seed: number, dirDeg = 90, speedMph = 20) => ({ seed, wind: { speedMph, dirDeg }, ignition: ign });

describe('fire model', () => {
  it('is deterministic by seed and differs across seeds', () => {
    const p = fromXY(1000, 300, ign);
    expect(createFireModel(cfg(7)).ignitionTime(p)).toBe(createFireModel(cfg(7)).ignitionTime(p));
    expect(createFireModel(cfg(7)).ignitionTime(p)).not.toBe(createFireModel(cfg(8)).ignitionTime(p));
  });
  it('burns downwind much sooner than upwind', () => {
    const f = createFireModel(cfg(1, 90));
    expect(f.ignitionTime(fromXY(1500, 0, ign))).toBeLessThan(f.ignitionTime(fromXY(-1500, 0, ign)) / 2);
  });
  it('ignition point burns at t=0 and isBurning is monotone in t', () => {
    const f = createFireModel(cfg(1)); const p = fromXY(800, 0, ign); const t0 = f.ignitionTime(p);
    expect(f.isBurning(ign, 0)).toBe(true);
    expect(f.isBurning(p, t0 - 1)).toBe(false); expect(f.isBurning(p, t0)).toBe(true);
  });
  it('outside the grid never burns', () => { expect(createFireModel(cfg(1)).ignitionTime(fromXY(9000, 0, ign))).toBe(Infinity); });
  it('rings are closed, <= 200 points, and grow; burnedFraction is monotone in [0,1]', () => {
    const f = createFireModel(cfg(3));
    const r1 = f.rings(600)[0]!, r2 = f.rings(3000)[0]!;
    expect(r1.length).toBeLessThanOrEqual(200); expect(r1[0]).toEqual(r1.at(-1));
    const span = (r: typeof r1) => Math.max(...r.map((p) => p[0])) - Math.min(...r.map((p) => p[0]));
    expect(span(r2)).toBeGreaterThan(span(r1));
    const b = [0, 600, 3000, 20000].map((t) => f.burnedFraction(t));
    expect(b).toEqual([...b].sort((x, y) => x - y)); expect(b[0]).toBeGreaterThan(0); expect(b.at(-1)).toBeLessThanOrEqual(1);
  });
});
