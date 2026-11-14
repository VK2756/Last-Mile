import { describe, expect, it } from 'vitest';
import type { FireModel, LatLng, RoadGraph } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { createRouter, routingAssumptions } from '../src/routing/index';
import { makeGridGraph } from '../src/world/town';
import { createFireModel } from '../src/sim/fire';

const MPS_25 = 25 * 0.44704;
const node = (g: RoadGraph, id: number): LatLng => { const n = g.nodes.find((x) => x.id === id)!; return { lat: n.lat, lng: n.lng }; };

/** A fire whose ignition time depends only on longitude: the band [lngLo, lngHi] ignites at `at` unless the point is in the gap. */
function wallFire(lngLo: number, lngHi: number, at: number, gap?: { latLo: number; latHi: number }): FireModel {
  const ign = (p: LatLng) => {
    if (p.lng < lngLo || p.lng > lngHi) return Infinity;
    if (gap && p.lat >= gap.latLo && p.lat <= gap.latHi) return Infinity;
    return at;
  };
  return {
    ignitionTime: ign,
    isBurning: (p, t) => ign(p) <= t,
    rings: () => [],
    burnedFraction: () => 0,
  };
}

/** Grid of n x n; returns the lng midway between column c and c+1, and the lat of row r. */
function gridGeom(g: RoadGraph, n: number) {
  const col = (c: number) => g.nodes[c]!.lng;
  const row = (r: number) => g.nodes[r * n]!.lat;
  return { col, row };
}

