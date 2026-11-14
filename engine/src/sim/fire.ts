// OWNER: Lane A. Wind-driven fire spread on a 50 m grid.
//
// Model: every cell gets a fire ARRIVAL TIME from a minimum-time (Dijkstra) propagation over the 8-neighbour
// grid, where the local spread rate depends on seeded fuel noise and on the angle between the direction of
// travel and the wind. This is the cellular-automaton idea in its deterministic "arrival time" form: it gives
// exactly the same burn order as stepping the CA, but lets ignitionTime(p) be an O(1) lookup for the router and
// dispatcher. It is a SIMPLIFIED model, not a physical fire simulator; see FIRE_ASSUMPTIONS.
//
// Wind convention: dirDeg is the compass bearing the wind blows TOWARD (0 = north, 90 = east).
import type { FireModel, LatLng, LngLat, ScenarioConfig } from '@lastmile/contracts';
import { createRng, SALT } from './rng';
import { fromXY, toXY } from './geo';

export const CELL_M = 50;
export const HALF_EXTENT_M = 4000;
export const BASE_RATE_MPS = 0.25;      // no-wind spread rate on average fuel
export const WIND_GAIN_PER_MPH = 0.18;  // downwind speed-up per mph
const N = (2 * HALF_EXTENT_M) / CELL_M; // cells per side
const RAYS = 72;

export const FIRE_ASSUMPTIONS = [
  'Fire spread is a simplified wind-driven cellular model on a 50 m grid (arrival-time propagation), NOT a physical fire simulator.',
  `No-wind spread is ${BASE_RATE_MPS} m/s on average fuel; each mph of wind adds ${Math.round(WIND_GAIN_PER_MPH * 100)}% to the downwind rate and slows the backing fire. Wind direction is the bearing the wind blows toward.`,
  'Fuel varies smoothly in space (seeded noise, 0.7x to 1.3x); there are no firebreaks, roads, spotting or terrain effects.',
];

class MinHeap {
  private keys: number[] = []; private vals: number[] = [];
  get size() { return this.keys.length; }
  push(k: number, v: number) {
    const ks = this.keys, vs = this.vals; let i = ks.length; ks.push(k); vs.push(v);
    while (i > 0) { const p = (i - 1) >> 1; if (ks[p]! <= k) break; ks[i] = ks[p]!; vs[i] = vs[p]!; i = p; }
    ks[i] = k; vs[i] = v;
  }
  pop(): [number, number] {
    const ks = this.keys, vs = this.vals; const k0 = ks[0]!, v0 = vs[0]!; const k = ks.pop()!, v = vs.pop()!;
    if (ks.length) {
      let i = 0; const n = ks.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && ks[c + 1]! < ks[c]!) c++; if (ks[c]! >= k) break; ks[i] = ks[c]!; vs[i] = vs[c]!; i = c; }
      ks[i] = k; vs[i] = v;
    }
    return [k0, v0];
  }
}

function fuelField(seed: number): Float64Array {
  const rng = createRng(seed, SALT.fire);
  let f = new Float64Array(N * N); for (let i = 0; i < f.length; i++) f[i] = rng.next();
  for (let pass = 0; pass < 6; pass++) {
    const g = new Float64Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let s = 0, n = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) { s += f[rr * N + cc]!; n++; } }
      g[r * N + c] = s / n;
    }
    f = g;
  }
  let lo = Infinity, hi = -Infinity; for (const v of f) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < f.length; i++) f[i] = 0.7 + 0.6 * ((f[i]! - lo) / (hi - lo || 1));
  return f;
}

export function createFireModel(config: Pick<ScenarioConfig, 'seed' | 'wind' | 'ignition'>): FireModel {
  const origin = config.ignition;
  const fuel = fuelField(config.seed);
  const wdir = (config.wind.dirDeg * Math.PI) / 180;
  const wx = Math.sin(wdir), wy = Math.cos(wdir);
  const wind = config.wind.speedMph;
  const arrival = new Float64Array(N * N).fill(Infinity);
  const start = Math.floor(N / 2) * N + Math.floor(N / 2);
  arrival[start] = 0;
  const heap = new MinHeap(); heap.push(0, start);
  const done = new Uint8Array(N * N);
  const nb: [number, number, number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) {
    const len = Math.hypot(dr, dc); nb.push([dr, dc, len * CELL_M, (dc * wx + dr * wy) / len]); // row = north, col = east
  }
  while (heap.size) {
    const [t, i] = heap.pop(); if (done[i]) continue; done[i] = 1;
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc, dist, cos] of nb) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
      const j = rr * N + cc; if (done[j]) continue;
      const windF = cos >= 0 ? 1 + WIND_GAIN_PER_MPH * wind * cos : 1 / (1 + (WIND_GAIN_PER_MPH / 2) * wind * -cos);
      const rate = BASE_RATE_MPS * 0.5 * (fuel[i]! + fuel[j]!) * windF;
      const nt = t + dist / rate;
      if (nt < arrival[j]!) { arrival[j] = nt; heap.push(nt, j); }
    }
  }
  const sorted = Float64Array.from(arrival).sort();

  const idxXY = (x: number, y: number): number => {
    const c = Math.floor((x + HALF_EXTENT_M) / CELL_M), r = Math.floor((y + HALF_EXTENT_M) / CELL_M);
    return r < 0 || r >= N || c < 0 || c >= N ? -1 : r * N + c;
  };
  const arrivalAt = (p: LatLng): number => { const { x, y } = toXY(p, origin); const i = idxXY(x, y); return i < 0 ? Infinity : arrival[i]!; };

  return {
    ignitionTime: arrivalAt,
    isBurning: (p, t) => arrivalAt(p) <= t,
    burnedFraction(t) {
      let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m]! <= t) lo = m + 1; else hi = m; }
      return lo / sorted.length;
    },
    /** One star-shaped outline (72 rays from the ignition point, <= 73 points). Simplified on purpose. */
    rings(t) {
      if (t < 0) return [];
      const ring: LngLat[] = [];
      for (let k = 0; k < RAYS; k++) {
        const a = (k / RAYS) * 2 * Math.PI; const dx = Math.sin(a), dy = Math.cos(a);
        let rMax = 0;
        for (let r = 0; r <= HALF_EXTENT_M; r += CELL_M / 2) { const i = idxXY(dx * r, dy * r); if (i >= 0 && arrival[i]! <= t) rMax = r; }
        const p = fromXY(dx * Math.max(rMax, 15), dy * Math.max(rMax, 15), origin);
        ring.push([p.lng, p.lat]);
      }
      ring.push(ring[0]!);
      return [ring];
    },
  };
}
