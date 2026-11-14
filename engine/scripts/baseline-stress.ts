// OWNER: Lane D. Baseline fairness stress test: Last Mile vs alerts-only under harsher conditions,
// varying ONLY the public ScenarioConfig knobs (seed, helperCount, wind, ignition, town).
// Real runHeadless, paired seeds, nothing tuned. Prints a markdown table.
// Usage (from engine/): pnpm exec tsx scripts/baseline-stress.ts [runs=100]
import { BaseConfig, PRESET_BASE, runMonteCarlo } from '../src/montecarlo/index';

const runs = Number(process.argv[2] ?? 100);
const M = 111_320, cosLat = Math.cos((PRESET_BASE.ignition.lat * Math.PI) / 180);
const shift = (north: number, east: number) => ({ lat: PRESET_BASE.ignition.lat + north / M, lng: PRESET_BASE.ignition.lng + east / (M * cosLat) });

interface Case { group: string; label: string; base: BaseConfig; seedStart: number }
const mk = (group: string, label: string, over: Partial<BaseConfig>, seedStart = 1): Case =>
  ({ group, label, base: BaseConfig.parse({ ...PRESET_BASE, ...over }), seedStart });

const cases: Case[] = [
  mk('reference', 'preset (wind 20 mph E, 24 helpers)', {}),
  mk('seeds', 'preset, seeds 5001+', {}, 5001),
  mk('seeds', 'preset, seeds 90001+', {}, 90001),
  ...[1, 3, 6, 12].map((n) => mk('fewer helpers', `${n} helper${n === 1 ? '' : 's'}`, { helperCount: n })),
  ...[0, 10, 35, 50].map((w) => mk('wind', `wind ${w} mph`, { wind: { speedMph: w, dirDeg: 90 } })),
  mk('fast fire + few helpers', 'wind 50 mph, 3 helpers', { wind: { speedMph: 50, dirDeg: 90 }, helperCount: 3 }),
  mk('fast fire + few helpers', 'wind 50 mph, 1 helper', { wind: { speedMph: 50, dirDeg: 90 }, helperCount: 1 }),
  mk('wind direction', 'wind 20 mph toward N', { wind: { speedMph: 20, dirDeg: 0 } }),
  mk('wind direction', 'wind 20 mph toward SW', { wind: { speedMph: 20, dirDeg: 225 } }),
  mk('ignition point', 'ignition 1.2 km N', { ignition: shift(1200, 0) }),
  mk('ignition point', 'ignition 1.2 km S', { ignition: shift(-1200, 0) }),
  mk('ignition point', 'ignition 1.2 km E', { ignition: shift(0, 1200) }),
  mk('ignition point', 'ignition 1.2 km W', { ignition: shift(0, -1200) }),
  mk('town', 'synthetic grid town', { town: 'synthetic_grid' }),
];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pts = (m: { mean: number; ci95: [number, number] }) => `${(m.mean * 100).toFixed(1)} [${(m.ci95[0] * 100).toFixed(1)}, ${(m.ci95[1] * 100).toFixed(1)}]`;
const verdict = (m: { mean: number; ci95: [number, number] }) =>
  m.ci95[1] < 0 ? 'LOSES' : m.ci95[0] <= 0 ? 'no clear difference' : m.mean < 0.05 ? 'wins by little (<5 pts)' : 'wins';

console.log(`| group | config | seeds | alerts-only vulnerable evac | Last Mile vulnerable evac | lift, pts [95% CI] | all homes evac (AO -> LM) | verdict |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const c of cases) {
  const seeds = Array.from({ length: runs }, (_, i) => c.seedStart + i);
  const r = await runMonteCarlo(c.base, seeds);
  const ao = r.results.alerts_only, lm = r.results.last_mile;
  console.log(`| ${c.group} | ${c.label} | ${seeds[0]}-${seeds[seeds.length - 1]} | ${pct(ao.vulnerableEvacuatedRate.mean)} | ${pct(lm.vulnerableEvacuatedRate.mean)} | ${pts(r.vulnerableLift)} | ${pct(ao.evacuatedRate.mean)} -> ${pct(lm.evacuatedRate.mean)} | ${verdict(r.vulnerableLift)} |`);
}
