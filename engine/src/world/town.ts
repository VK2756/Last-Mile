// OWNER: Lane D (Rishabh). Road graphs for the simulator.
// - 'amherst': the real Amherst, MA drivable road network baked from OpenStreetMap by
//   engine/scripts/bake-roads.ts into engine/data/town-amherst.json (read from disk; no runtime network).
//   Data (c) OpenStreetMap contributors, ODbL 1.0.
// - 'synthetic_grid' and 'paradise_like' (no baked data yet): the synthetic grid below.
// If the baked file is missing or malformed, 'amherst' falls back to the grid with a warning.
import { readFileSync } from 'node:fs';
import type { RoadGraph, ScenarioConfig } from '@lastmile/contracts';

/** Synthetic n x n grid of roads, ~spacing meters apart, centered near Amherst, MA. Never needs the network. */
export function makeGridGraph(n = 20, spacingMeters = 150, center = { lat: 42.3732, lng: -72.5199 }): RoadGraph {
  const dLat = spacingMeters / 111_320;
  const dLng = spacingMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const nodes: RoadGraph['nodes'] = [];
  const edges: RoadGraph['edges'] = [];
  const id = (r: number, c: number) => r * n + c;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    nodes.push({ id: id(r, c), lat: center.lat + (r - n / 2) * dLat, lng: center.lng + (c - n / 2) * dLng });
  const add = (a: number, b: number) => { edges.push({ from: a, to: b, meters: spacingMeters, speedMph: 25 }, { from: b, to: a, meters: spacingMeters, speedMph: 25 }); };
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c + 1 < n) add(id(r, c), id(r, c + 1));
    if (r + 1 < n) add(id(r, c), id(r + 1, c));
  }
  return { nodes, edges };
}

const AMHERST_URL = new URL('../../data/town-amherst.json', import.meta.url);

/** Parse and sanity-check a baked graph file; throws with a clear message if anything is off. */
export function parseBakedGraph(text: string): RoadGraph {
  const raw = JSON.parse(text) as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || raw.nodes.length === 0) throw new Error('baked graph has no nodes/edges');
  const ids = new Set<number>();
  const nodes: RoadGraph['nodes'] = raw.nodes.map((n: unknown, i: number) => {
    const { id, lat, lng } = n as Record<string, unknown>;
    if (typeof id !== 'number' || typeof lat !== 'number' || typeof lng !== 'number') throw new Error(`baked node ${i} is malformed`);
    ids.add(id);
    return { id, lat, lng };
  });
  const edges: RoadGraph['edges'] = raw.edges.map((e: unknown, i: number) => {
    const { from, to, meters, speedMph } = e as Record<string, unknown>;
    if (typeof from !== 'number' || typeof to !== 'number' || !ids.has(from) || !ids.has(to)) throw new Error(`baked edge ${i} references an unknown node`);
    if (typeof meters !== 'number' || typeof speedMph !== 'number' || !(meters > 0) || !(speedMph > 0)) throw new Error(`baked edge ${i} has bad meters/speedMph`);
    return { from, to, meters, speedMph };
  });
  return { nodes, edges };
}

let amherst: RoadGraph | undefined;
function loadAmherst(): RoadGraph {
  if (!amherst) {
    try {
      amherst = parseBakedGraph(readFileSync(AMHERST_URL, 'utf8'));
    } catch (e) {
      console.warn(`[town] could not load ${AMHERST_URL.pathname} (${String(e)}); using the synthetic grid`);
      amherst = makeGridGraph();
    }
  }
  return amherst;
}

/** The road graph for a scenario's town. Graphs are shared and must be treated as read-only. */
export function loadTown(town: ScenarioConfig['town'] = 'amherst'): RoadGraph {
  return town === 'amherst' ? loadAmherst() : makeGridGraph();
}
