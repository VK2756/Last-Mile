// OWNER: Lane A. Seeded RNG (mulberry32). Every random stream in the sim derives from the scenario seed
// so the same seed always yields the same result. Streams are salted so adding draws in one stream
// never shifts another (population and fire are policy-independent => paired seeds are truly paired).
export interface Rng {
  next(): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number; // inclusive
  chance(p: number): boolean;
  exp(mean: number): number;
  pick<T>(xs: readonly T[]): T;
}

function mix(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed: number, salt = 0): Rng {
  let a = mix(seed | 0, salt);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    exp: (mean) => -Math.log(1 - next()) * mean,
    pick: (xs) => xs[Math.floor(next() * xs.length)]!,
  };
}

export const SALT = { fire: 1, population: 2, behavior: 3, helpers: 4 } as const;
