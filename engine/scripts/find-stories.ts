// OWNER: Lane D. Search the real Amherst road graph for vivid, honest demo scenarios.
// For a grid of ignition points x wind directions it runs both policies on a few seeds and measures:
//   - "bridge" roads (undirected edges whose loss splits the road graph) that the fire burns, and how
//     many homes sit on the cut-off side
//   - homes the dispatcher flagged because the fire cut off every road to them
//   - wheelchair homes that waited longest for (or never got) a wheelchair-capable vehicle
//   - the paired lift on vulnerable homes for that setting
// Usage (from engine/): pnpm exec tsx scripts/find-stories.ts [seedsPerConfig=4]
import { ScenarioConfig, isVulnerable } from '@lastmile/contracts';
import type { Assignment, WorldSnapshot } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { createSim } from '../src/sim/engine';
import { createFireModel } from '../src/sim/fire';
import { createDispatcher } from '../src/dispatch/index';
import { loadTown } from '../src/world/town';

const seedsPer = Number(process.argv[2] ?? 4);
const g = loadTown('amherst');
const M = 111_320, lat0 = sampleInit.config.ignition.lat, cosLat = Math.cos((lat0 * Math.PI) / 180);

// ---- bridges of the undirected road graph (iterative Tarjan) ----
const und = new Map<string, { a: number; b: number }>();
for (const e of g.edges) { const a = Math.min(e.from, e.to), b = Math.max(e.from, e.to); und.set(`${a}-${b}`, { a, b }); }
const adj: { v: number; id: number }[][] = g.nodes.map(() => []);
const uEdges = [...und.values()];
uEdges.forEach((e, id) => { adj[e.a]!.push({ v: e.b, id }); adj[e.b]!.push({ v: e.a, id }); });
const tin = new Int32Array(g.nodes.length).fill(-1), low = new Int32Array(g.nodes.length);
const bridges: number[] = [];
let timer = 0;
for (let s = 0; s < g.nodes.length; s++) {
  if (tin[s] !== -1) continue;
  const stack: { u: number; pe: number; i: number }[] = [{ u: s, pe: -1, i: 0 }];
  tin[s] = low[s] = timer++;
  while (stack.length) {
    const top = stack[stack.length - 1]!;
    const list = adj[top.u]!;
    if (top.i < list.length) {
      const { v, id } = list[top.i++]!;
      if (id === top.pe) continue;
      if (tin[v] === -1) { tin[v] = low[v] = timer++; stack.push({ u: v, pe: id, i: 0 }); }
      else low[top.u] = Math.min(low[top.u]!, tin[v]!);
    } else {
      stack.pop();
      const parent = stack[stack.length - 1];
      if (parent) {
        low[parent.u] = Math.min(low[parent.u]!, low[top.u]!);
        if (low[top.u]! > tin[parent.u]!) bridges.push(top.pe);
      }
    }
  }
}
/** nodes on the smaller side when bridge id is removed */
function smallSide(id: number): Set<number> {
  const { a } = uEdges[id]!;
  const seen = new Set<number>([a]);
  const q = [a];
  while (q.length) { const u = q.pop()!; for (const { v, id: k } of adj[u]!) if (k !== id && !seen.has(v)) { seen.add(v); q.push(v); } }
  if (seen.size <= g.nodes.length / 2) return seen;
  const other = new Set<number>(); for (let i = 0; i < g.nodes.length; i++) if (!seen.has(i)) other.add(i);
  return other;
}
const bridgeSides = bridges.map((id) => ({ id, side: smallSide(id) })).filter((b) => b.side.size >= 4);

