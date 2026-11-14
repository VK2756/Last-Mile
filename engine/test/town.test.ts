import { describe, expect, it } from 'vitest';
import type { RoadGraph } from '@lastmile/contracts';
import { loadTown, makeGridGraph, parseBakedGraph } from '../src/world/town';
import { largestScc } from '../src/routing/scc';
import { buildGraph } from '../scripts/bake-roads';

describe('loadTown', () => {
  it('amherst loads the baked OSM graph from disk: real size, strongly connected, has one-way roads', () => {
    const g = loadTown('amherst');
    expect(g.nodes.length).toBeGreaterThan(500);
    expect(g.edges.length).toBeGreaterThan(g.nodes.length);
    const mask = largestScc(g.nodes.length, g.edges);
    expect([...mask].every((m) => m === 1)).toBe(true);
    const pairs = new Set(g.edges.map((e) => `${e.from}>${e.to}`));
    expect(g.edges.some((e) => !pairs.has(`${e.to}>${e.from}`))).toBe(true); // one-way edges exist
    for (const n of g.nodes) { expect(Math.abs(n.lat - 42.3732)).toBeLessThan(0.03); expect(Math.abs(n.lng + 72.5199)).toBeLessThan(0.04); }
    expect(loadTown('amherst')).toBe(g); // cached, read once
  });

  it('other towns use the synthetic grid', () => {
    expect(loadTown('synthetic_grid').nodes.length).toBe(makeGridGraph().nodes.length);
    expect(loadTown('paradise_like').nodes.length).toBe(makeGridGraph().nodes.length);
  });

  it('rejects malformed baked files', () => {
    expect(() => parseBakedGraph('{}')).toThrow();
    expect(() => parseBakedGraph(JSON.stringify({ nodes: [{ id: 0, lat: 1, lng: 2 }], edges: [{ from: 0, to: 9, meters: 1, speedMph: 25 }] }))).toThrow(/unknown node/);
    expect(parseBakedGraph(JSON.stringify({ nodes: [{ id: 0, lat: 1, lng: 2 }, { id: 1, lat: 1, lng: 2.001 }], edges: [{ from: 0, to: 1, meters: 80, speedMph: 25 }] })).edges).toHaveLength(1);
  });
});

describe('bake-roads buildGraph', () => {
  // tiny hand-made OSM extract: a two-way street A-B-C, a one-way street C->D, a reverse one-way D<-E
  // (oneway=-1 drawn E->D... i.e. traffic flows D->E), a road with maxspeed, and an unreachable spur.
  const n = (id: number, lat: number, lon: number) => ({ type: 'node' as const, id, lat, lon });
  const w = (id: number, nodes: number[], tags: Record<string, string>) => ({ type: 'way' as const, id, nodes, tags });
  const els = [
    n(1, 42.370, -72.520), n(2, 42.370, -72.519), n(3, 42.370, -72.518), n(4, 42.371, -72.518), n(5, 42.371, -72.519),
    n(6, 42.380, -72.530), n(7, 42.381, -72.530),
    w(10, [1, 2, 3], { highway: 'residential' }),
    w(11, [3, 4], { highway: 'tertiary', oneway: 'yes', maxspeed: '35 mph' }),
    w(12, [5, 4], { highway: 'residential', oneway: '-1' }), // traffic 4 -> 5
    w(13, [5, 1], { highway: 'residential' }),
    w(14, [6, 7], { highway: 'residential', oneway: 'yes' }), // island one-way spur: dropped
    w(15, [1, 6], { highway: 'footway' }), // not drivable: ignored
  ];
  const g: RoadGraph = buildGraph(els);
  const key = (e: RoadGraph['edges'][number]) => {
    const a = g.nodes[e.from]!, b = g.nodes[e.to]!;
    return `${a.lat},${a.lng}>${b.lat},${b.lng}`;
  };
  const keys = new Set(g.edges.map(key));

  it('keeps one-way directions and drops what is not strongly connected or not drivable', () => {
    expect(keys.has('42.37,-72.518>42.371,-72.518')).toBe(true); // 3 -> 4 (oneway=yes)
    expect(keys.has('42.371,-72.518>42.37,-72.518')).toBe(false);
    expect(keys.has('42.371,-72.518>42.371,-72.519')).toBe(true); // 4 -> 5 (oneway=-1 on 5,4)
    expect(keys.has('42.371,-72.519>42.371,-72.518')).toBe(false);
    expect(g.nodes.some((p) => p.lat >= 42.38)).toBe(false); // island removed
    expect(largestScc(g.nodes.length, g.edges).every((m) => m === 1)).toBe(true);
  });

  it('splits at intersections, keeps true lengths and parses maxspeed', () => {
    const e34 = g.edges.find((e) => key(e) === '42.37,-72.518>42.371,-72.518')!;
    expect(e34.speedMph).toBe(35);
    expect(e34.meters).toBeGreaterThan(105); // ~111 m of latitude
    expect(e34.meters).toBeLessThan(117);
    // node 2 is only on one way (not an intersection) and the street is straight: simplified away
    expect(g.nodes.some((p) => p.lat === 42.37 && p.lng === -72.519)).toBe(false);
    const e13 = g.edges.find((e) => key(e) === '42.37,-72.52>42.37,-72.518')!;
    expect(e13.meters).toBeGreaterThan(160); // the full 1 -> 3 length (~164 m), not a shortcut
  });
});
