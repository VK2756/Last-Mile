import { describe, expect, it } from 'vitest';
import { Household, isVulnerable, type ScenarioConfig } from '@lastmile/contracts';
import { createFireModel } from '../src/sim/fire';
import { makeGridGraph } from '../src/world/town';
import { generatePopulation, HOUSEHOLD_COUNT } from '../src/world/population';

const mk = (seed: number, helperCount = 24): ScenarioConfig => ({ seed, town: 'amherst', helperCount, wind: { speedMph: 20, dirDeg: 90 }, ignition: { lat: 42.3732, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 8 });
const gen = (seed: number, hc = 24) => { const c = mk(seed, hc); return generatePopulation(c, makeGridGraph(), createFireModel(c)); };

describe('population', () => {
  it('is deterministic by seed and independent of policy', () => {
    expect(gen(5)).toEqual(gen(5));
    const a = mk(5), b = { ...mk(5), policy: 'alerts_only' as const };
    const g = makeGridGraph();
    expect(generatePopulation(a, g, createFireModel(a))).toEqual(generatePopulation(b, g, createFireModel(b)));
    expect(gen(5).households).not.toEqual(gen(6).households);
  });
  it('produces valid contract objects', () => {
    const p = gen(1);
    expect(p.households).toHaveLength(HOUSEHOLD_COUNT);
    p.households.forEach((h) => Household.parse(h));
    expect(p.helpers).toHaveLength(24); expect(p.safeZones).toHaveLength(3);
  });
  it('matches the stated needs distribution over many seeds', () => {
    let n = 0, noVeh = 0, wc = 0, ll = 0, eng = 0, med = 0, vul = 0;
    for (let s = 1; s <= 20; s++) for (const h of gen(s, 0).households) {
      n++; if (!h.hasVehicle) noVeh++; if (h.needs.includes('wheelchair')) wc++; if (h.landlineOnly) ll++; if (h.needs.includes('limited_english')) eng++;
      if (h.needs.includes('oxygen') || h.needs.includes('medical_device')) med++; if (isVulnerable(h)) vul++;
    }
    const near = (x: number, want: number, tol = 0.012) => expect(Math.abs(x / n - want)).toBeLessThan(tol);
    near(noVeh, 0.12); near(wc, 0.06); near(ll, 0.10); near(eng, 0.08); near(med, 0.04);
    expect(vul / n).toBeGreaterThan(0.2); expect(vul / n).toBeLessThan(0.3);
  });
  it('has wheelchair-capable helpers and zero helpers when asked', () => {
    expect(gen(1).helpers.some((h) => h.wheelchairCapable)).toBe(true);
    expect(gen(1, 0).helpers).toHaveLength(0);
  });
  it('safe zones are the last-burning nodes', () => {
    const c = mk(2), f = createFireModel(c); const p = generatePopulation(c, makeGridGraph(), f);
    const med = [...makeGridGraph().nodes].map((n) => f.ignitionTime(n)).sort((a, b) => a - b)[200]!;
    p.safeZones.forEach((z) => expect(f.ignitionTime(z.position)).toBeGreaterThan(med));
  });
});

import { helperKinds } from '../src/world/population';
describe('helper fleet knobs (#73)', () => {
  const withKnobs = (extra: Partial<ScenarioConfig>) => { const c = { ...mk(5), ...extra }; return generatePopulation(c, makeGridGraph(), createFireModel(c)); };
  it('defaults: no knobs equals explicit undefined knobs, built-in pattern and capacities', () => {
    expect(withKnobs({ helperMix: undefined, helperCapacityScale: undefined })).toEqual(gen(5));
    expect(gen(5).helpers.slice(0, 4).map((h) => [h.kind, h.capacity])).toEqual([['neighbor', 3], ['volunteer', 4], ['neighbor', 3], ['accessible_van', 6]]);
  });
  it('all-neighbour fleet: capacity 3, no wheelchair-capable helper, same positions of the draw stream', () => {
    const p = withKnobs({ helperMix: { neighbor: 1 } });
    expect(p.helpers).toHaveLength(24); expect(p.helpers.every((h) => h.kind === 'neighbor' && h.capacity === 3 && !h.wheelchairCapable)).toBe(true);
    expect(p.helpers.map((h) => h.position)).toEqual(gen(5).helpers.map((h) => h.position)); // same seed, same start nodes
    expect(p.assumptions.join('\n')).toMatch(/helper fleet mix is set explicitly/);
  });
  it('mix weights are split by largest remainder and always sum to helperCount', () => {
    const k = helperKinds(10, { neighbor: 1, accessible_van: 1 }); expect(k.filter((x) => x === 'neighbor')).toHaveLength(5); expect(k.filter((x) => x === 'accessible_van')).toHaveLength(5);
    for (const n of [1, 7, 24, 33]) expect(helperKinds(n, { neighbor: 3, volunteer: 2, shuttle_bus: 1 })).toHaveLength(n);
  });
  it('capacity scale rounds, never below 1, and is announced', () => {
    const p = withKnobs({ helperCapacityScale: 0.25 }); expect(p.helpers.every((h) => h.capacity >= 1)).toBe(true); expect(p.helpers[3]!.capacity).toBe(2); // van 6 * 0.25 -> 2
    expect(p.assumptions.join('\n')).toMatch(/seat capacities are scaled by 0.25/);
    expect(withKnobs({ helperCapacityScale: 2 }).helpers[0]!.capacity).toBe(6);
  });
});
