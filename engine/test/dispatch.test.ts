import { describe, expect, it } from 'vitest';
import type { FireModel, Helper, HelperState, Household, HouseholdState, LatLng, ScenarioConfig, WorldSnapshot } from '@lastmile/contracts';
import { Assignment } from '@lastmile/contracts';
import { createDispatcher, dispatchAssumptions } from '../src/dispatch/index';
import { createRouter } from '../src/routing/index';
import { makeGridGraph } from '../src/world/town';

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const config: ScenarioConfig = {
  seed: 1, town: 'synthetic_grid', helperCount: 24, wind: { speedMph: 10, dirDeg: 90 },
  ignition: { lat: 42.3732, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 8,
};
const noFire: FireModel = { ignitionTime: () => Infinity, isBurning: () => false, rings: () => [], burnedFraction: () => 0 };
const graph = makeGridGraph(20, 150);
const nodeAt = (r: number, c: number): LatLng => { const n = graph.nodes[r * 20 + c]!; return { lat: n.lat, lng: n.lng }; };
const zone = { id: 'z1', name: 'Safe zone', position: nodeAt(0, 0) };

function world(households: Household[], ttis: Record<string, number | null>, helpers: Helper[], extra: Partial<WorldSnapshot> = {}): WorldSnapshot {
  const householdStates: Record<string, HouseholdState> = {};
  for (const h of households) householdStates[h.id] = { id: h.id, status: 'needs_help', ttiSeconds: ttis[h.id] ?? null };
  const helperStates: Record<string, HelperState> = {};
  for (const p of helpers) helperStates[p.id] = { id: p.id, position: p.position, status: 'idle', assignmentId: null, load: 0 };
  return {
    t: 0, config, households, householdStates, helpers, helperStates, safeZones: [zone],
    fire: noFire, router: createRouter(graph, noFire), ...extra,
  };
}
const hh = (id: string, position: LatLng, residents = 1, needs: Household['needs'] = ['no_vehicle']): Household =>
  ({ id, position, residents, language: 'en', needs, hasVehicle: false, landlineOnly: false });
const helper = (id: string, position: LatLng, capacity = 4, wheelchairCapable = false, kind: Helper['kind'] = 'volunteer'): Helper =>
  ({ id, kind, position, capacity, wheelchairCapable });

function randomWorld(seed: number, nHouseholds: number, nHelpers: number) {
  const rnd = mulberry32(seed);
  const jitter = () => (rnd() - 0.5) * 0.0008;
  const households: Household[] = [];
  const ttis: Record<string, number | null> = {};
  for (let i = 0; i < nHouseholds; i++) {
    const p = nodeAt(Math.floor(rnd() * 20), Math.floor(rnd() * 20));
    const needs: Household['needs'] = ['no_vehicle'];
    if (rnd() < 0.08) needs.push('wheelchair');
    const id = `h${String(i).padStart(3, '0')}`;
    households.push(hh(id, { lat: p.lat + jitter(), lng: p.lng + jitter() }, 1 + Math.floor(rnd() * 4), needs));
    ttis[id] = rnd() < 0.1 ? null : 200 + rnd() * 2400;
  }
  const kinds: [Helper['kind'], number, boolean][] = [['neighbor', 3, false], ['volunteer', 4, false], ['accessible_van', 4, true], ['shuttle_bus', 12, false]];
  const helpers: Helper[] = [];
  for (let i = 0; i < nHelpers; i++) {
    const [kind, cap, wc] = kinds[i % kinds.length]!;
    helpers.push(helper(`p${String(i).padStart(2, '0')}`, nodeAt(Math.floor(rnd() * 20), Math.floor(rnd() * 20)), cap, wc, kind));
  }
  return { households, ttis, helpers };
}

function checkRules(w: WorldSnapshot, plan: Assignment[], flagged: Set<string>) {
  const byId = new Map(w.households.map((h) => [h.id, h]));
  const helpersById = new Map(w.helpers.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const usedHelpers = new Set<string>();
  for (const a of plan) {
    expect(Assignment.safeParse(a).success).toBe(true);
    const p = helpersById.get(a.helperId)!;
    expect(usedHelpers.has(a.helperId)).toBe(false); // one trip per helper
    usedHelpers.add(a.helperId);
    let people = 0;
    for (const id of a.householdIds) {
      expect(seen.has(id)).toBe(false); // each home at most once
      seen.add(id);
      const h = byId.get(id)!;
      people += h.residents;
      if (h.needs.includes('wheelchair')) expect(p.wheelchairCapable).toBe(true);
    }
    expect(people).toBeLessThanOrEqual(p.capacity);
    if (a.etaSeconds > a.deadlineSeconds) for (const id of a.householdIds) expect(flagged.has(id)).toBe(true);
    expect(a.reason).toMatch(/^[A-Z].*\.$/);
    expect(a.reason.slice(0, -1)).not.toMatch(/\.\s/); // one sentence
  }
  // completeness: every home needing help is either on a trip or flagged
  for (const h of w.households) expect(seen.has(h.id) || flagged.has(h.id)).toBe(true);
}

describe('createDispatcher', () => {
  it('returns nothing and flags everyone when there are no helpers', () => {
    const w = world([hh('h1', nodeAt(5, 5))], { h1: 900 }, []);
    const d = createDispatcher();
    expect(d.plan(w)).toEqual([]);
    expect(d.lastUnservable().map((u) => u.householdId)).toEqual(['h1']);
    expect(d.lastUnservable()[0]!.reason).toMatch(/No helper is available/);
  });

  it('sends the nearest capable helper with a one-sentence reason', () => {
    const w = world([hh('h1', nodeAt(5, 5))], { h1: 1800 }, [helper('far', nodeAt(19, 19)), helper('near', nodeAt(5, 7))]);
    const plan = createDispatcher().plan(w);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.helperId).toBe('near');
    expect(plan[0]!.householdIds).toEqual(['h1']);
    expect(plan[0]!.etaSeconds).toBeLessThanOrEqual(plan[0]!.deadlineSeconds);
    expect(plan[0]!.deadlineSeconds).toBe(1800 - 120);
    expect(plan[0]!.reason).toMatch(/Volunteer driver is \d+\.\d min away, arrives \d+\.\d min before the safety deadline\./);
    const r = plan[0]!.route;
    expect(r[0]).toEqual(nodeAt(5, 7));
    expect(r[r.length - 1]).toEqual(zone.position);
  });

  it('only wheelchair-capable helpers take wheelchair users', () => {
    const w = world(
      [hh('h1', nodeAt(5, 5), 1, ['wheelchair'])],
      { h1: 1800 },
      [helper('car', nodeAt(5, 6)), helper('van', nodeAt(15, 15), 4, true, 'accessible_van')],
    );
    const plan = createDispatcher().plan(w);
    expect(plan.map((a) => a.helperId)).toEqual(['van']);
    expect(plan[0]!.reason).toMatch(/only wheelchair-capable helper/);
    const none = world([hh('h1', nodeAt(5, 5), 1, ['wheelchair'])], { h1: 1800 }, [helper('car', nodeAt(5, 6))]);
    const d = createDispatcher();
    expect(d.plan(none)).toEqual([]);
    expect(d.lastUnservable()[0]!.reason).toMatch(/wheelchair-capable/);
  });

  it('never exceeds capacity and combines nearby homes on one trip when it fits', () => {
    const w = world(
      [hh('a', nodeAt(10, 10), 2), hh('b', nodeAt(10, 11), 2), hh('c', nodeAt(10, 12), 2)],
      { a: 3000, b: 3000, c: 3000 },
      [helper('p1', nodeAt(10, 14), 4)],
    );
    const d = createDispatcher();
    const plan = d.plan(w);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.householdIds).toHaveLength(2);
    expect(plan[0]!.reason).toMatch(/picks up 2 homes \(4 people\) on one trip/);
    expect(d.lastUnservable()).toHaveLength(1);
  });

  it('flags a home no helper can reach in time, with a best-effort trip if the fire is later', () => {
    // 19 blocks away is ~255 s at 25 mph: misses a 200 s deadline but beats a 320 s fire arrival
    const w = world([hh('h1', nodeAt(19, 19))], { h1: 320 }, [helper('p1', nodeAt(0, 19))]);
    const d = createDispatcher();
    const plan = d.plan(w);
    const u = d.lastUnservable();
    expect(u).toHaveLength(1);
    expect(u[0]!.bestEffort).toBe(true);
    expect(u[0]!.reason).toMatch(/safety deadline/);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.etaSeconds).toBeGreaterThan(plan[0]!.deadlineSeconds);
    expect(plan[0]!.reason).toMatch(/^Best effort:/);
    // a fire that arrives before any helper could: flagged, nobody sent
    const w2 = world([hh('h1', nodeAt(19, 19))], { h1: 150 }, [helper('p1', nodeAt(0, 19))]);
    const d2 = createDispatcher();
    expect(d2.plan(w2)).toEqual([]);
    expect(d2.lastUnservable()[0]!.bestEffort).toBe(false);
  });

  it('flags homes cut off by a burning road and says why', () => {
    const W = 20 / (111_320 * Math.cos((42.3732 * Math.PI) / 180));
    const mid = (nodeAt(0, 9).lng + nodeAt(0, 10).lng) / 2;
    const ign = (p: LatLng) => (Math.abs(p.lng - mid) <= W ? 0 : Infinity);
    const wall: FireModel = { ignitionTime: ign, isBurning: (p, t) => ign(p) <= t, rings: () => [], burnedFraction: () => 0 };
    const w = world([hh('h1', nodeAt(5, 15))], { h1: 1500 }, [helper('p1', nodeAt(5, 2))], { fire: wall, router: createRouter(graph, wall), t: 30 });
    const d = createDispatcher();
    expect(d.plan(w)).toEqual([]);
    expect(d.lastUnservable()[0]!.reason).toMatch(/cut off the roads/);
  });

  it('keeps an enroute helper on its current pickup when a slightly closer home appears', () => {
    const d = createDispatcher();
    const p = helper('p1', nodeAt(10, 10), 1);
    const w1 = world([hh('far', nodeAt(10, 16))], { far: 3000 }, [p]);
    const [a1] = d.plan(w1);
    expect(a1!.householdIds).toEqual(['far']);
    const w2 = world([hh('far', nodeAt(10, 16)), hh('near', nodeAt(10, 12))], { far: 3000, near: 3000 }, [p]);
    w2.householdStates.far!.status = 'assigned';
    w2.helperStates.p1 = { id: 'p1', position: nodeAt(10, 11), status: 'enroute', assignmentId: a1!.id, load: 0 };
    const [a2] = d.plan(w2);
    expect(a2!.householdIds[0]).toBe('far');
    expect(a2!.id).toBe(a1!.id); // stable assignment id
    expect(a2!.reason).toMatch(/already on the way/);
  });

  it('ignores households that do not need help and helpers that are off shift', () => {
    const w = world([hh('h1', nodeAt(5, 5)), hh('h2', nodeAt(6, 6))], { h1: 1800, h2: 1800 }, [helper('p1', nodeAt(5, 6)), helper('p2', nodeAt(6, 7))]);
    w.householdStates.h2!.status = 'self_evacuating';
    w.helperStates.p1!.status = 'done';
    const plan = createDispatcher().plan(w);
    expect(plan.map((a) => [a.helperId, a.householdIds])).toEqual([['p2', ['h1']]]);
  });

  it('gives a loaded helper more pickups only within its remaining seats', () => {
    const w = world([hh('small', nodeAt(5, 5), 1), hh('big', nodeAt(5, 6), 3)], { small: 1800, big: 1800 }, [helper('p1', nodeAt(5, 7), 4)]);
    w.helperStates.p1 = { id: 'p1', position: nodeAt(5, 7), status: 'loaded', assignmentId: null, load: 2 };
    const d = createDispatcher();
    const plan = d.plan(w);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.householdIds).toEqual(['small']); // 2 on board + 1 fits, + 3 would not
    expect(d.lastUnservable().map((u) => u.householdId)).toEqual(['big']);
    const full = world([hh('small', nodeAt(5, 5), 1)], { small: 1800 }, [helper('p1', nodeAt(5, 7), 4)]);
    full.helperStates.p1 = { id: 'p1', position: nodeAt(5, 7), status: 'loaded', assignmentId: null, load: 4 };
    expect(createDispatcher().plan(full)).toEqual([]);
  });

  it('never moves an assigned home to a different helper', () => {
    const d = createDispatcher();
    const homes = [hh('h1', nodeAt(10, 10))];
    const far = helper('far', nodeAt(10, 18)), near = helper('near', nodeAt(10, 11));
    // first plan: only `far` exists, so it gets h1
    const [a1] = d.plan(world(homes, { h1: 3000 }, [far]));
    expect(a1!.helperId).toBe('far');
    // now `near` appears; h1 is assigned to `far`, which is enroute, so it must stay with `far`
    const w = world(homes, { h1: 3000 }, [far, near]);
    w.householdStates.h1!.status = 'assigned';
    w.helperStates.far = { id: 'far', position: nodeAt(10, 17), status: 'enroute', assignmentId: a1!.id, load: 0 };
    const plan = d.plan(w);
    expect(plan.map((a) => [a.helperId, a.householdIds])).toEqual([['far', ['h1']]]);
    // an assigned home whose helper we do not know about is left alone (not moved, not flagged)
    const fresh = createDispatcher();
    expect(fresh.plan(w)).toEqual([]);
    expect(fresh.lastUnservable()).toEqual([]);
  });

  it('obeys every rule on random 600-home scenarios', () => {
    for (const seed of [1, 2, 3]) {
      const { households, ttis, helpers } = randomWorld(seed, 600, 24);
      const w = world(households, ttis, helpers);
      const d = createDispatcher();
      const plan = d.plan(w);
      checkRules(w, plan, new Set(d.lastUnservable().map((u) => u.householdId)));
      expect(plan.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const { households, ttis, helpers } = randomWorld(7, 300, 24);
    const p1 = createDispatcher().plan(world(households, ttis, helpers));
    const p2 = createDispatcher().plan(world(households, ttis, helpers));
    expect(JSON.stringify(p2)).toBe(JSON.stringify(p1));
  });

  it('plans 600 homes in under 20 ms once the router is warm', () => {
    const { households, ttis, helpers } = randomWorld(11, 600, 24);
    const w = world(households, ttis, helpers);
    const d = createDispatcher();
    const c0 = performance.now();
    d.plan(w);
    const cold = performance.now() - c0;
    const times: number[] = [];
    for (let i = 0; i < 15; i++) {
      w.t = i + 1; // ticks move on; router trees stay cached while no road changes state
      const s = performance.now();
      d.plan(w);
      times.push(performance.now() - s);
    }
    times.sort((a, b) => a - b);
    const median = times[7]!;
    console.log(`dispatch 600 homes / 24 helpers: cold ${cold.toFixed(1)} ms, warm median ${median.toFixed(1)} ms`);
    // 20 ms is the target on a dev box / the Vultr VM; shared CI runners (2 vCPU, test files in parallel) get 3x slack
    expect(median).toBeLessThan(process.env.CI ? 60 : 20);
  });

  it('describes its rules in plain English', () => {
    expect(dispatchAssumptions().join(' ')).toMatch(/wheelchair/);
  });
});
