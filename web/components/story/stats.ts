// Small, dependency-free statistics used by the story pages (Lane E).
// The Monte Carlo evaluator on the engine does the real work; this file only exists so the
// SAMPLE fallback (computed in the browser from the mock runner) is summarised the same way.

/** Two-sided 97.5% Student-t quantiles for df = 1..30; beyond that we use the normal 1.96. */
const T975 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

export function tQuantile975(df: number): number {
  if (df < 1) return Number.NaN;
  return df <= 30 ? T975[df - 1]! : 1.96;
}

export interface MeanCI {
  mean: number;
  ci95: [number, number];
}

/** Mean with a 95% t-interval. n < 2 gives a degenerate interval at the mean. */
export function meanCI(xs: number[]): MeanCI {
  const n = xs.length;
  if (n === 0) return { mean: Number.NaN, ci95: [Number.NaN, Number.NaN] };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, ci95: [mean, mean] };
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  const half = tQuantile975(n - 1) * Math.sqrt(variance / n);
  return { mean, ci95: [mean - half, mean + half] };
}

/** Paired difference b[i] - a[i] (same seed under both policies). */
export function pairedDiff(a: number[], b: number[]): MeanCI {
  if (a.length !== b.length) throw new Error('pairedDiff: arrays must be the same length');
  return meanCI(b.map((x, i) => x - a[i]!));
}

/** True when the interval excludes zero. */
export const excludesZero = (ci: [number, number]) => ci[0] > 0 || ci[1] < 0;
