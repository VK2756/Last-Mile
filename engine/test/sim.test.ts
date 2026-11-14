import { describe, expect, it } from 'vitest';
import type { Assignment, Dispatcher, ScenarioConfig, StreamEvent, WorldSnapshot } from '@lastmile/contracts';
import { SimFrame, StreamEvent as SE } from '@lastmile/contracts';
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
