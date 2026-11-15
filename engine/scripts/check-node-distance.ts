// OWNER: Lane D. For every household and helper start in the real-Amherst presets, the distance to the
// nearest road NODE of the baked graph (the point the router snaps to), and to the nearest road segment for
// context. Lists every point over the limit. Presets: the three in sim/presets.ts plus the Monte Carlo preset
// (seed 1). Usage (from engine/): pnpm exec tsx scripts/check-node-distance.ts [limitMetres=50]
import { ScenarioConfig } from '@lastmile/contracts';
import type { LatLng } from '@lastmile/contracts';
import { createSim } from '../src/sim/engine';
import { PRESETS } from '../src/sim/presets';
import { PRESET_BASE } from '../src/montecarlo/index';
import { loadTown } from '../src/world/town';
import { largestScc } from '../src/routing/scc';

const limit = Number(process.argv[2] ?? 50);
const g = loadTown('amherst');
const scc = largestScc(g.nodes.length, g.edges);
const M = 111_320, cos = Math.cos((42.3732 * Math.PI) / 180);
const xy = (p: LatLng) => [p.lng * M * cos, p.lat * M] as const;
const nodes = g.nodes.map((n, i) => ({ i, p: xy(n), inScc: scc[i] === 1 }));
const segs = g.edges.map((e) => [xy(g.nodes[e.from]!), xy(g.nodes[e.to]!)] as const);

function nearestNode(p: LatLng, sccOnly: boolean) {
  const [px, py] = xy(p);
  let best = Infinity, id = -1;
  for (const n of nodes) { if (sccOnly && !n.inScc) continue; const d = Math.hypot(px - n.p[0], py - n.p[1]); if (d < best) { best = d; id = n.i; } }
  return { d: best, id };
}
function nearestRoad(p: LatLng) {
  const [px, py] = xy(p);
  let best = Infinity;
  for (const [[ax, ay], [bx, by]] of segs) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

const presets = [
  ...PRESETS.map((p) => ({ id: p.id, config: ScenarioConfig.parse(p.config) })),
  { id: 'montecarlo-preset (seed 1)', config: ScenarioConfig.parse({ ...PRESET_BASE, seed: 1, policy: 'last_mile' }) },
];
const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]!; };
let outliers = 0;
console.log(`graph: ${g.nodes.length} nodes (${scc.reduce((a, b) => a + b, 0)} in the largest strongly connected component, which routing snaps to)\n`);
for (const { id, config } of presets) {
  const sim = createSim(config, `nodes-${id}`);
  const pts = [
    ...sim.init.households.map((h) => ({ kind: 'household', id: h.id, p: h.position })),
    ...sim.init.helpers.map((h) => ({ kind: `helper (${h.kind})`, id: h.id, p: h.position })),
  ];
  const rows = pts.map((x) => ({ ...x, node: nearestNode(x.p, true), anyNode: nearestNode(x.p, false).d, road: nearestRoad(x.p) }));
  const hd = rows.filter((r) => r.kind === 'household').map((r) => r.node.d);
  const pd = rows.filter((r) => r.kind !== 'household').map((r) => r.node.d);
  const bad = rows.filter((r) => r.node.d > limit);
  outliers += bad.length;
  console.log(`## ${id}: ${hd.length} households, ${pd.length} helper starts`);
  console.log(`households -> nearest routable node: median ${q(hd, 0.5).toFixed(0)} m, p95 ${q(hd, 0.95).toFixed(0)} m, max ${Math.max(...hd).toFixed(0)} m; helpers: max ${pd.length ? Math.max(...pd).toFixed(1) : '-'} m`);
  console.log(`over ${limit} m: ${bad.length}`);
  for (const r of bad.sort((a, b) => b.node.d - a.node.d)) console.log(`  ${r.kind} ${r.id} at ${r.p.lat.toFixed(5)},${r.p.lng.toFixed(5)}: ${r.node.d.toFixed(0)} m to routable node ${r.node.id} (${r.anyNode.toFixed(0)} m to any node, ${r.road.toFixed(0)} m to the road line)`);
  console.log('');
}
console.log(`total over ${limit} m: ${outliers}`);
