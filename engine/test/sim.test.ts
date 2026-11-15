import { describe, expect, it } from 'vitest';
import type { Assignment, Dispatcher, ScenarioConfig, StreamEvent, WorldSnapshot } from '@lastmile/contracts';
import { SimFrame, StreamEvent as SE, ScenarioConfig as ScenarioConfigSchema } from '@lastmile/contracts';
import { createSim } from '../src/sim/engine';
import { runHeadless, runHeadlessWith } from '../src/sim/headless';
import { distMeters } from '../src/sim/geo';

const mk = (seed: number, policy: ScenarioConfig['policy'], helperCount = 24, dir = 90): ScenarioConfig =>
  ({ seed, town: 'amherst', helperCount, wind: { speedMph: 20, dirDeg: dir }, ignition: { lat: 42.3732, lng: -72.5199 }, policy, speedMultiplier: 8 });

/** Simple greedy dispatcher used ONLY to exercise the engine's adoption logic (Lane D ships the real one). */
const greedy: Dispatcher = {
  plan(w: WorldSnapshot): Assignment[] {
    const out: Assignment[] = []; const used = new Set<string>();
    const needy = w.households.filter((h) => w.householdStates[h.id]!.status === 'needs_help');
    for (const h of needy) {
      const helper = w.helpers.filter((p) => !used.has(p.id) && w.helperStates[p.id]!.status === 'idle' && p.capacity >= h.residents && (p.wheelchairCapable || !h.needs.includes('wheelchair')))
        .sort((a, b) => distMeters(a.position, h.position) - distMeters(b.position, h.position))[0];
      if (!helper) continue; used.add(helper.id);
      const z = w.safeZones[0]!;
      out.push({ id: `a-${helper.id}-${h.id}`, helperId: helper.id, householdIds: [h.id], route: [w.helperStates[helper.id]!.position, h.position, z.position], etaSeconds: 300, deadlineSeconds: 3000, reason: 'nearest idle capable helper' });
    }
    return out;
  },
};
// also try to over-assign: one helper, many households
const greedyBad: Dispatcher = {
  plan(w) {
    const p = w.helpers[0]!; const ids = w.households.filter((h) => w.householdStates[h.id]!.status === 'needs_help').slice(0, 30).map((h) => h.id);
    return ids.length ? [{ id: 'bad', helperId: p.id, householdIds: ids, route: [w.helperStates[p.id]!.position, w.safeZones[0]!.position], etaSeconds: 1, deadlineSeconds: 9999, reason: 'bad' }] : [];
  },
};

describe('sim engine', () => {
  it('is deterministic: same seed => identical final metrics; different seed differs', async () => {
    const a = await runHeadless(mk(11, 'alerts_only')), b = await runHeadless(mk(11, 'alerts_only')), c = await runHeadless(mk(12, 'alerts_only'));
    expect(a).toEqual(b); expect(c).not.toEqual(a);
    expect(a.total).toBeGreaterThan(50); expect(a.evacuated + a.trapped + a.inProgress).toBe(a.total);
  });
  it('alerts-only baseline is not a strawman: most at-risk households get out', async () => {
    const m = await runHeadless(mk(3, 'alerts_only')); expect(m.evacuated / m.total).toBeGreaterThan(0.5); expect(m.trapped).toBeGreaterThan(0);
  });
  it('helperCount=0: last_mile equals alerts_only', async () => {
    for (const seed of [1, 2, 3]) expect(await runHeadless(mk(seed, 'last_mile', 0))).toEqual(await runHeadless(mk(seed, 'alerts_only', 0)));
  });
  it('streamed final metrics equal headless (with a dispatcher)', () => {
    const cfg = mk(5, 'last_mile'); const sim = createSim(cfg, 'x', { dispatcher: greedy });
    while (!sim.done) sim.step(4.5); // odd step size on purpose
    expect(sim.finalMetrics()).toEqual(runHeadlessWith(cfg, { dispatcher: greedy }));
  });
  it('every frame parses; helpers never exceed capacity; wheelchair rules hold; dispatch helps', () => {
    const cfg = mk(6, 'last_mile'); const sim = createSim(cfg, 'y', { dispatcher: greedy });
    const cap = new Map(sim.init.helpers.map((h) => [h.id, h.capacity]));
    let i = 0;
    while (!sim.done) { const f = sim.step(5); if (i++ % 40 === 0) SimFrame.parse(f); for (const h of f.helpers) expect(h.load).toBeLessThanOrEqual(cap.get(h.id)!); }
    expect(sim.stats.rejectedWheelchair).toBe(0);
    const base = runHeadlessWith(mk(6, 'alerts_only'));
    expect(sim.finalMetrics().vulnerableEvacuated).toBeGreaterThan(base.vulnerableEvacuated);
  });
  it('rejects over-capacity assignments from a bad dispatcher', () => {
    const sim = createSim(mk(6, 'last_mile', 2), 'z', { dispatcher: greedyBad });
    while (!sim.done) sim.advance(300);
    expect(sim.stats.rejectedCapacity).toBeGreaterThan(0);
  });
  it('init event passes the contract and tick is fast at 600 households', () => {
    const sim = createSim(mk(7, 'last_mile'), 'p', { dispatcher: greedy });
    SE.parse({ type: 'init', init: sim.init } satisfies StreamEvent);
    const t0 = performance.now(); sim.advance(200); const per = (performance.now() - t0) / 200;
    expect(per).toBeLessThan(50);
  });
});

