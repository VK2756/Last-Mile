import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { MonteCarloComparison } from '@lastmile/contracts';
import type { HeadlessRunner, Metrics } from '@lastmile/contracts';
import { bootstrapMean, prng, quantileSorted } from '../src/montecarlo/stats';
import { PRESET_BASE, registerMonteCarlo, runMonteCarlo, summarize } from '../src/montecarlo/index';

const metrics = (vulnerableEvacuated: number, evacuated = 500, total = 600, vulnerableTotal = 120, trapped = 20): Metrics =>
  ({ total, evacuated, trapped, inProgress: 0, vulnerableTotal, vulnerableEvacuated, vulnerableTrapped: 0 });

describe('bootstrap statistics', () => {
  it('quantiles interpolate linearly', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 0)).toBe(1);
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4);
    expect(quantileSorted([10], 0.3)).toBe(10);
  });

  it('a constant sample has a zero-width interval', () => {
    const r = bootstrapMean(new Array(50).fill(0.42));
    expect(r.mean).toBeCloseTo(0.42, 12);
    expect(r.ci95[0]).toBeCloseTo(0.42, 12);
    expect(r.ci95[1]).toBeCloseTo(0.42, 12);
  });

  it('matches the normal-theory interval on a fair coin (toy case)', () => {
    // 400 draws, exactly half ones: mean 0.5, standard error sqrt(0.25/400) = 0.025, so 95% CI ~ 0.5 +- 0.049
    const xs = Array.from({ length: 400 }, (_, i) => i % 2);
    const r = bootstrapMean(xs, { resamples: 4000 });
    expect(r.mean).toBe(0.5);
    expect(r.ci95[0]).toBeCloseTo(0.5 - 1.96 * 0.025, 2);
    expect(r.ci95[1]).toBeCloseTo(0.5 + 1.96 * 0.025, 2);
  });

  it('is reproducible for a fixed resampling seed and drops NaN', () => {
    const rnd = prng(3);
    const xs = Array.from({ length: 100 }, () => rnd());
    expect(bootstrapMean(xs)).toEqual(bootstrapMean(xs));
    expect(bootstrapMean([...xs, NaN])).toEqual(bootstrapMean(xs));
    expect(bootstrapMean(xs, { seed: 1 })).not.toEqual(bootstrapMean(xs, { seed: 2 }));
  });
});

describe('summarize (paired comparison)', () => {
  it('pairing removes seed-to-seed noise from the lift', () => {
    const rnd = prng(9);
    const ao: Metrics[] = [], lm: Metrics[] = [];
    for (let i = 0; i < 200; i++) {
      const v = 30 + Math.floor(rnd() * 60); // big between-seed variation
      ao.push(metrics(v));
      lm.push(metrics(v + 12)); // exactly +12 of 120 = +0.1 on every seed
    }
    const c = summarize(PRESET_BASE, ao, lm);
    expect(MonteCarloComparison.safeParse(c).success).toBe(true);
    expect(c.vulnerableLift.mean).toBeCloseTo(0.1, 12);
    expect(c.vulnerableLift.ci95[0]).toBeCloseTo(0.1, 12);
    expect(c.vulnerableLift.ci95[1]).toBeCloseTo(0.1, 12);
    // the unpaired per-policy interval is much wider than the paired lift interval
    const w = c.results.last_mile.vulnerableEvacuatedRate.ci95;
    expect(w[1] - w[0]).toBeGreaterThan(0.02);
  });

  it('computes per-policy rates and trapped means', () => {
    const c = summarize(PRESET_BASE, [metrics(60, 300, 600, 120, 10), metrics(60, 300, 600, 120, 30)], [metrics(90, 450, 600, 120, 4), metrics(90, 450, 600, 120, 6)]);
    expect(c.runs).toBe(2);
    expect(c.results.alerts_only.evacuatedRate.mean).toBeCloseTo(0.5, 12);
    expect(c.results.last_mile.evacuatedRate.mean).toBeCloseTo(0.75, 12);
    expect(c.results.alerts_only.vulnerableEvacuatedRate.mean).toBeCloseTo(0.5, 12);
    expect(c.results.alerts_only.trappedMean).toBe(20);
    expect(c.results.last_mile.trappedMean).toBe(5);
    expect(c.vulnerableLift.mean).toBeCloseTo(0.25, 12);
    expect(c.assumptions.join(' ')).toMatch(/SIMULATION/);
  });

  it('reports 0 (with a note) instead of NaN when no run has vulnerable homes', () => {
    const c = summarize(PRESET_BASE, [metrics(0, 1, 2, 0), metrics(0, 1, 2, 0)], [metrics(0, 2, 2, 0), metrics(0, 1, 2, 0)]);
    expect(c.vulnerableLift.mean).toBe(0);
    expect(c.assumptions.join(' ')).toMatch(/no data/);
  });

  it('warns when every run is identical (placeholder simulator)', () => {
    const c = summarize(PRESET_BASE, [metrics(50), metrics(50)], [metrics(90), metrics(90)]);
    expect(c.assumptions.join(' ')).toMatch(/WARNING/);
    const c2 = summarize(PRESET_BASE, [metrics(50), metrics(51)], [metrics(90), metrics(90)]);
    expect(c2.assumptions.join(' ')).not.toMatch(/WARNING/);
  });
});