describe('createRouter on the synthetic grid', () => {
  const n = 10;
  const g = makeGridGraph(n, 150);
  const { col, row } = gridGeom(g, n);
  const W = 20 / (111_320 * Math.cos((42.3732 * Math.PI) / 180)); // 20 m of longitude
  const lngLo = (col(4) + col(5)) / 2 - W, lngHi = (col(4) + col(5)) / 2 + W; // wall cutting every edge between columns 4 and 5

  it('works with no arguments (loadTown fallback)', () => {
    const r = createRouter();
    const a = { lat: 42.3732, lng: -72.5199 };
    expect(r.travelSeconds(a, a, 0)).toBe(0);
  });

  it('open grid: corner to corner is the Manhattan distance at 25 mph', () => {
    const r = createRouter(g);
    const a = node(g, 0), b = node(g, n * n - 1);
    expect(r.travelSeconds(a, b, 0)).toBeCloseTo((2 * (n - 1) * 150) / MPS_25, 6);
    const path = r.route(a, b, 0);
    expect(path[0]).toEqual(a);
    expect(path[path.length - 1]).toEqual(b);
    expect(path.length).toBe(2 * (n - 1) + 1 + 2); // nodes + both endpoints
  });

  it('adds straight access legs for off-road points', () => {
    const r = createRouter(g, undefined, { accessSpeedMph: 10 });
    const a0 = node(g, 0), b0 = node(g, 5);
    const a = { lat: a0.lat + 30 / 111_320, lng: a0.lng };
    const base = r.travelSeconds(a0, b0, 0);
    expect(r.travelSeconds(a, b0, 0)).toBeCloseTo(base + 30 / (10 * 0.44704), 3);
  });

  it('routes through the gap in a fire wall and never along a closed road', () => {
    const gap = { latLo: row(8) - 20 / 111_320, latHi: row(8) + 20 / 111_320 };
    const fire = wallFire(lngLo, lngHi, 0, gap);
    const r = createRouter(g, fire);
    const a = node(g, 0), b = node(g, 9);
    const t = r.travelSeconds(a, b, 100);
    // must detour up to row 8 and back: 9 across + 8 up + 8 down
    expect(t).toBeCloseTo(((9 + 16) * 150) / MPS_25, 6);
    const path = r.route(a, b, 100);
    for (let i = 1; i < path.length; i++) {
      const p = path[i - 1]!, q = path[i]!;
      for (const f of [0.25, 0.5, 0.75]) {
        expect(fire.isBurning({ lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f }, 100)).toBe(false);
      }
    }
  });

  it('a complete fire wall makes the other side unreachable', () => {
    const r = createRouter(g, wallFire(lngLo, lngHi, 0));
    const a = node(g, 0), b = node(g, 9);
    expect(r.travelSeconds(a, b, 10)).toBe(Infinity);
    expect(r.route(a, b, 10)).toEqual([]);
    expect(r.travelSeconds(a, node(g, 4), 10)).toBeLessThan(Infinity); // same side still fine
  });

  it('closes roads closureLookaheadSeconds before the fire arrives, and not earlier', () => {
    const fire = wallFire(lngLo, lngHi, 1000);
    const r = createRouter(g, fire, { closureLookaheadSeconds: 60, smokeBands: [{ withinSeconds: 1, speedFactor: 1 }] });
    const a = node(g, 0), b = node(g, 9);
    expect(r.travelSeconds(a, b, 0)).toBeCloseTo((9 * 150) / MPS_25, 6);
    expect(r.travelSeconds(a, b, 939)).toBeCloseTo((9 * 150) / MPS_25, 6);
    expect(r.travelSeconds(a, b, 941)).toBe(Infinity);
  });

  it('smoke slows roads the fire will reach soon', () => {
    const fire = wallFire(lngLo, lngHi, 1000);
    const r = createRouter(g, fire, { smokeBands: [{ withinSeconds: 900, speedFactor: 0.75 }, { withinSeconds: 300, speedFactor: 0.5 }] });
    const a = node(g, 0), b = node(g, 9);
    const edge = 150 / MPS_25;
    expect(r.travelSeconds(a, b, 0)).toBeCloseTo(9 * edge, 6); // 1000s away: no smoke
    expect(r.travelSeconds(a, b, 200)).toBeCloseTo(8 * edge + edge / 0.75, 6); // 800s away
    expect(r.travelSeconds(a, b, 800)).toBeCloseTo(8 * edge + edge / 0.5, 6); // 200s away
  });

  it('travel to or from a burning point is impossible', () => {
    const p = node(g, 22);
    const fire = wallFire(p.lng - W, p.lng + W, 500);
    const r = createRouter(g, fire);
    expect(r.travelSeconds(node(g, 0), p, 10)).toBeLessThan(Infinity);
    expect(r.travelSeconds(node(g, 0), p, 600)).toBe(Infinity);
    expect(r.travelSeconds(p, node(g, 0), 600)).toBe(Infinity);
  });

  it('caches trees across ticks and only rebuilds when an edge changes state', () => {
    const r = createRouter(g, wallFire(lngLo, lngHi, 5000), { smokeBands: [{ withinSeconds: 900, speedFactor: 0.5 }] });
    const a = node(g, 0), b = node(g, 9), c = node(g, 99);
    r.travelSeconds(a, b, 0);
    r.travelSeconds(a, c, 0);
    const s0 = r.stats();
    for (let t = 1; t < 3000; t += 7) { r.travelSeconds(a, b, t); r.travelSeconds(a, c, t); }
    const s1 = r.stats();
    expect(s1.version).toBe(s0.version);
    expect(s1.treeBuilds).toBe(s0.treeBuilds);
    expect(s1.treeHits).toBeGreaterThan(s0.treeHits);
    r.travelSeconds(a, b, 4200); // crosses the 900s smoke threshold
    const s2 = r.stats();
    expect(s2.version).toBe(s1.version + 1);
    expect(s2.smokyEdges).toBeGreaterThan(0);
    expect(s2.treeBuilds).toBe(s1.treeBuilds + 1);
  });

  it('fan-in queries (many homes to one safe zone) build a single reverse tree', () => {
    const r = createRouter(g);
    const zone = node(g, 55);
    for (let i = 0; i < n * n; i += 3) r.travelSeconds(node(g, i), zone, 0);
    expect(r.stats().treeBuilds).toBeLessThanOrEqual(2);
  });

  it('describes its assumptions in plain English', () => {
    const lines = routingAssumptions();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join(' ')).toMatch(/smoke/i);
  });
});

