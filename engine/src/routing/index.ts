// OWNER: Lane D (routing). Dijkstra on the road graph with fire-closed roads and smoke slowdown.
//
// Model (also exported as plain-English `routingAssumptions()` for SimInit.assumptions):
// - Points snap to the nearest road node; the leg between a point and its node is a straight line at
//   `accessSpeedMph` (driveways, parking lots, short walks to the curb). Two points that snap to the
//   same node are joined by that straight leg directly.
// - Each road edge gets a "burn time": the earliest FireModel.ignitionTime sampled along it (endpoints
//   plus interior points at most `sampleSpacingMeters` apart). An edge is CLOSED at time t when
//   burnTime <= t + closureLookaheadSeconds, and stays closed (burned-over roads are not reopened).
// - Edges the fire will reach soon are SLOWED by smoke: the tightest band in `smokeBands` whose
//   `withinSeconds` covers (burnTime - t) multiplies the edge's speed by its `speedFactor`.
// - Travel to or from a point that is burning at time t is impossible (Infinity, empty route).
//
// Caching: per-edge state is quantized (open / smoke band / closed), so edge weights only change when
// some edge crosses a band threshold. Each change bumps `version` and drops only the cached trees that
// use a changed edge (exact while time moves forward). Shortest-path trees are cached per
// (root node, direction) and reused across ticks until the version changes. A query a -> b is answered
// from a forward tree rooted at a OR a reverse tree rooted at b, whichever exists; on a miss we build
// the side that has been queried more often (helpers fan out to many households, many households fan
// in to a few safe zones), so a dispatcher plan costs roughly #helpers + #safeZones tree builds.
import type { FireModel, LatLng, RoadGraph, Router } from '@lastmile/contracts';
import { loadTown } from '../world/town';
import { MinHeap } from './heap';

const MPH_TO_MPS = 0.44704;
const M_PER_DEG_LAT = 111_320;

export interface SmokeBand {
  /** applies when the fire reaches the edge within this many seconds */
  withinSeconds: number;
  /** speed multiplier in (0, 1] */
  speedFactor: number;
}

export interface RouterOptions {
  /** Roads are closed this long before the fire actually reaches them (safety buffer). Default 60. */
  closureLookaheadSeconds?: number;
  /** Smoke slowdown bands. Default: within 15 min -> 75% speed, within 5 min -> 50% speed. */
  smokeBands?: SmokeBand[];
  /** Speed for the off-road leg between a point and its nearest road node. Default 15 mph. */
  accessSpeedMph?: number;
  /** Max spacing of fire samples along an edge. Default 25 m. */
  sampleSpacingMeters?: number;
  /** Memory cap: the tree cache is cleared when it holds this many trees. Default 512. */
  maxCachedTrees?: number;
  /**
   * Road states are refreshed once per window of this many seconds, using the fire at the END of the
   * window (conservative: a road may close up to one window early, never late). 0 = exact at every t.
   * Default 30.
   */
  stateRefreshSeconds?: number;
}

export interface RouterStats {
  /** bumps every time any edge changes state (open / smoke band / closed) */
  version: number;
  treeBuilds: number;
  treeHits: number;
  closedEdges: number;
  smokyEdges: number;
}

export interface GraphRouter extends Router {
  stats(): RouterStats;
  /** Bring edge states up to time t without running a query (queries do this themselves). */
  sync(t: number): void;
}

const DEFAULT_SMOKE: SmokeBand[] = [
  { withinSeconds: 900, speedFactor: 0.75 },
  { withinSeconds: 300, speedFactor: 0.5 },
];

interface Resolved {
  closureLookaheadSeconds: number;
  smokeBands: SmokeBand[];
  accessSpeedMph: number;
  sampleSpacingMeters: number;
  maxCachedTrees: number;
  stateRefreshSeconds: number;
}

