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
import { largestScc } from './scc';

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
  /** cold pairs answered by an early-exit point-to-point search instead of a cached tree */
  pointToPointRuns: number;
  /** fire-free trees this router had to build (shared trees built by earlier routers are free) */
  baseTreeBuilds: number;
  closedEdges: number;
  smokyEdges: number;
}

export interface GraphRouter extends Router {
  stats(): RouterStats;
  /** Bring edge states up to time t without running a query (queries do this themselves). */
  sync(t: number): void;
  /** a guaranteed lower bound on travelSeconds(a, b, t) for any t: straight line at the fastest speed */
  lowerBoundSeconds(a: LatLng, b: LatLng): number;
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

/** A fire-free forward tree plus its settle order (parents come before children). */
interface BaseTree extends Tree { order: Int32Array }

/**
 * Fire-free forward shortest-path trees, shared by every router built on the same graph object (and so
 * across all Monte Carlo seeds and both policies in one worker). Their content depends only on the
 * graph and the root, so sharing them cannot change any result.
 */
const BASE_TREES = new WeakMap<RoadGraph, Map<number, BaseTree>>();
const MAX_BASE_TREES = 4096;

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
  let fastestMps = accessMps; // fastest speed anywhere (roads or access legs), for lowerBoundSeconds
  for (const e of graph.edges) fastestMps = Math.max(fastestMps, e.speedMph * MPH_TO_MPS);

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
  /** quantized time of the last sync (road states are judged at this time) */
  let curTq = -Infinity;
  const fwd = new Map<number, Tree>();
  const rev = new Map<number, Tree>();
  const srcHits = new Map<number, number>();
  const dstHits = new Map<number, number>();

