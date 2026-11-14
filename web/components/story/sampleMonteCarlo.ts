// SAMPLE DATA fallback for /results (Lane E).
// When the engine's POST /montecarlo is unreachable we do NOT show hard-coded numbers. Instead we run
// Lane B's deterministic browser mock (web/lib/mock.ts) for both policies over N paired seeds and
// summarise it exactly like the engine would. The UI always labels this "SAMPLE DATA (engine not connected)":
// the mock is a scripted animation, not the Last Mile engine, so these are not results.
import { MonteCarloComparison, type Metrics, type ScenarioConfig } from '@lastmile/contracts';
import { createMockRunner } from '@/lib/mock';
import { meanCI, pairedDiff } from './stats';

export type MonteCarloBase = Omit<ScenarioConfig, 'policy' | 'seed'>;

export const SAMPLE_ASSUMPTIONS = [
  'SAMPLE DATA: computed in your browser from the scripted mock animation, NOT the Last Mile engine. Not a result.',
  'SYNTHETIC residents and helpers; not real people.',
  'Paired design: each seed runs the same town, fire and residents under both policies.',
];

const rate = (num: number, den: number) => (den > 0 ? num / den : 0);

function runOnce(base: MonteCarloBase, seed: number, policy: ScenarioConfig['policy']): { m: Metrics; assumptions: string[] } {
  const runner = createMockRunner(`sample-${policy}-${seed}`, { ...base, seed, policy });
  let guard = 0;
  while (!runner.done && guard++ < 10_000) runner.step(20);
  return { m: runner.finalMetrics(), assumptions: runner.init.assumptions };
}

/**
 * Runs `runs` paired seeds, yielding to the browser between seeds so the progress bar can paint.
 * Resolves to a contract-valid MonteCarloComparison.
 */
export async function computeSampleComparison(
  base: MonteCarloBase,
  runs: number,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<MonteCarloComparison> {
  const ev = { alerts_only: [] as number[], last_mile: [] as number[] };
  const vul = { alerts_only: [] as number[], last_mile: [] as number[] };
  const trapped = { alerts_only: [] as number[], last_mile: [] as number[] };
  let mockAssumptions: string[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    for (const policy of ['alerts_only', 'last_mile'] as const) {
      const { m, assumptions } = runOnce(base, seed, policy);
      mockAssumptions = assumptions;
      ev[policy].push(rate(m.evacuated, m.total));
      vul[policy].push(rate(m.vulnerableEvacuated, m.vulnerableTotal));
      trapped[policy].push(m.trapped);
    }
    onProgress(seed, runs);
    await new Promise((r) => setTimeout(r, 0));
  }
  const stats = (p: 'alerts_only' | 'last_mile') => ({
    evacuatedRate: meanCI(ev[p]),
    vulnerableEvacuatedRate: meanCI(vul[p]),
    trappedMean: meanCI(trapped[p]).mean,
  });
  const extra = mockAssumptions.filter((a) => !a.startsWith('SYNTHETIC') && !a.startsWith('MOCK MODE'));
  return MonteCarloComparison.parse({
    runs,
    base,
    results: { alerts_only: stats('alerts_only'), last_mile: stats('last_mile') },
    vulnerableLift: pairedDiff(vul.alerts_only, vul.last_mile),
    assumptions: [...SAMPLE_ASSUMPTIONS, ...extra],
  });
}
