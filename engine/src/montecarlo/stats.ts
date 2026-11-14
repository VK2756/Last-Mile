// OWNER: Lane D (Monte Carlo). Bootstrap statistics; deterministic (seeded resampling).

/** mulberry32: small, fast, seedable PRNG in [0, 1). */
export function prng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mean = (xs: ArrayLike<number>): number => {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i]!;
  return s / xs.length;
};

/** Linear-interpolated quantile of an ascending-sorted array (type 7, as in R / numpy default). */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * q;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

export interface BootstrapOptions {
  /** number of bootstrap resamples. Default 2000. */
  resamples?: number;
  /** PRNG seed for the resampling, so results are reproducible. Default 20261115. */
  seed?: number;
  /** two-sided confidence level. Default 0.95. */
  level?: number;
}

export interface MeanCI { mean: number; ci95: [number, number] }

/**
 * Percentile bootstrap CI for the mean of `xs` (NaN entries are dropped first).
 * For a paired comparison, pass the per-seed DIFFERENCES: resampling seeds keeps each pair together.
 */
export function bootstrapMean(xs: ArrayLike<number>, opts: BootstrapOptions = {}): MeanCI {
  const data = Array.from(xs).filter((x) => !Number.isNaN(x));
  const n = data.length;
  if (n === 0) return { mean: NaN, ci95: [NaN, NaN] };
  const m = mean(data);
  const B = opts.resamples ?? 2000;
  const level = opts.level ?? 0.95;
  const rnd = prng(opts.seed ?? 20261115);
  const means = new Float64Array(B);
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += data[Math.floor(rnd() * n)]!;
    means[b] = s / n;
  }
  means.sort();
  const alpha = (1 - level) / 2;
  return { mean: m, ci95: [quantileSorted(means, alpha), quantileSorted(means, 1 - alpha)] };
}