interface Row { label: string; config: Omit<ScenarioConfig, 'seed' | 'policy'>; lift: number; cutOff: number; burnedBridgeHomes: number; wcWorstEtaMin: number; wcUnserved: number; aoVuln: number; lmVuln: number }
const rows: Row[] = [];
const offsets = [-1200, 0, 1200];
for (const north of offsets) for (const east of offsets) for (const dirDeg of [0, 90, 180, 270]) {
  const base = { ...sampleInit.config, helperCount: 24, wind: { speedMph: 20, dirDeg }, ignition: { lat: lat0 + north / M, lng: sampleInit.config.ignition.lng + east / (M * cosLat) } };
  let lift = 0, cutOff = 0, bridgeHomes = 0, wcWorst = 0, wcUnserved = 0, ao = 0, lm = 0;
  for (let seed = 1; seed <= seedsPer; seed++) {
    const res: Record<string, number> = {};
    for (const policy of ['alerts_only', 'last_mile'] as const) {
      const config = ScenarioConfig.parse({ ...base, seed, policy });
      const d = createDispatcher();
      const firstWc = new Map<string, number>();
      const cut = new Set<string>();
      const wcIds = new Set<string>();
      const dispatcher = {
        plan: (w: WorldSnapshot): Assignment[] => {
          const out = d.plan(w);
          for (const u of d.lastUnservable()) if (/cut off the roads/.test(u.reason)) cut.add(u.householdId);
          for (const a of out) for (const id of a.householdIds) if (wcIds.has(id) && !firstWc.has(id)) firstWc.set(id, a.etaSeconds);
          return out;
        },
      };
      const sim = createSim(config, `story-${seed}-${policy}`, { dispatcher });
      for (const h of sim.init.households) if (h.needs.includes('wheelchair')) wcIds.add(h.id);
      while (!sim.done) sim.advance(600);
      const m = sim.finalMetrics();
      res[policy] = m.vulnerableTotal ? m.vulnerableEvacuated / m.vulnerableTotal : 0;
      if (policy === 'last_mile') {
        cutOff += cut.size;
        const final = new Map(sim.frame().households.map((h) => [h.id, h.status]));
        for (const id of wcIds) {
          const st = final.get(id);
          if (st === 'trapped' && !firstWc.has(id)) wcUnserved++;
        }
        wcWorst = Math.max(wcWorst, ...[...firstWc.values()].map((s) => s / 60));
        // homes (any) sitting on the small side of a bridge the fire burns within the horizon
        const fire = createFireModel(config);
        for (const b of bridgeSides) {
          const e = uEdges[b.id]!;
          const pa = g.nodes[e.a]!, pb = g.nodes[e.b]!;
          if (fire.ignitionTime({ lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 }) < 7200) {
            const sideHomes = sim.init.households.filter((h) => isVulnerable(h)).length && b.side.size;
            bridgeHomes = Math.max(bridgeHomes, sideHomes);
          }
        }
      }
    }
    lift += res.last_mile! - res.alerts_only!; ao += res.alerts_only!; lm += res.last_mile!;
  }
  rows.push({
    label: `ignition ${north >= 0 ? '+' : ''}${north} m N, ${east >= 0 ? '+' : ''}${east} m E, wind 20 mph toward ${dirDeg}`,
    config: base, lift: lift / seedsPer, cutOff: cutOff / seedsPer, burnedBridgeHomes: bridgeHomes, wcWorstEtaMin: wcWorst, wcUnserved: wcUnserved / seedsPer,
    aoVuln: ao / seedsPer, lmVuln: lm / seedsPer,
  });
}
console.log(`road graph: ${g.nodes.length} nodes, ${uEdges.length} undirected edges, ${bridges.length} bridges, ${bridgeSides.length} cut off >= 4 nodes`);
const show = (title: string, sorted: Row[]) => {
  console.log(`\n## ${title}`);
  for (const r of sorted.slice(0, 4)) console.log(`${r.label}: lift ${(r.lift * 100).toFixed(1)} pts (vuln ${(r.aoVuln * 100).toFixed(0)}% -> ${(r.lmVuln * 100).toFixed(0)}%), cut-off homes/run ${r.cutOff.toFixed(1)}, burned-bridge side nodes ${r.burnedBridgeHomes}, worst wheelchair ETA ${r.wcWorstEtaMin.toFixed(1)} min, wheelchair homes trapped unserved/run ${r.wcUnserved.toFixed(1)}\n   ${JSON.stringify(r.config)}`);
};
show('most homes cut off by fire (dispatcher "cut off the roads" flags)', [...rows].sort((a, b) => b.cutOff - a.cutOff));
show('a burning bridge road cuts off a neighbourhood', [...rows].sort((a, b) => b.burnedBridgeHomes - a.burnedBridgeHomes || b.cutOff - a.cutOff));
show('wheelchair homes far from any capable vehicle', [...rows].sort((a, b) => b.wcWorstEtaMin - a.wcWorstEtaMin));
show('largest lift', [...rows].sort((a, b) => b.lift - a.lift));
show('smallest lift', [...rows].sort((a, b) => a.lift - b.lift));
