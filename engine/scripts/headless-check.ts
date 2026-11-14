// OWNER: Lane D. Runs the real sim headless with Lane D's router + dispatcher and prints outcomes and
// rejected-assignment counts. Usage (from engine/): pnpm exec tsx scripts/headless-check.ts [seeds=5]
import { ScenarioConfig } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { createSim } from '../src/sim/engine';

const seeds = Number(process.argv[2] ?? 5);
for (let seed = 1; seed <= seeds; seed++) {
  for (const policy of ['alerts_only', 'last_mile'] as const) {
    const config = ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24, seed, policy });
    const t0 = performance.now();
    const sim = createSim(config, `check-${seed}-${policy}`);
    while (!sim.done) sim.advance(600);
    const m = sim.finalMetrics();
    console.log(`seed ${seed} ${policy.padEnd(11)} ${(performance.now() - t0).toFixed(0).padStart(5)} ms  evacuated ${m.evacuated}/${m.total}  vulnerable ${m.vulnerableEvacuated}/${m.vulnerableTotal}  trapped ${m.trapped}  stats ${JSON.stringify(sim.stats)}`);
  }
}