function resolve(opts: RouterOptions): Resolved {
  // widest band first; a tighter band later in the list overrides it
  const smokeBands = [...(opts.smokeBands ?? DEFAULT_SMOKE)].sort((x, y) => y.withinSeconds - x.withinSeconds);
  for (const b of smokeBands) {
    if (!(b.speedFactor > 0 && b.speedFactor <= 1)) throw new Error(`smoke speedFactor must be in (0,1], got ${b.speedFactor}`);
    if (!(b.withinSeconds > 0)) throw new Error(`smoke withinSeconds must be > 0, got ${b.withinSeconds}`);
  }
  return {
    closureLookaheadSeconds: opts.closureLookaheadSeconds ?? 60,
    smokeBands,
    accessSpeedMph: opts.accessSpeedMph ?? 15,
    sampleSpacingMeters: opts.sampleSpacingMeters ?? 25,
    maxCachedTrees: opts.maxCachedTrees ?? 512,
    stateRefreshSeconds: opts.stateRefreshSeconds ?? 30,
  };
}

/** Plain-English description of the routing model, for SimInit.assumptions. */
export function routingAssumptions(opts: RouterOptions = {}): string[] {
  const o = resolve(opts);
  const bands = o.smokeBands
    .map((b) => `${Math.round(b.speedFactor * 100)}% speed when the fire is within ${Math.round(b.withinSeconds / 60)} min`)
    .join(', ');
  return [
    `Routing: fastest path on the road graph; a road closes ${o.closureLookaheadSeconds}s before the fire reaches any point on it and never reopens.`,
    `Routing: smoke slows roads near the fire front (${bands}).`,
    `Routing: the leg between a home or helper and its nearest road node is a straight line at ${o.accessSpeedMph} mph.`,
    ...(o.stateRefreshSeconds > 0 ? [`Routing: road closures and smoke are refreshed every ${o.stateRefreshSeconds} s using where the fire will be at the end of that window (roads may close slightly early, never late).`] : []),
  ];
}

interface Tree {
  /** seconds from the root (forward) or to the root (reverse); Infinity if unreachable */
  dist: Float64Array;
  /** forward: edge used to ENTER node i; reverse: edge used to LEAVE node i toward the root; -1 = none */
  via: Int32Array;
}

/**
 * Build a router for one scenario. Every argument is optional so `createRouter()` keeps working:
 * no graph -> `loadTown()`, no fire -> nothing ever closes or slows.
 */