describe('createRouter matches brute force on random directed graphs', () => {
  // tiny deterministic PRNG so the test is reproducible
  const mulberry32 = (seed: number) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it('agrees with Bellman-Ford for forward and reverse trees', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const rnd = mulberry32(seed);
      const N = 40;
      const nodes = Array.from({ length: N }, (_, i) => ({ id: 1000 + i, lat: 42.36 + rnd() * 0.02, lng: -72.53 + rnd() * 0.02 }));
      const edges: RoadGraph['edges'] = [];
      for (let k = 0; k < 120; k++) {
        const f = Math.floor(rnd() * N), t = Math.floor(rnd() * N);
        if (f !== t) edges.push({ from: 1000 + f, to: 1000 + t, meters: 50 + rnd() * 400, speedMph: 15 + rnd() * 30 });
      }
      const g: RoadGraph = { nodes, edges };
      // Bellman-Ford all pairs
      const w = edges.map((e) => e.meters / (e.speedMph * 0.44704));
      const bf = (s: number) => {
        const d = new Array<number>(N).fill(Infinity); d[s] = 0;
        for (let it = 0; it < N; it++) edges.forEach((e, i) => {
          const u = e.from - 1000, v = e.to - 1000;
          if (d[u]! + w[i]! < d[v]!) d[v] = d[u]! + w[i]!;
        });
        return d;
      };
      const r = createRouter(g, undefined, { accessSpeedMph: 1 });
      const pos = (i: number) => ({ lat: nodes[i]!.lat, lng: nodes[i]!.lng });
      for (let s = 0; s < N; s += 3) {
        const d = bf(s);
        for (let t = 0; t < N; t++) {
          if (t === s) continue;
          expect(r.travelSeconds(pos(s), pos(t), 0)).toBeCloseTo(d[t]!, 6);
        }
      }
      // fan-in to one target forces reverse trees; check those too
      const r2 = createRouter(g, undefined, { accessSpeedMph: 1 });
      const target = 7;
      for (let s = 0; s < N; s++) {
        if (s === target) continue;
        const d = bf(s);
        expect(r2.travelSeconds(pos(s), pos(target), 0)).toBeCloseTo(d[target]!, 6);
        const path = r2.route(pos(s), pos(target), 0);
        if (d[target] === Infinity) expect(path).toEqual([]);
        else { expect(path[0]).toEqual(pos(s)); expect(path[path.length - 1]).toEqual(pos(target)); }
      }
    }
  });
});

describe('createRouter with the real fire model (Lane A sim/fire)', () => {
  it('never routes through ground that is burning, and closes more roads as the fire grows', () => {
    const g = makeGridGraph(20, 150);
    const fire = createFireModel(sampleInit.config);
    const r = createRouter(g, fire);
    const pts = g.nodes.filter((_, i) => i % 23 === 0).map((n) => ({ lat: n.lat, lng: n.lng }));
    let closedBefore = -1;
    for (const t of [0, 900, 1800, 3600]) {
      for (const a of pts) for (const b of pts) {
        if (a === b) continue;
        const path = r.route(a, b, t);
        if (path.length === 0) continue;
        expect(r.travelSeconds(a, b, t)).toBeLessThan(Infinity);
        for (let i = 2; i < path.length - 1; i++) { // road nodes only (endpoints are checked separately)
          const p = path[i - 1]!, q = path[i]!;
          for (const f of [0, 0.5, 1]) expect(fire.isBurning({ lat: p.lat + (q.lat - p.lat) * f, lng: p.lng + (q.lng - p.lng) * f }, t)).toBe(false);
        }
      }
      const { closedEdges } = r.stats();
      expect(closedEdges).toBeGreaterThanOrEqual(closedBefore);
      closedBefore = closedEdges;
    }
    expect(closedBefore).toBeGreaterThan(0);
  });
});
