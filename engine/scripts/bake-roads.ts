// OWNER: Lane D. Bakes the real Amherst, MA drivable road graph from OpenStreetMap ONCE, so the engine
// never touches the network at runtime.
//   pnpm exec tsx scripts/bake-roads.ts            # fetch from Overpass, write data/town-amherst.json
//   pnpm exec tsx scripts/bake-roads.ts --save raw.json   # also keep the raw Overpass response
//   pnpm exec tsx scripts/bake-roads.ts --from raw.json   # rebuild from a saved Overpass response
// Data (c) OpenStreetMap contributors, ODbL 1.0. Processing:
//   - drivable highway classes only (no footways, service roads, parking aisles)
//   - one-way handling: oneway=yes|true|1 forward only, oneway=-1 reverse only, roundabouts and
//     motorways one-way by default
//   - speeds from maxspeed (mph or km/h) else a per-class default
//   - each way is split at intersections; intermediate shape points are simplified (Douglas-Peucker,
//     SIMPLIFY_M) but every edge keeps the TRUE polyline length in meters
//   - only the largest strongly connected component is kept, so every node can reach every other
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoadGraph } from '@lastmile/contracts';
import { largestScc } from '../src/routing/scc';

export const CENTER = { lat: 42.3732, lng: -72.5199 }; // downtown Amherst (same as makeGridGraph)
export const HALF_M = 2500; // ~5 km box
const SIMPLIFY_M = 12;
const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'];
const DEFAULT_MPH: Record<string, number> = {
  motorway: 55, trunk: 45, primary: 35, secondary: 30, tertiary: 30, unclassified: 25, residential: 25, living_street: 15,
  motorway_link: 35, trunk_link: 30, primary_link: 25, secondary_link: 25, tertiary_link: 25,
};

const M_PER_DEG = 111_320;
const cosLat = Math.cos((CENTER.lat * Math.PI) / 180);
export const BBOX = {
  s: CENTER.lat - HALF_M / M_PER_DEG, n: CENTER.lat + HALF_M / M_PER_DEG,
  w: CENTER.lng - HALF_M / (M_PER_DEG * cosLat), e: CENTER.lng + HALF_M / (M_PER_DEG * cosLat),
};
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * M_PER_DEG, (a.lng - b.lng) * M_PER_DEG * cosLat);

interface OsmNode { type: 'node'; id: number; lat: number; lon: number }
interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
type OsmElement = OsmNode | OsmWay;

function parseMph(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const m = /^(\d+(?:\.\d+)?)\s*(mph)?/i.exec(raw.trim());
  if (!m) return undefined;
  const v = Number(m[1]);
  return m[2] ? v : v * 0.621371; // bare numbers in OSM are km/h
}

/** Perpendicular-distance simplification over indices [i, j] of pts; marks kept points. */
function douglasPeucker(pts: { lat: number; lng: number }[], i: number, j: number, keep: Uint8Array) {
  if (j <= i + 1) return;
  const a = pts[i]!, b = pts[j]!;
  const ax = a.lng * M_PER_DEG * cosLat, ay = a.lat * M_PER_DEG, bx = b.lng * M_PER_DEG * cosLat, by = b.lat * M_PER_DEG;
  const L = Math.hypot(bx - ax, by - ay) || 1e-9;
  let worst = -1, worstD = 0;
  for (let k = i + 1; k < j; k++) {
    const p = pts[k]!;
    const px = p.lng * M_PER_DEG * cosLat, py = p.lat * M_PER_DEG;
    const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L;
    if (d > worstD) { worstD = d; worst = k; }
  }
  if (worstD > SIMPLIFY_M) { keep[worst] = 1; douglasPeucker(pts, i, worst, keep); douglasPeucker(pts, worst, j, keep); }
}

