// OWNER: Lane D. Fuzz the real engine on the real Amherst road graph and check invariants.
// Each fuzz seed draws its own ScenarioConfig (sim seed, wind, ignition, helper count, policy) from the
// public knobs only, runs the real sim, and checks, on every plan and every frame:
//   - no route the router returns crosses ground that is burning at the time it was asked for
//   - no assignment or helper goes over capacity; wheelchair homes only go to wheelchair-capable helpers
//   - ETAs and deadlines are finite-or-flagged and never negative; etaSeconds <= deadlineSeconds unless flagged
//   - the sim terminates within the horizon
//   - the same config gives identical final metrics and frame history twice
// Usage (from engine/): pnpm exec tsx scripts/fuzz-invariants.ts [count=300] [start=1]
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { ScenarioConfig } from '@lastmile/contracts';
import type { Assignment, FireModel, LatLng, Router, WorldSnapshot } from '@lastmile/contracts';
import { createSim, HORIZON_S } from '../src/sim/engine';
import { createFireModel } from '../src/sim/fire';
import { createRouter } from '../src/routing/index';
import { createDispatcher } from '../src/dispatch/index';
import { loadTown } from '../src/world/town';
import { prng } from '../src/montecarlo/stats';

const CENTER = { lat: 42.3732, lng: -72.5199 };

export function fuzzConfig(fuzzSeed: number): ScenarioConfig {
  const rnd = prng(fuzzSeed * 7919 + 13);
  const dLat = 1500 / 111_320, dLng = 1500 / (111_320 * Math.cos((CENTER.lat * Math.PI) / 180));
  return ScenarioConfig.parse({
    seed: Math.floor(rnd() * 1_000_000),
    town: 'amherst',
    helperCount: Math.floor(rnd() * 49), // 0..48
    wind: { speedMph: Math.round(rnd() * 45), dirDeg: Math.round(rnd() * 360) },
    ignition: { lat: CENTER.lat + (rnd() * 2 - 1) * dLat, lng: CENTER.lng + (rnd() * 2 - 1) * dLng },
    policy: rnd() < 0.5 ? 'alerts_only' : 'last_mile',
  });
}

/** points along a polyline, skipping the first and last legs (straight access legs off the road graph) */
function roadPoints(path: LatLng[]): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 2; i < path.length - 1; i++) {
    const p = path[i - 1]!, q = path[i]!;
    for (const f of [0, 0.5, 1]) pts.push({ lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f });
  }
  return pts;
}

interface RunTrace { final: string; frames: string[]; violations: string[] }

function runOnce(config: ScenarioConfig): RunTrace {
  const violations: string[] = [];
  const v = (msg: string) => { if (violations.length < 20) violations.push(msg); };
  const fire: FireModel = createFireModel(config);
  const inner = createRouter(loadTown(config.town), fire);
  const router: Router = {
    travelSeconds: (a, b, t) => {
      const s = inner.travelSeconds(a, b, t);
      if (!(s >= 0)) v(`travelSeconds returned ${s} at t=${t}`);
      return s;
    },
    route: (a, b, t) => {
      const path = inner.route(a, b, t);
      for (const p of roadPoints(path)) if (fire.isBurning(p, t)) { v(`route at t=${t} crosses burning ground at ${p.lat.toFixed(5)},${p.lng.toFixed(5)}`); break; }
      return path;
    },
  };
  const d = createDispatcher();
  const dispatcher = {
    plan: (w: WorldSnapshot): Assignment[] => {
      const out = d.plan(w);
      const flagged = new Set(d.lastUnservable().map((u) => u.householdId));
      const byId = new Map(w.households.map((h) => [h.id, h]));
      const helpers = new Map(w.helpers.map((p) => [p.id, p]));
      for (const a of out) {
        const p = helpers.get(a.helperId);
        if (!p) { v(`assignment ${a.id} names unknown helper ${a.helperId}`); continue; }
        const load = w.helperStates[a.helperId]?.load ?? 0;
        const people = a.householdIds.reduce((n, id) => n + (byId.get(id)?.residents ?? 0), 0);
        if (load + people > p.capacity) v(`t=${w.t} ${a.id}: ${load}+${people} people > capacity ${p.capacity}`);
        if (!p.wheelchairCapable && a.householdIds.some((id) => byId.get(id)?.needs.includes('wheelchair'))) v(`t=${w.t} ${a.id}: wheelchair home on non-capable helper`);
        if (!(a.etaSeconds >= 0)) v(`t=${w.t} ${a.id}: etaSeconds ${a.etaSeconds}`);
        if (!(a.deadlineSeconds >= 0) && !a.householdIds.some((id) => flagged.has(id))) v(`t=${w.t} ${a.id}: deadlineSeconds ${a.deadlineSeconds} without a flag`);
        if (a.etaSeconds > a.deadlineSeconds && !a.householdIds.some((id) => flagged.has(id))) v(`t=${w.t} ${a.id}: late trip not flagged`);
        for (const pt of roadPoints(a.route)) if (fire.isBurning(pt, w.t)) { v(`t=${w.t} ${a.id}: route crosses burning ground`); break; }
      }
      return out;
    },
  };
  const sim = createSim(config, `fuzz-${config.seed}-${config.policy}`, { router, dispatcher });
  const frames: string[] = [];
  const capacity = new Map(sim.init.helpers.map((p) => [p.id, p.capacity]));
  let steps = 0;
  const maxSteps = Math.ceil((HORIZON_S * 1.5) / 60);
  while (!sim.done) {
    if (++steps > maxSteps) { v(`did not terminate within ${HORIZON_S * 1.5} s`); break; }
    sim.advance(60);
    const f = sim.frame();
    for (const h of f.helpers) if (h.load > (capacity.get(h.id) ?? 0)) v(`t=${f.t} helper ${h.id} load ${h.load} > capacity`);
    frames.push(`${f.t}|${f.metrics.evacuated}|${f.metrics.trapped}|${f.helpers.map((h) => `${h.status}${h.load}`).join(',')}`);
  }
  if (sim.stats.rejectedCapacity) v(`engine rejected ${sim.stats.rejectedCapacity} over-capacity assignments`);
  if (sim.stats.rejectedWheelchair) v(`engine rejected ${sim.stats.rejectedWheelchair} wheelchair assignments`);
  return { final: JSON.stringify(sim.finalMetrics()), frames, violations };
}

/** All invariant violations for one fuzz seed (empty = pass). */
export function checkFuzzSeed(fuzzSeed: number): string[] {
  const config = fuzzConfig(fuzzSeed);
  const a = runOnce(config);
  const b = runOnce(config);
  const out = [...a.violations];
  if (a.final !== b.final) out.push(`non-deterministic final metrics: ${a.final} vs ${b.final}`);
  else if (a.frames.join('\n') !== b.frames.join('\n')) out.push('non-deterministic frame history');
  return out;
}

async function main() {
  const count = Number(process.argv[2] ?? 300);
  const start = Number(process.argv[3] ?? 1);
  const t0 = performance.now();
  let failed = 0;
  for (let s = start; s < start + count; s++) {
    const bad = checkFuzzSeed(s);
    if (bad.length) {
      failed++;
      console.log(`FAIL fuzz seed ${s} config ${JSON.stringify(fuzzConfig(s))}`);
      for (const m of bad.slice(0, 5)) console.log(`   ${m}`);
    }
  }
  console.log(`${count} fuzz seeds (${start}..${start + count - 1}), ${failed} failed, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) void main();
