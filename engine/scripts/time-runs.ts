// OWNER: Lane D. Steady single-thread timing of real headless runs (less noisy than pool wall time).
// Usage (from engine/): pnpm exec tsx scripts/time-runs.ts [seeds=20] [repeats=3]
// Prints the best-of-repeats mean ms per run for each policy, plus total per seed pair.
import { ScenarioConfig } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { runHeadless } from '../src/sim/headless';

const seeds = Number(process.argv[2] ?? 20);
const repeats = Number(process.argv[3] ?? 3);
const best = { alerts_only: Infinity, last_mile: Infinity };
// warm-up so JIT and shared caches do not count against the first repeat
await runHeadless(ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24, seed: 999, policy: 'last_mile' }));
for (let r = 0; r < repeats; r++) {
  for (const policy of ['alerts_only', 'last_mile'] as const) {
    const t0 = performance.now();
    for (let seed = 1; seed <= seeds; seed++) await runHeadless(ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24, seed, policy }));
    best[policy] = Math.min(best[policy], (performance.now() - t0) / seeds);
  }
}
console.log(`alerts_only ${best.alerts_only.toFixed(0)} ms/run, last_mile ${best.last_mile.toFixed(0)} ms/run, pair ${(best.alerts_only + best.last_mile).toFixed(0)} ms` +
  ` -> N=200 on 2 workers ~ ${((200 * (best.alerts_only + best.last_mile)) / 2 / 1000).toFixed(1)} s (compute only)`);
