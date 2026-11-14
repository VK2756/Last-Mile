// OWNER: Lane D (Monte Carlo). POST /montecarlo: paired-seed comparison of both policies.
//
// For every seed s in the seed list, BOTH policies run with the same seed (same fire, same synthetic
// population, same helpers); only `policy` differs. Runs go to a worker_threads pool, each worker
// calling Lane A's `runHeadless`. Results are summarised with percentile-bootstrap 95% CIs; the
// headline `vulnerableLift` bootstraps the per-seed DIFFERENCES so each pair stays together.
// Nothing here edits or tunes outcome numbers: they are whatever runHeadless returns.
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Metrics, MonteCarloComparison, ScenarioConfig, VULNERABLE_NEEDS } from '@lastmile/contracts';
import type { HeadlessRunner, Policy } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { runHeadless } from '../sim/headless';
import { bootstrapMean, mean, type BootstrapOptions } from './stats';
import type { WorkerReply, WorkerTask } from './worker';

export const BaseConfig = ScenarioConfig.omit({ policy: true, seed: true });
export type BaseConfig = z.infer<typeof BaseConfig>;

export const MonteCarloRequest = z.object({
  /** omitted -> PRESET_BASE (the cached demo preset) */
  base: BaseConfig.optional(),
  runs: z.number().int().min(2).max(1000).default(200),
  /** explicit seed list (overrides runs); default is 1..runs */
  seeds: z.array(z.number().int()).min(2).max(1000).optional(),
});
export type MonteCarloRequest = z.input<typeof MonteCarloRequest>;

/** The demo preset: the shared fixture's fire and town with the contract's default helper count. */
export const PRESET_BASE: BaseConfig = BaseConfig.parse({ ...sampleInit.config, helperCount: ScenarioConfig.shape.helperCount.parse(undefined) });
export const PRESET_RUNS = 200;

export interface MonteCarloOptions {
  /** worker threads; 0 runs in-process. Default: all available cores. */
  workers?: number;
  /** custom runner (tests); forces in-process execution since functions cannot cross threads */
  runner?: HeadlessRunner;
  bootstrap?: BootstrapOptions;
}

const POLICIES: Policy[] = ['alerts_only', 'last_mile'];
// all cores: the server thread is mostly idle while a Monte Carlo batch runs
const defaultWorkers = () => Math.max(1, os.availableParallelism?.() ?? os.cpus().length);

/** Run every config, returning metrics in input order. */
async function runAll(configs: ScenarioConfig[], opts: MonteCarloOptions): Promise<Metrics[]> {
  const workers = opts.runner ? 0 : opts.workers ?? defaultWorkers();
  if (workers > 0) {
    try {
      return await runPool(configs, workers);
    } catch (err) {
      if (!(err instanceof PoolStartError)) throw err;
      console.warn(`[montecarlo] worker pool unavailable (${err.message}); running in-process`);
    }
  }
  const runner = opts.runner ?? runHeadless;
  const out: Metrics[] = [];
  for (const c of configs) out.push(Metrics.parse(await runner(c)));
  return out;
}

class PoolStartError extends Error {}

function workerExecArgv(): string[] {
  const inherited = process.execArgv.filter((a) => !a.startsWith('--inspect'));
  // the engine runs TypeScript through tsx; make sure workers can load .ts too
  return inherited.some((a) => a.includes('tsx')) ? inherited : [...inherited, '--import', 'tsx'];
}

async function runPool(configs: ScenarioConfig[], size: number): Promise<Metrics[]> {
  const results: (Metrics | undefined)[] = new Array(configs.length);
  const url = new URL('./worker.ts', import.meta.url);
  const pool: Worker[] = [];
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(size, configs.length) }, () => new Promise<void>((resolve, reject) => {
      const w = new Worker(url, { execArgv: workerExecArgv() });
      pool.push(w);
      let started = false;
      let busy = false;
      const feed = () => {
        if (next >= configs.length) { busy = false; resolve(); return; }
        const id = next++;
        busy = true;
        w.postMessage({ id, config: configs[id]! } satisfies WorkerTask);
      };
      w.on('online', () => { started = true; feed(); });
      w.on('message', (m: WorkerReply) => {
        if ('error' in m) { reject(new Error(`runHeadless failed for run ${m.id}: ${m.error}`)); return; }
        results[m.id] = Metrics.parse(m.metrics);
        feed();
      });
      w.on('error', (e) => reject(started ? e : new PoolStartError(e.message)));
      w.on('exit', (code) => { if (busy || code !== 0) reject(new PoolStartError(`worker exited with code ${code}`)); });
    })));
  } finally {
    await Promise.all(pool.map((w) => w.terminate()));
  }
  return results.map((m, i) => { if (!m) throw new Error(`run ${i} produced no result`); return m; });
}

const rate = (num: number, den: number) => (den > 0 ? num / den : NaN);

