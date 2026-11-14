// OWNER: Lane D (Monte Carlo). POST /montecarlo: paired-seed comparison of both policies.
//
// For every seed s in the seed list, BOTH policies run with the same seed (same fire, same synthetic
// population, same helpers); only `policy` differs. Runs go to a worker_threads pool, each worker
// calling Lane A's `runHeadless`. Results are summarised with percentile-bootstrap 95% CIs; the
// headline `vulnerableLift` bootstraps the per-seed DIFFERENCES so each pair stays together.
// Nothing here edits or tunes outcome numbers: they are whatever runHeadless returns.
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Metrics, MonteCarloComparison, ScenarioConfig, VULNERABLE_NEEDS } from '@lastmile/contracts';
import type { HeadlessRunner, Policy } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { runHeadless } from '../sim/headless';
import { createSim } from '../sim/engine';
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
  /** abort a batch (workers are terminated, the promise rejects) */
  signal?: AbortSignal;
  /** worker entry module (tests only; default worker-boot.mjs next to this file) */
  workerEntry?: URL;
}

const POLICIES: Policy[] = ['alerts_only', 'last_mile'];
// all cores: the server thread is mostly idle while a Monte Carlo batch runs
const defaultWorkers = () => Math.max(1, os.availableParallelism?.() ?? os.cpus().length);

/** Run every config, returning metrics in input order. */
async function runAll(configs: ScenarioConfig[], opts: MonteCarloOptions): Promise<Metrics[]> {
  const workers = opts.runner ? 0 : opts.workers ?? defaultWorkers();
  if (workers > 0) {
    try {
      return await runPool(configs, workers, opts.signal, opts.workerEntry);
    } catch (err) {
      if (!(err instanceof PoolStartError)) throw err;
      console.warn(`[montecarlo] worker pool unavailable (${err.message}); running in-process`);
    }
  }
  const runner = opts.runner ?? runHeadless;
  const out: Metrics[] = [];
  for (const c of configs) {
    opts.signal?.throwIfAborted();
    out.push(Metrics.parse(await runner(c)));
  }
  return out;
}

class PoolStartError extends Error {}

// Workers start from a plain-JS entry that registers tsx itself, so they need no loader flags. Only
// memory flags are passed through (inherited loader flags do not reliably reach workers; issue #33).
const workerExecArgv = (): string[] => process.execArgv.filter((a) => a.startsWith('--max-old-space-size') || a.startsWith('--stack-size'));

async function runPool(configs: ScenarioConfig[], size: number, signal?: AbortSignal, entry?: URL): Promise<Metrics[]> {
  signal?.throwIfAborted();
  const results: (Metrics | undefined)[] = new Array(configs.length);
  const url = entry ?? new URL('./worker-boot.mjs', import.meta.url);
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
      const onAbort = () => reject(signal?.reason ?? new Error('aborted'));
      signal?.addEventListener('abort', onAbort, { once: true });
      // `started` flips only when the worker has actually LOADED (it posts {ready}), so a module-load
      // failure is a PoolStartError and the batch falls back to in-process instead of failing
      w.on('message', (m: WorkerReply) => {
        if ('ready' in m) { started = true; feed(); return; }
        if ('error' in m) { reject(new Error(`runHeadless failed for run ${m.id}: ${m.error}`)); return; }
        results[m.id] = Metrics.parse(m.metrics);
        feed();
      });
      w.on('error', (e) => reject(started ? e : new PoolStartError(e.message)));
      w.on('exit', (code) => { if (!started || busy || code !== 0) reject(new PoolStartError(`worker exited with code ${code}`)); });
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
  /** model assumptions for this base config (from the simulator), appended after the methodology lines */
  modelAssumptions: string[] = [],
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
    `"Vulnerable" means no vehicle, or any of: ${VULNERABLE_NEEDS.filter((x) => x !== 'no_vehicle').map((x) => x.replace(/_/g, ' ')).join(', ')}.`,
    ...new Set(notes),
  ];
  for (const a of modelAssumptions) if (!assumptions.includes(a)) assumptions.push(a);
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
  return summarize(base, ao, lm, opts.bootstrap, opts.runner ? [] : modelAssumptions(base, seeds[0]!));
}

/**
 * The simulator's own assumption list for this base config (population, alerts, fire, routing, both
 * policies, any SENSITIVITY lines), read from the init of the first seed's Last Mile world. Building
 * the world is cheap (no ticks run). Issue #78: /results no longer needs a throwaway scenario.
 */
export function modelAssumptions(base: BaseConfig, seed: number): string[] {
  const sim = createSim(ScenarioConfig.parse({ ...base, seed, policy: 'last_mile' }), `mc-assumptions-${seed}`);
  return [`Model assumptions below are from the seed-${seed} world of this configuration (counts in them refer to that seed); both policies share them except the Last Mile lines.`, ...sim.init.assumptions];
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
  // one uncached batch at a time: a batch already uses every core, and this route is public
  let running = 0;
  const closing = new AbortController();
  // preClose runs before Fastify waits for in-flight requests, so a running batch is stopped promptly
  app.addHook('preClose', async () => { closing.abort(new Error('server closing')); });
  const get = (base: BaseConfig, seeds: number[]) => {
    const key = JSON.stringify({ base, seeds });
    const hit = cache.get(key);
    if (hit) return { result: hit, cached: true, busy: false };
    if (running > 0) return { result: undefined, cached: false, busy: true };
    running++;
    const result = runMonteCarlo(base, seeds, { ...opts, signal: closing.signal });
    cache.set(key, result);
    result.then(() => { running--; }, () => { running--; cache.delete(key); }); // never cache a failure
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value!);
    return { result, cached: false, busy: false };
  };
  const presetSeeds = Array.from({ length: PRESET_RUNS }, (_, i) => i + 1);
  const warm = () => get(PRESET_BASE, presetSeeds).result ?? Promise.reject(new Error('another Monte Carlo batch is running'));
  const busyReply = (reply: FastifyReply) =>
    reply.code(429).header('Retry-After', '30').send({ error: 'another Monte Carlo batch is running; retry shortly or use GET /montecarlo/preset' });

  app.post('/montecarlo', async (req, reply) => {
    const parsed = MonteCarloRequest.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid Monte Carlo request', issues: parsed.error.issues });
    const { base = PRESET_BASE, runs, seeds = Array.from({ length: runs }, (_, i) => i + 1) } = parsed.data;
    const started = Date.now();
    const { result, cached, busy } = get(base, seeds);
    if (busy || !result) return busyReply(reply);
    const body = await result;
    reply.header('x-montecarlo-cache', cached ? 'hit' : 'miss');
    reply.header('x-montecarlo-ms', String(Date.now() - started));
    return body;
  });

  app.get('/montecarlo/preset', async (_req, reply) => {
    const { result, cached, busy } = get(PRESET_BASE, presetSeeds);
    if (busy || !result) return busyReply(reply);
    reply.header('x-montecarlo-cache', cached ? 'hit' : 'miss');
    return result;
  });

  if (opts.warmPreset ?? true) warm().catch((e: unknown) => { if (!closing.signal.aborted) app.log.error({ err: e }, 'montecarlo preset failed'); });
  return { warm };
}