export function buildGraph(elements: OsmElement[], bbox: typeof BBOX = BBOX): RoadGraph & { stats: Record<string, number> } {
  const nodePos = new Map<number, { lat: number; lng: number }>();
  for (const el of elements) {
    // Overpass returns whole ways that cross the box; clip to it by keeping inside nodes only
    if (el.type === 'node' && el.lat >= bbox.s && el.lat <= bbox.n && el.lon >= bbox.w && el.lon <= bbox.e) nodePos.set(el.id, { lat: el.lat, lng: el.lon });
  }
  // split each drivable way into its runs of consecutive inside-the-box nodes
  const ways: OsmWay[] = [];
  for (const el of elements) {
    if (el.type !== 'way' || !CLASSES.includes(el.tags?.highway ?? '')) continue;
    let run: number[] = [], part = 0;
    const flush = () => { if (run.length >= 2) ways.push({ ...el, id: el.id * 100 + part++, nodes: run }); run = []; };
    for (const id of el.nodes) { if (nodePos.has(id)) run.push(id); else flush(); }
    flush();
  }
  // a node shared by 2+ ways (or a way's end) is a graph vertex
  const uses = new Map<number, number>();
  for (const w of ways) w.nodes.forEach((id, i) => uses.set(id, (uses.get(id) ?? 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)));

  const idx = new Map<number, number>();
  const nodes: { lat: number; lng: number }[] = [];
  const vertex = (osmId: number) => {
    let i = idx.get(osmId);
    if (i === undefined) { i = nodes.length; idx.set(osmId, i); nodes.push(nodePos.get(osmId)!); }
    return i;
  };
  const edges: RoadGraph['edges'] = [];
  let oneWayWays = 0;
  for (const w of ways) {
    const tags = w.tags ?? {};
    const hw = tags.highway!;
    const ow = (tags.oneway ?? '').toLowerCase();
    const forwardOnly = ow === 'yes' || ow === 'true' || ow === '1' || (ow === '' && (tags.junction === 'roundabout' || hw === 'motorway'));
    const reverseOnly = ow === '-1' || ow === 'reverse';
    if (forwardOnly || reverseOnly) oneWayWays++;
    const mph = Math.max(5, Math.min(70, parseMph(tags.maxspeed) ?? DEFAULT_MPH[hw] ?? 25));
    const ids = w.nodes.filter((id) => nodePos.has(id));
    let start = 0;
    for (let k = 1; k < ids.length; k++) {
      if (k !== ids.length - 1 && (uses.get(ids[k]!) ?? 0) < 2) continue;
      // segment ids[start..k] becomes one or more edges between kept points
      const pts = ids.slice(start, k + 1).map((id) => nodePos.get(id)!);
      const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
      douglasPeucker(pts, 0, pts.length - 1, keep);
      let prev = 0;
      for (let q = 1; q < pts.length; q++) {
        if (!keep[q]) continue;
        let len = 0;
        for (let r = prev; r < q; r++) len += meters(pts[r]!, pts[r + 1]!);
        // shape points become vertices too (synthetic negative ids keep them distinct from OSM nodes)
        const a = prev === 0 ? vertex(ids[start]!) : vertex(-(w.id * 10_000 + start + prev));
        const b = q === pts.length - 1 ? vertex(ids[k]!) : vertex(-(w.id * 10_000 + start + q));
        if (prev !== 0) nodes[a] = pts[prev]!;
        if (q !== pts.length - 1) nodes[b] = pts[q]!;
        if (a !== b && len > 0) {
          if (!reverseOnly) edges.push({ from: a, to: b, meters: Math.round(len * 10) / 10, speedMph: Math.round(mph) });
          if (!forwardOnly) edges.push({ from: b, to: a, meters: Math.round(len * 10) / 10, speedMph: Math.round(mph) });
        }
        prev = q;
      }
      start = k;
    }
  }
  // keep the largest strongly connected component and renumber
  const mask = largestScc(nodes.length, edges);
  const remap = new Int32Array(nodes.length).fill(-1);
  const outNodes: RoadGraph['nodes'] = [];
  nodes.forEach((p, i) => { if (mask[i]) { remap[i] = outNodes.length; outNodes.push({ id: outNodes.length, lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 }); } });
  const outEdges = edges.filter((e) => mask[e.from] && mask[e.to]).map((e) => ({ ...e, from: remap[e.from]!, to: remap[e.to]! }));
  return {
    nodes: outNodes,
    edges: outEdges,
    stats: { ways: ways.length, oneWayWays, rawVertices: nodes.length, rawEdges: edges.length, keptNodes: outNodes.length, keptEdges: outEdges.length },
  };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, '../data/town-amherst.json');
  const from = process.argv.indexOf('--from');
  let elements: OsmElement[];
  if (from >= 0) {
    elements = (JSON.parse(readFileSync(process.argv[from + 1]!, 'utf8')) as { elements: OsmElement[] }).elements;
  } else {
    const q = `[out:json][timeout:90];way["highway"~"^(${CLASSES.join('|')})$"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});(._;>;);out body;`;
    // public Overpass instances are often busy (504); try each in turn
    const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
    let got: OsmElement[] | undefined;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'lastmile-bake-roads/1.0' },
          body: `data=${encodeURIComponent(q)}`,
        });
        if (!res.ok) { console.warn(`${url}: HTTP ${res.status}`); continue; }
        got = ((await res.json()) as { elements: OsmElement[] }).elements;
        console.log(`fetched ${got.length} elements from ${url}`);
        break;
      } catch (e) { console.warn(`${url}: ${String(e)}`); }
    }
    if (!got) throw new Error('every Overpass endpoint failed; retry later or pass --from <saved response>');
    elements = got;
    const save = process.argv.indexOf('--save');
    if (save >= 0) { writeFileSync(process.argv[save + 1]!, JSON.stringify({ elements: got })); console.log(`saved raw response to ${process.argv[save + 1]}`); }
  }
  const g = buildGraph(elements);
  const { stats, ...graph } = g;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    source: 'OpenStreetMap via Overpass API',
    license: 'Data (c) OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    bakedAt: new Date().toISOString().slice(0, 10),
    bbox: BBOX,
    stats,
    ...graph,
  }));
  console.log(`wrote ${outPath}: ${JSON.stringify(stats)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