/** Pure summary step (exported for tests): paired metrics per seed -> MonteCarloComparison. */
export function summarize(
  base: BaseConfig,
  alertsOnly: Metrics[],
  lastMile: Metrics[],
  bootstrap: BootstrapOptions = {},
): MonteCarloComparison {
  if (alertsOnly.length !== lastMile.length) throw new Error('summarize: runs are not paired');
  const n = alertsOnly.length;
  const notes: string[] = [];
  const fix = (v: number, what: string) => { if (Number.isNaN(v)) { notes.push(`${what} had no data in any run and is reported as 0.`); return 0; } return v; };
  const ci = (xs: number[], what: string) => {
    const r = bootstrapMean(xs, bootstrap);
    return { mean: fix(r.mean, what), ci95: [fix(r.ci95[0], what), fix(r.ci95[1], what)] as [number, number] };
  };
  const stats = (runs: Metrics[], label: string) => ({
    evacuatedRate: ci(runs.map((m) => rate(m.evacuated, m.total)), `${label} evacuated rate`),
    vulnerableEvacuatedRate: ci(runs.map((m) => rate(m.vulnerableEvacuated, m.vulnerableTotal)), `${label} vulnerable evacuated rate`),
    trappedMean: mean(runs.map((m) => m.trapped)),
  });
  const lift = alertsOnly.map((a, i) => rate(lastMile[i]!.vulnerableEvacuated, lastMile[i]!.vulnerableTotal) - rate(a.vulnerableEvacuated, a.vulnerableTotal));
  // compute everything first so `notes` is complete before the assumptions list is built
  const results = { alerts_only: stats(alertsOnly, 'Alerts-only'), last_mile: stats(lastMile, 'Last Mile') };
  const vulnerableLift = ci(lift, 'Vulnerable lift');
  const B = bootstrap.resamples ?? 2000;
  const all = [...alertsOnly, ...lastMile].map((m) => JSON.stringify(m));
  const identical = POLICIES.every((_, p) => new Set(all.slice(p * n, (p + 1) * n)).size === 1);
  const assumptions = [
    'SIMULATION: every resident, helper and fire is synthetic; these numbers describe the model, not a forecast.',
    `${n} paired runs: for each seed, both policies face the same fire, population and helpers; only the policy differs.`,
    `Rates are per run (homes evacuated / homes); 95% intervals are percentile bootstrap intervals over runs (${B} resamples).`,
    'Vulnerable lift is the mean per-seed difference (Last Mile minus alerts only) in the vulnerable evacuated rate, bootstrapped over seeds so each pair stays together.',
    `"Vulnerable" means no vehicle, or any of: ${VULNERABLE_NEEDS.map((x) => x.replace(/_/g, ' ')).join(', ')}.`,
    ...new Set(notes),
  ];
  if (identical && n > 1) {
    assumptions.push('WARNING: every run of each policy returned identical metrics, so the simulator may still be a placeholder; do not quote these numbers.');
  }
  return MonteCarloComparison.parse({
    runs: n,
    base,
    results,
    vulnerableLift,
    assumptions,
  });
}

/** Run the paired comparison. Deterministic for a fixed base + seed list (if runHeadless is). */
export async function runMonteCarlo(base: BaseConfig, seeds: number[], opts: MonteCarloOptions = {}): Promise<MonteCarloComparison> {
  const configs: ScenarioConfig[] = [];
  for (const seed of seeds) for (const policy of POLICIES) configs.push(ScenarioConfig.parse({ ...base, seed, policy }));
  const metrics = await runAll(configs, opts);
  const ao = metrics.filter((_, i) => i % 2 === 0);
  const lm = metrics.filter((_, i) => i % 2 === 1);
  return summarize(base, ao, lm, opts.bootstrap);
}

export interface RegisterOptions extends MonteCarloOptions {
  /** start computing the preset as soon as the route is registered. Default true. */
  warmPreset?: boolean;
  /** how many distinct results to keep in memory. Default 8. */
  cacheSize?: number;
}

/** Mounts POST /montecarlo and GET /montecarlo/preset on Lane A's Fastify app. */
export function registerMonteCarlo(app: FastifyInstance, opts: RegisterOptions = {}): { warm: () => Promise<MonteCarloComparison> } {
  const cache = new Map<string, Promise<MonteCarloComparison>>();
  const cacheSize = opts.cacheSize ?? 8;
  const get = (base: BaseConfig, seeds: number[]) => {
    const key = JSON.stringify({ base, seeds });
    const hit = cache.get(key);
    if (hit) return { result: hit, cached: true };
    const result = runMonteCarlo(base, seeds, opts);
    cache.set(key, result);
    result.catch(() => cache.delete(key)); // never cache a failure
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
    return { result, cached: false };
  };
  const presetSeeds = Array.from({ length: PRESET_RUNS }, (_, i) => i + 1);
  const warm = () => get(PRESET_BASE, presetSeeds).result;

  app.post('/montecarlo', async (req, reply) => {
    const parsed = MonteCarloRequest.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid Monte Carlo request', issues: parsed.error.issues });
    const { base = PRESET_BASE, runs, seeds = Array.from({ length: runs }, (_, i) => i + 1) } = parsed.data;
    const started = Date.now();
    const { result, cached } = get(base, seeds);
    const body = await result;
    reply.header('x-montecarlo-cache', cached ? 'hit' : 'miss');
    reply.header('x-montecarlo-ms', String(Date.now() - started));
    return body;
  });

  app.get('/montecarlo/preset', async (_req, reply) => {
    const { result, cached } = get(PRESET_BASE, presetSeeds);
    reply.header('x-montecarlo-cache', cached ? 'hit' : 'miss');
    return result;
  });

  if (opts.warmPreset ?? true) warm().catch((e: unknown) => app.log.error({ err: e }, 'montecarlo preset failed'));
  return { warm };
}