describe('runMonteCarlo', () => {
  // toy runner: last_mile evacuates 6 more vulnerable homes (of 120) on every seed, +0.05
  const toy: HeadlessRunner = async (c) => metrics(40 + (c.seed % 17) + (c.policy === 'last_mile' ? 6 : 0), 400 + (c.seed % 50));
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  it('pairs seeds across policies and is deterministic for a fixed seed list', async () => {
    const seen: string[] = [];
    const spy: HeadlessRunner = async (c) => { seen.push(`${c.seed}:${c.policy}`); return toy(c); };
    const a = await runMonteCarlo(PRESET_BASE, seeds, { runner: spy });
    const b = await runMonteCarlo(PRESET_BASE, seeds, { runner: toy });
    expect(a).toEqual(b);
    expect(seen.length).toBe(80);
    for (const s of seeds) { expect(seen).toContain(`${s}:alerts_only`); expect(seen).toContain(`${s}:last_mile`); }
    expect(a.runs).toBe(40);
    expect(a.vulnerableLift.mean).toBeCloseTo(0.05, 12);
  });

  it('gives the same answer from the worker pool as in-process', async () => {
    const inProc = await runMonteCarlo(PRESET_BASE, [1, 2, 3, 4, 5, 6], { workers: 0 });
    const pooled = await runMonteCarlo(PRESET_BASE, [1, 2, 3, 4, 5, 6], { workers: 2 });
    expect(pooled).toEqual(inProc);
  }, 60_000);
});

describe('registerMonteCarlo routes', () => {
  it('POST /montecarlo validates, computes, caches; GET /montecarlo/preset serves the preset', async () => {
    const app = Fastify();
    registerMonteCarlo(app, { workers: 0, warmPreset: false });
    await app.ready();
    const bad = await app.inject({ method: 'POST', url: '/montecarlo', payload: { runs: 1 } });
    expect(bad.statusCode).toBe(400);
    const r1 = await app.inject({ method: 'POST', url: '/montecarlo', payload: { base: PRESET_BASE, runs: 10 } });
    expect(r1.statusCode).toBe(200);
    expect(r1.headers['x-montecarlo-cache']).toBe('miss');
    const body = MonteCarloComparison.parse(r1.json());
    expect(body.runs).toBe(10);
    const r2 = await app.inject({ method: 'POST', url: '/montecarlo', payload: { base: PRESET_BASE, runs: 10 } });
    expect(r2.headers['x-montecarlo-cache']).toBe('hit');
    expect(r2.json()).toEqual(r1.json());
    const p = await app.inject({ method: 'GET', url: '/montecarlo/preset' });
    expect(p.statusCode).toBe(200);
    expect(MonteCarloComparison.parse(p.json()).runs).toBe(200);
    const p2 = await app.inject({ method: 'POST', url: '/montecarlo', payload: {} });
    expect(p2.headers['x-montecarlo-cache']).toBe('hit'); // empty body = the preset
    await app.close();
  });
});
