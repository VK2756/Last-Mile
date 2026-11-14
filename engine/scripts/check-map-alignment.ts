// OWNER: Lane D. Checks that what the engine streams lines up with the baked Amherst roads the map draws
// over: households on roads, everything inside the baked box, fire rings in [lng, lat] order around the
// ignition. Usage (from engine/): pnpm exec tsx scripts/check-map-alignment.ts [seeds=5]
import { ScenarioConfig, SimInit, SimFrame } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { readFileSync } from 'node:fs';
import { createSim } from '../src/sim/engine';
import { loadTown } from '../src/world/town';

const seeds = Number(process.argv[2] ?? 5);
const g = loadTown('amherst');
const baked = JSON.parse(readFileSync(new URL('../data/town-amherst.json', import.meta.url), 'utf8')) as { bbox: { s: number; n: number; w: number; e: number } };
const M = 111_320, cos = Math.cos((42.3732 * Math.PI) / 180);
const xy = (p: { lat: number; lng: number }) => [p.lng * M * cos, p.lat * M] as const;
const segs = g.edges.map((e) => [xy(g.nodes[e.from]!), xy(g.nodes[e.to]!)] as const);
const distToRoad = (p: { lat: number; lng: number }) => {
  const [px, py] = xy(p);
  let best = Infinity;
  for (const [[ax, ay], [bx, by]] of segs) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
};
const inBox = (p: { lat: number; lng: number }) => p.lat >= baked.bbox.s && p.lat <= baked.bbox.n && p.lng >= baked.bbox.w && p.lng <= baked.bbox.e;
const q = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]!; };

for (let seed = 1; seed <= seeds; seed++) {
  const config = ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24, seed, policy: 'last_mile' });
  const sim = createSim(config, `align-${seed}`);
  const init = SimInit.parse(sim.init);
  for (let k = 0; k < 20 && !sim.done; k++) sim.advance(120); // 40 min in
  const frame = SimFrame.parse(sim.frame());
  const d = init.households.map((h) => distToRoad(h.position));
  const hd = init.helpers.map((h) => distToRoad(h.position));
  const zd = init.safeZones.map((z) => distToRoad(z.position));
  const outside = [...init.households.map((h) => h.position), ...init.helpers.map((h) => h.position), ...init.safeZones.map((z) => z.position)].filter((p) => !inBox(p)).length;
  const ring = frame.fire.rings[0] ?? [];
  const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const lngLatOrder = ring.every(([a, b]) => a < -70 && a > -75 && b > 40 && b < 45);
  const contains = ring.length > 0 && Math.min(...lngs) <= config.ignition.lng && Math.max(...lngs) >= config.ignition.lng && Math.min(...lats) <= config.ignition.lat && Math.max(...lats) >= config.ignition.lat;
  const routeOff = frame.assignments.flatMap((a) => a.route.slice(1, -1)).map(distToRoad);
  console.log(`seed ${seed}: homes to nearest road median ${q(d, 0.5).toFixed(1)} m, p95 ${q(d, 0.95).toFixed(1)} m, max ${Math.max(...d).toFixed(1)} m; helpers max ${Math.max(...hd).toFixed(1)} m; safe zones max ${Math.max(...zd).toFixed(1)} m; outside baked box ${outside}; ` +
    `fire ring ${ring.length} pts, [lng,lat] order ${lngLatOrder}, encloses ignition ${contains}; route vertices off-road max ${routeOff.length ? Math.max(...routeOff).toFixed(2) : 'n/a'} m (${routeOff.length})`);
}
console.log(`baked box ${JSON.stringify(baked.bbox)}; init.bounds seed 1 ${JSON.stringify(createSim(ScenarioConfig.parse({ ...sampleInit.config, seed: 1, policy: 'last_mile' }), 'b').init.bounds)}`);