export function createRouter(graph: RoadGraph = loadTown(), fire?: FireModel, options: RouterOptions = {}): GraphRouter {
  const o = resolve(options);
  const N = graph.nodes.length;
  const E = graph.edges.length;
  if (N === 0) throw new Error('createRouter: road graph has no nodes');

  // ---- geometry (local equirectangular projection; fine at town scale) ----
  let latSum = 0;
  for (const n of graph.nodes) latSum += n.lat;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(((latSum / N) * Math.PI) / 180);
  const xs = new Float64Array(N), ys = new Float64Array(N);
  const idToIdx = new Map<number, number>();
  graph.nodes.forEach((n, i) => {
    xs[i] = n.lng * mPerDegLng;
    ys[i] = n.lat * M_PER_DEG_LAT;
    idToIdx.set(n.id, i);
  });
  const px = (p: LatLng) => p.lng * mPerDegLng;
  const py = (p: LatLng) => p.lat * M_PER_DEG_LAT;
  const accessMps = o.accessSpeedMph * MPH_TO_MPS;

  // ---- edges, with CSR adjacency in both directions ----
  const eFrom = new Int32Array(E), eTo = new Int32Array(E);
  const baseSeconds = new Float64Array(E);
  graph.edges.forEach((e, i) => {
    const f = idToIdx.get(e.from), t = idToIdx.get(e.to);
    if (f === undefined || t === undefined) throw new Error(`createRouter: edge ${i} references an unknown node`);
    if (!(e.speedMph > 0) || !(e.meters >= 0)) throw new Error(`createRouter: edge ${i} has bad meters/speedMph`);
    eFrom[i] = f; eTo[i] = t;
    baseSeconds[i] = e.meters / (e.speedMph * MPH_TO_MPS);
  });
  const csr = (key: Int32Array) => {
    const off = new Int32Array(N + 1);
    for (let i = 0; i < E; i++) off[key[i]! + 1]!++;
    for (let i = 0; i < N; i++) off[i + 1]! += off[i]!;
    const fill = off.slice(0, N);
    const list = new Int32Array(E);
    for (let i = 0; i < E; i++) list[fill[key[i]!]!++] = i;
    return { off, list };
  };
  const out = csr(eFrom);
  const inc = csr(eTo);

  // ---- per-edge fire exposure (FireModel.ignitionTime is static, so this is computed once) ----
  const burnTime = new Float64Array(E).fill(Infinity);
  if (fire) {
    const nodeIgn = new Float64Array(N);
    graph.nodes.forEach((n, i) => { nodeIgn[i] = fire.ignitionTime({ lat: n.lat, lng: n.lng }); });
    for (let i = 0; i < E; i++) {
      const fi = eFrom[i]!, ti = eTo[i]!;
      const a = graph.nodes[fi]!, b = graph.nodes[ti]!;
      let bt = Math.min(nodeIgn[fi]!, nodeIgn[ti]!);
      const len = Math.hypot(xs[ti]! - xs[fi]!, ys[ti]! - ys[fi]!);
      const segs = Math.max(2, Math.ceil(len / o.sampleSpacingMeters));
      for (let k = 1; k < segs; k++) {
        const f = k / segs;
        bt = Math.min(bt, fire.ignitionTime({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }));
      }
      burnTime[i] = bt;
    }
  }

  // Edge state: 0 = open, k = inside smoke band k-1 (higher = closer to the fire), CLOSED = closed.
  const B = o.smokeBands.length;
  const CLOSED = B + 1;
  const stateAt = (i: number, t: number): number => {
    const s = burnTime[i]! - t; // seconds until the fire reaches this edge
    if (s <= o.closureLookaheadSeconds) return CLOSED;
    let st = 0;
    for (let k = 0; k < B; k++) if (s <= o.smokeBands[k]!.withinSeconds) st = k + 1;
    return st;
  };
  const factorOf = (st: number) => (st === 0 ? 1 : o.smokeBands[st - 1]!.speedFactor);

  // Every t at which some edge can change state; sync() skips ticks that cross no threshold.
  const thresholds: number[] = [];
  for (let i = 0; i < E; i++) {
    const bt = burnTime[i]!;
    if (!Number.isFinite(bt)) continue;
    thresholds.push(bt - o.closureLookaheadSeconds);
    for (const band of o.smokeBands) thresholds.push(bt - band.withinSeconds);
  }
  const thr = Float64Array.from(thresholds).sort();
  const rank = (t: number) => { // number of thresholds <= t
    let lo = 0, hi = thr.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (thr[mid]! <= t) lo = mid + 1; else hi = mid; }
    return lo;
  };

  const state = new Uint8Array(E);
  const weight = new Float64Array(E);
  let syncedRank = -1;
  let version = 0;
  let closedEdges = 0, smokyEdges = 0;
  let treeBuilds = 0, treeHits = 0;
  const fwd = new Map<number, Tree>();
  const rev = new Map<number, Tree>();
  const srcHits = new Map<number, number>();
  const dstHits = new Map<number, number>();

  const sync = (t: number) => {
    // quantize to the end of the current refresh window (conservative), so states change at most once per window
    const tq = o.stateRefreshSeconds > 0 ? (Math.floor(t / o.stateRefreshSeconds) + 1) * o.stateRefreshSeconds : t;
    const r = rank(tq);
    if (r === syncedRank) return;
    const first = syncedRank === -1;
    syncedRank = r;
    let anyDecrease = false;
    const changedEdges: number[] = [];
    closedEdges = 0; smokyEdges = 0;
    for (let i = 0; i < E; i++) {
      const st = stateAt(i, tq);
      if (st === CLOSED) closedEdges++; else if (st > 0) smokyEdges++;
      if (first || st !== state[i]) {
        const w = st === CLOSED ? Infinity : baseSeconds[i]! / factorOf(st);
        if (!first) { changedEdges.push(i); if (w < weight[i]!) anyDecrease = true; }
        state[i] = st;
        weight[i] = w;
      }
    }
    if (!first && changedEdges.length === 0) return;
    version++;
    if (first || anyDecrease) { // time went backwards (or first sync): nothing cached can be trusted
      fwd.clear(); rev.clear(); srcHits.clear(); dstHits.clear();
      return;
    }
    // Weights only went up. A shortest-path tree stays exact unless one of ITS edges got worse
    // (a costlier non-tree edge cannot create a shorter path), so drop only the trees that use one.
    for (const [k, tree] of fwd) for (const e of changedEdges) if (tree.via[eTo[e]!] === e) { fwd.delete(k); break; }
    for (const [k, tree] of rev) for (const e of changedEdges) if (tree.via[eFrom[e]!] === e) { rev.delete(k); break; }
  };

  const heap = new MinHeap();
  const popped: [number, number] = [0, 0];
  const buildTree = (root: number, reverse: boolean): Tree => {
    treeBuilds++;
    const dist = new Float64Array(N).fill(Infinity);
    const via = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const adj = reverse ? inc : out;
    const other = reverse ? eFrom : eTo;
    dist[root] = 0;
    heap.push(root, 0);
    while (heap.pop(popped)) {
      const u = popped[0], du = popped[1];
      if (done[u] || du > dist[u]!) continue;
      done[u] = 1;
      for (let k = adj.off[u]!; k < adj.off[u + 1]!; k++) {
        const e = adj.list[k]!;
        const w = weight[e]!;
        if (w === Infinity) continue;
        const v = other[e]!;
        const dv = du + w;
        if (dv < dist[v]!) { dist[v] = dv; via[v] = e; heap.push(v, dv); }
      }
    }
    return { dist, via };
  };

  const remember = (m: Map<number, Tree>, k: number, tree: Tree) => {
    if (fwd.size + rev.size >= o.maxCachedTrees) { fwd.clear(); rev.clear(); }
    m.set(k, tree);
  };

  /** A cached or freshly built tree that answers na -> nb; sets `lastReverse` (hot path, no allocation). */
  let lastReverse = false;
  const treeFor = (na: number, nb: number): Tree => {
    const f = fwd.get(na);
    if (f) { treeHits++; lastReverse = false; return f; }
    const r = rev.get(nb);
    if (r) { treeHits++; lastReverse = true; return r; }
    const sh = (srcHits.get(na) ?? 0) + 1, dh = (dstHits.get(nb) ?? 0) + 1;
    srcHits.set(na, sh); dstHits.set(nb, dh);
    if (dh > sh) { const t = buildTree(nb, true); remember(rev, nb, t); lastReverse = true; return t; }
    const t = buildTree(na, false); remember(fwd, na, t); lastReverse = false; return t;
  };

  // ---- snapping: uniform grid index + memo (households and safe zones never move) ----
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    minX = Math.min(minX, xs[i]!); maxX = Math.max(maxX, xs[i]!);
    minY = Math.min(minY, ys[i]!); maxY = Math.max(maxY, ys[i]!);
  }
  const cell = Math.max(50, Math.sqrt(((maxX - minX) * (maxY - minY)) / N) * 2 || 50);
  const gw = Math.floor((maxX - minX) / cell) + 1, gh = Math.floor((maxY - minY) / cell) + 1;
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < N; i++) {
    const k = Math.floor((ys[i]! - minY) / cell) * gw + Math.floor((xs[i]! - minX) / cell);
    let b = buckets.get(k);
    if (!b) { b = []; buckets.set(k, b); }
    b.push(i);
  }
  // memo keyed lat -> lng -> node (numeric keys; no string building on the hot path)
  const snapMemo = new Map<number, Map<number, number>>();
  let snapMemoSize = 0;
  const snap = (p: LatLng): number => {
    let row = snapMemo.get(p.lat);
    const m = row?.get(p.lng);
    if (m !== undefined) return m;
    const x = px(p), y = py(p);
    const cx = Math.min(gw - 1, Math.max(0, Math.floor((x - minX) / cell)));
    const cy = Math.min(gh - 1, Math.max(0, Math.floor((y - minY) / cell)));
    let best = -1, bestD = Infinity;
    const maxR = Math.max(gw, gh);
    for (let r = 0; r <= maxR; r++) {
      // every node in ring r is at least (r - 1) * cell away, so stop once that can't beat the best
      if (best >= 0 && (r - 1) * cell > bestD) break;
      for (let gy = cy - r; gy <= cy + r; gy++) {
        if (gy < 0 || gy >= gh) continue;
        const fullRow = gy === cy - r || gy === cy + r;
        const step = fullRow || r === 0 ? 1 : 2 * r;
        for (let gx = cx - r; gx <= cx + r; gx += step) {
          if (gx < 0 || gx >= gw) continue;
          const b = buckets.get(gy * gw + gx);
          if (!b) continue;
          for (const i of b) {
            const d = Math.hypot(xs[i]! - x, ys[i]! - y);
            if (d < bestD || (d === bestD && i < best)) { bestD = d; best = i; }
          }
        }
      }
    }
    if (snapMemoSize > 50_000) { snapMemo.clear(); snapMemoSize = 0; row = undefined; }
    if (!row) { row = new Map(); snapMemo.set(p.lat, row); }
    row.set(p.lng, best);
    snapMemoSize++;
    return best;
  };
  const toNodeMeters = (p: LatLng, i: number) => Math.hypot(px(p) - xs[i]!, py(p) - ys[i]!);
  const straightMeters = (a: LatLng, b: LatLng) => Math.hypot(px(a) - px(b), py(a) - py(b));
  const endpointBurning = (a: LatLng, b: LatLng, t: number) => !!fire && (fire.isBurning(a, t) || fire.isBurning(b, t));
  const nodePos = (i: number): LatLng => ({ lat: graph.nodes[i]!.lat, lng: graph.nodes[i]!.lng });

  const travelSeconds = (a: LatLng, b: LatLng, t: number): number => {
    sync(t);
    if (endpointBurning(a, b, t)) return Infinity;
    const na = snap(a), nb = snap(b);
    if (na === nb) return straightMeters(a, b) / accessMps;
    const tree = treeFor(na, nb);
    const road = lastReverse ? tree.dist[na]! : tree.dist[nb]!;
    if (road === Infinity) return Infinity;
    return (toNodeMeters(a, na) + toNodeMeters(b, nb)) / accessMps + road;
  };

  const route = (a: LatLng, b: LatLng, t: number): LatLng[] => {
    sync(t);
    if (endpointBurning(a, b, t)) return [];
    const na = snap(a), nb = snap(b);
    if (na === nb) return [a, b];
    const tree = treeFor(na, nb);
    const reverse = lastReverse;
    const road = reverse ? tree.dist[na]! : tree.dist[nb]!;
    if (road === Infinity) return [];
    const path: LatLng[] = [a];
    if (reverse) {
      let u = na;
      path.push(nodePos(u));
      while (u !== nb) { u = eTo[tree.via[u]!]!; path.push(nodePos(u)); }
    } else {
      const back: number[] = [];
      let u = nb;
      while (u !== na) { back.push(u); u = eFrom[tree.via[u]!]!; }
      back.push(na);
      for (let k = back.length - 1; k >= 0; k--) path.push(nodePos(back[k]!));
    }
    path.push(b);
    return path;
  };

  return {
    travelSeconds,
    route,
    sync,
    stats: () => ({ version, treeBuilds, treeHits, closedEdges, smokyEdges }),
  };
}
