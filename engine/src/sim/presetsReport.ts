// OWNER: Lane A. `pnpm --filter @lastmile/engine exec tsx src/sim/presetsReport.ts` prints a markdown table of the real
// headless numbers for each preset and both policies, for docs/status/lane-a.md. Nothing is tuned for the table.
import { runHeadless } from './headless';
import { PRESETS } from './presets';

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
console.log('| preset | policy | at-risk | evacuated | trapped | vulnerable evacuated |');
console.log('|---|---|---|---|---|---|');
for (const p of PRESETS) for (const policy of ['alerts_only', 'last_mile'] as const) {
  const m = await runHeadless({ ...p.config, policy });
  console.log(`| ${p.id} | ${policy} | ${m.total} | ${m.evacuated} (${pct(m.evacuated, m.total)}) | ${m.trapped} (${pct(m.trapped, m.total)}) | ${m.vulnerableEvacuated}/${m.vulnerableTotal} (${pct(m.vulnerableEvacuated, m.vulnerableTotal)}) |`);
}