  const sync = (t: number) => {
    // quantize to the end of the current refresh window (conservative), so states change at most once per window
    const tq = o.stateRefreshSeconds > 0 ? (Math.floor(t / o.stateRefreshSeconds) + 1) * o.stateRefreshSeconds : t;
    curTq = tq;
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

  const heap = new MinHeap(E + N + 16);
  // settled-node marks shared by every tree build (generation stamps instead of a fresh array per build)
  const doneMark = new Int32Array(N);
  let doneGen = 0;
  const popped: [number, number] = [0, 0];
  const buildTree = (root: number, reverse: boolean): Tree => {
    treeBuilds++;
    const dist = new Float64Array(N).fill(Infinity);
    const via = new Int32Array(N).fill(-1);
    const g = ++doneGen;
    const adj = reverse ? inc : out;
    const other = reverse ? eFrom : eTo;
    dist[root] = 0;
    heap.push(root, 0);
    while (heap.pop(popped)) {
      const u = popped[0], du = popped[1];
      if (doneMark[u] === g || du > dist[u]!) continue;
      doneMark[u] = g;
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

  // Point-to-point Dijkstra with early exit, for COLD pairs (neither end queried before in this road
  // state), e.g. the sim asking for the next hop of a moving helper. Exact, but it settles only the
  // nodes closer than the target instead of building (and caching) a whole tree. Scratch arrays are
  // reused across calls via a generation stamp, so it allocates nothing.
  const pDist = new Float64Array(N), pVia = new Int32Array(N), pSeen = new Int32Array(N), pDone = new Int32Array(N);
  let pGen = 0;
  let p2pRuns = 0;
  /** build (and cache) a whole tree only once a source or target has been asked for this many times */
  const TREE_AFTER = Number(process.env.LASTMILE_TREE_AFTER ?? 3);
  const pointToPoint = (na: number, nb: number): number => {
    p2pRuns++;
    pGen++;
    const g = pGen;
    pSeen[na] = g; pDist[na] = 0; pVia[na] = -1;
    heap.reset();
    heap.push(na, 0);
    while (heap.pop(popped)) {
      const u = popped[0], du = popped[1];
      if (pDone[u] === g || du > pDist[u]!) continue;
      pDone[u] = g;
      if (u === nb) { heap.reset(); return du; }
      for (let k = out.off[u]!; k < out.off[u + 1]!; k++) {
        const e = out.list[k]!;
        const w = weight[e]!;
        if (w === Infinity) continue;
        const v = eTo[e]!;
        const dv = du + w;
        if (pSeen[v] !== g || dv < pDist[v]!) { pSeen[v] = g; pDist[v] = dv; pVia[v] = e; heap.push(v, dv); }
      }
    }
    return Infinity;
  };

  // ---- fire-free base trees (shared across routers on this graph) ----
  // Fire and smoke only ever make edges slower. So if no edge on the fire-free shortest path from root
  // to x has changed state yet, that path is still the shortest at time t, and its fire-free length is
  // exact. validUntil(root)[x] = the earliest quantized time any edge on that path leaves the open state.
  const widest = Math.max(o.closureLookaheadSeconds, ...o.smokeBands.map((b) => b.withinSeconds));
  const firstChange = new Float64Array(E);
  for (let i = 0; i < E; i++) firstChange[i] = burnTime[i]! - widest; // Infinity - x = Infinity
  let shared = BASE_TREES.get(graph);
  if (!shared) { shared = new Map(); BASE_TREES.set(graph, shared); }
  const baseShared = shared;
  let baseBuilds = 0, baseHits = 0;
  const baseTree = (root: number): BaseTree => {
    let bt = baseShared.get(root);
    if (bt) return bt;
    baseBuilds++;
    const dist = new Float64Array(N).fill(Infinity);
    const via = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const order = new Int32Array(N);
    let n = 0;
    dist[root] = 0;
    heap.reset();
    heap.push(root, 0);
    while (heap.pop(popped)) {
      const u = popped[0], du = popped[1];
      if (done[u] || du > dist[u]!) continue;
      done[u] = 1;
      order[n++] = u;
      for (let k = out.off[u]!; k < out.off[u + 1]!; k++) {
        const e = out.list[k]!;
        const v = eTo[e]!;
        const dv = du + baseSeconds[e]!;
        if (dv < dist[v]!) { dist[v] = dv; via[v] = e; heap.push(v, dv); }
      }
    }
    bt = { dist, via, order: order.slice(0, n) };
    if (baseShared.size >= MAX_BASE_TREES) baseShared.clear();
    baseShared.set(root, bt);
    return bt;
  };
  const validMemo = new Map<number, Float64Array>();
  const validUntil = (root: number, bt: BaseTree): Float64Array => {
    let m = validMemo.get(root);
    if (m) return m;
    m = new Float64Array(N).fill(Infinity); // unreachable nodes stay unreachable: always "valid"
    for (let k = 1; k < bt.order.length; k++) { // order[0] is the root
      const u = bt.order[k]!;
      const e = bt.via[u]!;
      m[u] = Math.min(m[eFrom[e]!]!, firstChange[e]!);
    }
    if (validMemo.size >= 4 * o.maxCachedTrees) validMemo.clear();
    validMemo.set(root, m);
    return m;
  };
  /** the fire-free tree from na if it is still exact for na -> nb at the current time, else null */
  const baseFor = (na: number, nb: number): BaseTree | null => {
    const bt = baseTree(na);
    if (curTq < validUntil(na, bt)[nb]!) { baseHits++; return bt; }
    return null;
  };

  /**
   * A cached or freshly built tree that answers na -> nb, or null when the pair is cold and should be
   * answered by pointToPoint(). Sets `lastReverse` (hot path, no allocation).
   */
  let lastReverse = false;
  const treeFor = (na: number, nb: number): Tree | null => {
    const f = fwd.get(na);
    if (f) { treeHits++; lastReverse = false; return f; }
    const r = rev.get(nb);
    if (r) { treeHits++; lastReverse = true; return r; }
    const sh = (srcHits.get(na) ?? 0) + 1, dh = (dstHits.get(nb) ?? 0) + 1;
    srcHits.set(na, sh); dstHits.set(nb, dh);
    if (sh < TREE_AFTER && dh < TREE_AFTER) return null;
    if (dh > sh) { const t = buildTree(nb, true); remember(rev, nb, t); lastReverse = true; return t; }
    const t = buildTree(na, false); remember(fwd, na, t); lastReverse = false; return t;
  };

  // ---- snapping: uniform grid index + memo (households and safe zones never move) ----
  // Only nodes in the largest strongly connected component are snap targets, so a trip never starts
  // or ends on a disconnected island (or a one-way dead end) of the road graph.
  const inMain = largestScc(N, Array.from({ length: E }, (_, i) => ({ from: eFrom[i]!, to: eTo[i]! })));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    minX = Math.min(minX, xs[i]!); maxX = Math.max(maxX, xs[i]!);
    minY = Math.min(minY, ys[i]!); maxY = Math.max(maxY, ys[i]!);
  }
  const cell = Math.max(50, Math.sqrt(((maxX - minX) * (maxY - minY)) / N) * 2 || 50);
  const gw = Math.floor((maxX - minX) / cell) + 1, gh = Math.floor((maxY - minY) / cell) + 1;
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < N; i++) {
    if (!inMain[i]) continue;
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

  /**
   * Road seconds between snapped nodes na -> nb, and where to read the path from: a fire-free base tree
   * (when still exact), a road-state tree, or the last point-to-point search.
   */
  type Answer = { road: number; via: Int32Array; reverse: boolean };
  const answer: Answer = { road: 0, via: pVia, reverse: false };
  const solve = (na: number, nb: number): Answer => {
    const base = baseFor(na, nb);
    if (base) { answer.road = base.dist[nb]!; answer.via = base.via; answer.reverse = false; return answer; }
    const tree = treeFor(na, nb);
    if (tree === null) { answer.road = pointToPoint(na, nb); answer.via = pVia; answer.reverse = false; return answer; }
    answer.reverse = lastReverse;
    answer.road = lastReverse ? tree.dist[na]! : tree.dist[nb]!;
    answer.via = tree.via;
    return answer;
  };

  const travelSeconds = (a: LatLng, b: LatLng, t: number): number => {
    sync(t);
    if (endpointBurning(a, b, t)) return Infinity;
    const na = snap(a), nb = snap(b);
    if (na === nb) return straightMeters(a, b) / accessMps;
    const road = solve(na, nb).road;
    if (road === Infinity) return Infinity;
    return (toNodeMeters(a, na) + toNodeMeters(b, nb)) / accessMps + road;
  };

  const route = (a: LatLng, b: LatLng, t: number): LatLng[] => {
    sync(t);
    if (endpointBurning(a, b, t)) return [];
    const na = snap(a), nb = snap(b);
    if (na === nb) return [a, b];
    const { road, via, reverse } = solve(na, nb);
    if (road === Infinity) return [];
    const path: LatLng[] = [a];
    if (reverse) {
      let u = na;
      path.push(nodePos(u));
      while (u !== nb) { u = eTo[via[u]!]!; path.push(nodePos(u)); }
    } else {
      const back: number[] = [];
      let u = nb;
      while (u !== na) { back.push(u); u = eFrom[via[u]!]!; }
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
    // road edges are at least as long as the straight line between their ends, and smoke only slows them
    lowerBoundSeconds: (a, b) => straightMeters(a, b) / fastestMps,
    stats: () => ({ version, treeBuilds, treeHits: treeHits + baseHits, pointToPointRuns: p2pRuns, baseTreeBuilds: baseBuilds, closedEdges, smokyEdges }),
  };
}
