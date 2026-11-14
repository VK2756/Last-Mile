// OWNER: Lane A. Honest sensitivity table: paired seeds, same fire and people, harsher assumptions for Last Mile.
// `pnpm --filter @lastmile/engine exec tsx src/sim/sensitivityReport.ts [pairs]` (default 50 pairs per row).
import type { ScenarioConfig } from '@lastmile/contracts';
import { PRESET_BASE } from '../montecarlo';
import { runHeadlessWith } from './headless';
import type { Variant } from '../world/population';

const pairs = Number(process.argv[2] ?? 50);
const far = 'far_from_fire' as const;
const rows: { name: string; helperCount?: number; variant?: Variant }[] = [
  { name: 'headline assumptions (help known 1-3 min, 24 helpers at random nodes)' },
  { name: 'help requests known 5-10 min after warning', variant: { helpDelayS: [300, 600] } },
  { name: '12 helpers', helperCount: 12 },
  { name: '6 helpers', helperCount: 6 },
  { name: 'helpers start far from the fire (30% of nodes it reaches last)', variant: { helperPlacement: far } },
  { name: 'HARSH: 5-10 min + 12 helpers + far start', helperCount: 12, variant: { helpDelayS: [300, 600], helperPlacement: far } },
  { name: 'HARSHEST: 5-10 min + 6 helpers + far start', helperCount: 6, variant: { helpDelayS: [300, 600], helperPlacement: far } },
];
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const sd = (x: number[]) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

console.log(`Vulnerable households evacuated, ${pairs} paired seeds per row, preset base (wind 20 mph @90), real Amherst roads\n`);
console.log('| assumption set | alerts only | Last Mile | paired lift (pts) [95% CI] | all-homes trapped (alerts -> LM) |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
  const a: number[] = [], l: number[] = [], d: number[] = [], ta: number[] = [], tl: number[] = [];
  for (let seed = 1; seed <= pairs; seed++) {
    const base: ScenarioConfig = { ...PRESET_BASE, helperCount: r.helperCount ?? PRESET_BASE.helperCount, seed, policy: 'alerts_only' };
    const ma = runHeadlessWith(base, { variant: r.variant }), ml = runHeadlessWith({ ...base, policy: 'last_mile' }, { variant: r.variant });
    const va = ma.vulnerableEvacuated / ma.vulnerableTotal, vl = ml.vulnerableEvacuated / ml.vulnerableTotal;
    a.push(va); l.push(vl); d.push(vl - va); ta.push(ma.trapped / ma.total); tl.push(ml.trapped / ml.total);
  }
  const m = mean(d), h = 1.96 * sd(d) / Math.sqrt(d.length);
  console.log(`| ${r.name} | ${pct(mean(a))} | ${pct(mean(l))} | ${(100 * m).toFixed(1)} [${(100 * (m - h)).toFixed(1)}, ${(100 * (m + h)).toFixed(1)}] | ${pct(mean(ta))} -> ${pct(mean(tl))} |`);
}