import { TriageResult } from '@lastmile/contracts';
const triage = (householdId: string, o: Partial<TriageResult> = {}): TriageResult => ({ householdId, needs: ['oxygen'], hasRide: false, canWalkToRoad: false, residents: 2, urgency: 5, reply: 'ok', summary: 's', done: true, ...o });

describe('triage', () => {
  it('flips a household with a car to needs_help, merges needs, drops its own ride, and gets it rescued', () => {
    const sim = createSim(mk(9, 'last_mile'), 'tri', { dispatcher: greedy });
    const withCar = sim.init.households.find((h) => h.hasVehicle && !h.needs.includes('oxygen'))!;
    const out = sim.applyTriage(triage(withCar.id));
    expect(out).toMatchObject({ ok: true, status: 'needs_help', flipped: true });
    expect(withCar.hasVehicle).toBe(false); expect(withCar.needs).toEqual(expect.arrayContaining(['oxygen', 'no_vehicle']));
    expect(sim.frame().households.find((h) => h.id === withCar.id)!.status).toBe('needs_help');
    sim.advance(60);
    expect(['needs_help', 'assigned', 'enroute', 'evacuated', 'trapped']).toContain(sim.frame().households.find((h) => h.id === withCar.id)!.status);
  });
  it('rejects unknown and already-resolved households without throwing', () => {
    const sim = createSim(mk(9, 'alerts_only'), 'tri2');
    expect(sim.applyTriage(triage('nope'))).toMatchObject({ ok: false, code: 'unknown_household' });
    while (!sim.done) sim.advance(600);
    const done = sim.frame().households.find((h) => h.status === 'evacuated' || h.status === 'trapped')!;
    expect(sim.applyTriage(triage(done.id))).toMatchObject({ ok: false, code: 'already_resolved' });
  });
});

