// OWNER: Lane D (Rishabh). STUB: replace with the baked Amherst OSM road graph (keep makeGridGraph as fallback).
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

// STUB: loadTown returns the synthetic grid for every town until the baked OSM graph lands (Lane D item 13).
export function loadTown(_town?: ScenarioConfig['town']): RoadGraph { return makeGridGraph(); }
