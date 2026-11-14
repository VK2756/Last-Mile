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