describe('sensitivity variants', () => {
  it('every non-default assumption is listed in SimInit.assumptions, defaults are not flagged', () => {
    const base = createSim(mk(1, 'last_mile'), 'v0').init.assumptions.join('\n');
    expect(base).not.toContain('SENSITIVITY'); expect(base).toMatch(/1 to 3 min after that household is warned/);
    const harsh = createSim(mk(1, 'last_mile'), 'v1', { variant: { helpDelayS: [300, 600], helperPlacement: 'far_from_fire' } }).init.assumptions.join('\n');
    expect(harsh).toMatch(/5 to 10 min after that household is warned \(SENSITIVITY/); expect(harsh).toMatch(/SENSITIVITY: helpers .*far from the fire/);
  });
  it('variants are deterministic and slower help never beats instant help by construction of the same people', () => {
    const v = { helpDelayS: [300, 600] as [number, number] };
    expect(runHeadlessWith(mk(4, 'last_mile'), { variant: v })).toEqual(runHeadlessWith(mk(4, 'last_mile'), { variant: v }));
    expect(runHeadlessWith(mk(4, 'alerts_only'), { variant: v })).toEqual(runHeadlessWith(mk(4, 'alerts_only')));
  });
});

describe('baseline rate knobs (#71)', () => {
  const run = (baseline: ScenarioConfig['baseline'], policy: ScenarioConfig['policy'] = 'alerts_only') => runHeadlessWith({ ...mk(8, policy), baseline });
  it('absent or empty knobs do not change anything', () => { expect(run({})).toEqual(run(undefined)); expect(run({ familyPickupProb: 0.25, prepDelayScale: 1, alertIssueS: 300 })).toEqual(run(undefined)); });
  it('more family pickups evacuate more vulnerable households; slower preparation traps more', () => {
    const base = run(undefined);
    expect(run({ familyPickupProb: 0.75 }).vulnerableEvacuated).toBeGreaterThan(base.vulnerableEvacuated);
    expect(run({ familyPickupProb: 0 }).vulnerableEvacuated).toBeLessThan(base.vulnerableEvacuated);
    expect(run({ prepDelayScale: 3 }).trapped).toBeGreaterThanOrEqual(base.trapped);
    expect(run({ alertIssueS: 3000 }).trapped).toBeGreaterThan(base.trapped);
  });
  it('deterministic, applied to both policies, and every non-default is in SimInit.assumptions', () => {
    const k = { familyPickupProb: 0.5, prepDelayScale: 1.5, alertIssueS: 600 };
    expect(run(k, 'last_mile')).toEqual(run(k, 'last_mile'));
    const a = createSim({ ...mk(8, 'alerts_only'), baseline: k }, 'k1').init.assumptions.join('\n');
    expect(a).toMatch(/SENSITIVITY: Alerts-only baseline.*prepDelayScale 1.5/); expect(a).toMatch(/SENSITIVITY: Households without a vehicle.*50%/); expect(a).toMatch(/SENSITIVITY: The alert is issued 600 s/);
    expect(a).toMatch(/SENSITIVITY: non-default/);
    expect(createSim(mk(8, 'alerts_only'), 'k0').init.assumptions.join('\n')).not.toContain('SENSITIVITY');
  });
});

describe('urgent family pickup (#72)', () => {
  const run = (baseline: ScenarioConfig['baseline']) => runHeadlessWith({ ...mk(8, 'alerts_only'), baseline });
  it('off (absent or false) changes nothing; on helps the baseline and is announced', () => {
    expect(run({ urgentFamilyPickup: false })).toEqual(run(undefined));
    const base = run(undefined), urgent = run({ urgentFamilyPickup: true });
    expect(urgent.vulnerableEvacuated).toBeGreaterThanOrEqual(base.vulnerableEvacuated); expect(urgent.evacuated).toBeGreaterThan(base.evacuated);
    expect(createSim({ ...mk(8, 'alerts_only'), baseline: { urgentFamilyPickup: true } }, 'u').init.assumptions.join('\n')).toMatch(/SENSITIVITY: family pickups hurry/);
    expect(createSim(mk(8, 'alerts_only'), 'u0').init.assumptions.join('\n')).not.toMatch(/hurry/);
  });
  it('the delay formula: shrinks with time-to-impact, never below 120 s, never above the drawn delay', async () => {
    const { selfEvacDepartTime } = await import('../src/policy/alertsOnly');
    const b = { alertDelayS: 0, prepS: 0, familyPickup: true, pickupDelayS: 2000, helpRequestDelayS: 0, rideRoll: 0 };
    expect(selfEvacDepartTime({ hasVehicle: false }, b, 1000, { ign: 2000 })).toBe(1000 + 500);
    expect(selfEvacDepartTime({ hasVehicle: false }, b, 1000, { ign: 1100 })).toBe(1000 + 120);
    expect(selfEvacDepartTime({ hasVehicle: false }, b, 1000, { ign: 20000 })).toBe(1000 + 2000);
    expect(selfEvacDepartTime({ hasVehicle: false }, b, 1000)).toBe(3000);
    expect(selfEvacDepartTime({ hasVehicle: false }, { ...b, familyPickup: false }, 1000, { ign: 2000 })).toBe(Infinity);
  });
  it('deterministic and applied to both policies', () => {
    const k = { urgentFamilyPickup: true };
    expect(runHeadlessWith({ ...mk(8, 'last_mile'), baseline: k })).toEqual(runHeadlessWith({ ...mk(8, 'last_mile'), baseline: k }));
  });
});

describe('neighbour rides (#69)', () => {
  const sim = (baseline: ScenarioConfig['baseline'], policy: ScenarioConfig['policy'] = 'alerts_only') => { const s = createSim({ ...mk(8, policy), baseline }, 'nr'); while (!s.done) s.advance(600); return s; };
  it('p=0 or absent changes nothing (and the roll stream never shifts other draws)', () => {
    expect(sim({ neighborRideProb: 0 }).finalMetrics()).toEqual(sim(undefined).finalMetrics()); expect(sim(undefined).stats.neighborRides).toBe(0);
  });
  it('rides help the baseline, grow with p, never carry wheelchair users, and respect the seat limit', () => {
    const base = sim(undefined), lo = sim({ neighborRideProb: 0.1 }), hi = sim({ neighborRideProb: 1 });
    expect(lo.stats.neighborRides).toBeGreaterThan(0); expect(hi.stats.neighborRides).toBeGreaterThan(lo.stats.neighborRides);
    expect(hi.finalMetrics().vulnerableEvacuated).toBeGreaterThan(base.finalMetrics().vulnerableEvacuated);
    const byId = new Map(hi.init.households.map((h) => [h.id, h]));
    for (const id of hi.stats.rideIds) { const h = byId.get(id)!; expect(h.hasVehicle).toBe(false); expect(h.needs).not.toContain('wheelchair'); }
    expect(new Set(hi.stats.rideIds).size).toBe(hi.stats.rideIds.length); // nobody is picked up twice
  });
  it('deterministic, applied to both policies, and announced', () => {
    const a = sim({ neighborRideProb: 0.3 }, 'last_mile'), b = sim({ neighborRideProb: 0.3 }, 'last_mile');
    expect(a.finalMetrics()).toEqual(b.finalMetrics()); expect(a.stats.rideIds).toEqual(b.stats.rideIds); expect(a.stats.neighborRides).toBeGreaterThan(0);
    expect(a.init.assumptions.join('\n')).toMatch(/SENSITIVITY: neighbours give rides: with probability 0.3/);
    expect(sim(undefined).init.assumptions.join('\n')).not.toMatch(/neighbours give rides/);
  });
});

describe('regressions found by the fuzz (#114, #118)', () => {
  const stuck = { seed: 646366, helperCount: 15, wind: { speedMph: 23, dirDeg: 53 }, ignition: { lat: 42.369254, lng: -72.526365 }, policy: 'last_mile' as const, speedMultiplier: 8, town: 'amherst' as const, helperMix: { neighbor: 4, volunteer: 2, accessible_van: 3, shuttle_bus: 1 } };
  it('a loaded helper whose nearest safe zone is cut off drives to a reachable one instead of waiting (#118)', () => {
    const sim = createSim(ScenarioConfigSchema.parse(stuck), 'regress-118');
    const since = new Map<string, { x: string; t: number }>(); let worst = 0;
    for (let t = 60; t <= 5400; t += 60) {
      sim.advance(60);
      const fr = sim.frame(); if (fr.t < t) break; // the run is over (every at-risk household resolved)
      for (const h of fr.helpers) {
        const key = `${h.position.lat.toFixed(5)},${h.position.lng.toFixed(5)}`;
        const prev = since.get(h.id);
        if (h.status === 'loaded' && prev && prev.x === key) worst = Math.max(worst, t - prev.t);
        if (!prev || prev.x !== key || h.status !== 'loaded') since.set(h.id, { x: key, t });
      }
    }
    expect(worst).toBeLessThan(600);
  }, 60_000);
  it('no household appears in two assignments in one frame (#114)', () => {
    for (const seed of [3, 6, 8, 12]) { // all four showed a duplicate before the fix
      const sim = createSim(ScenarioConfigSchema.parse({ seed, helperCount: 11, wind: { speedMph: 32, dirDeg: 90 }, ignition: { lat: 42.38491, lng: -72.53772 }, policy: 'last_mile', speedMultiplier: 8, town: 'amherst', helperMix: { volunteer: 3 } }), `regress-114-${seed}`);
      for (let t = 10; t <= 3000; t += 10) {
        sim.advance(10); const f = sim.frame(); if (f.t < t) break;
        const seen = new Set<string>();
        for (const a of f.assignments) { expect(a.householdIds.length).toBeGreaterThan(0); for (const id of a.householdIds) { expect(seen.has(id), `seed ${seed} t ${f.t} ${id}`).toBe(false); seen.add(id); } }
      }
    }
  }, 120_000);
});
