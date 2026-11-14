// OWNER: Lane D. Paired Monte Carlo from the command line, using the real runHeadless.
// Usage (from engine/):
//   pnpm exec tsx scripts/montecarlo-cli.ts [--runs 200] [--seed-start 1] [--wind-mph 20] [--wind-dir 90]
//                                           [--helpers 24] [--town amherst] [--workers N] [--json]
// Seeds are seed-start .. seed-start+runs-1. Prints both policies' rates with 95% CIs and the paired lift.
import { ScenarioConfig } from '@lastmile/contracts';
import { PRESET_BASE, BaseConfig, runMonteCarlo } from '../src/montecarlo/index';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const num = (name: string, dflt: number) => { const v = opt(name); return v === undefined ? dflt : Number(v); };

const runs = num('runs', 200);
const seedStart = num('seed-start', 1);
const base = BaseConfig.parse({
  ...PRESET_BASE,
  helperCount: num('helpers', PRESET_BASE.helperCount),
  wind: { speedMph: num('wind-mph', PRESET_BASE.wind.speedMph), dirDeg: num('wind-dir', PRESET_BASE.wind.dirDeg) },
  town: ScenarioConfig.shape.town.parse(opt('town') ?? PRESET_BASE.town),
});
const seeds = Array.from({ length: runs }, (_, i) => seedStart + i);
const workers = opt('workers') === undefined ? undefined : Number(opt('workers'));

const t0 = performance.now();
const c = await runMonteCarlo(base, seeds, workers === undefined ? {} : { workers });
const secs = (performance.now() - t0) / 1000;

if (flag('json')) {
  console.log(JSON.stringify({ seconds: secs, seeds: [seeds[0], seeds[seeds.length - 1]], ...c }, null, 2));
} else {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const ci = (m: { mean: number; ci95: [number, number] }) => `${pct(m.mean)} [${pct(m.ci95[0])}, ${pct(m.ci95[1])}]`;
  const pts = (m: { mean: number; ci95: [number, number] }) => `${(m.mean * 100).toFixed(1)} pts [${(m.ci95[0] * 100).toFixed(1)}, ${(m.ci95[1] * 100).toFixed(1)}]`;
  console.log(`runs=${c.runs} seeds ${seeds[0]}..${seeds[seeds.length - 1]} town=${base.town} wind=${base.wind.speedMph}mph@${base.wind.dirDeg}deg helpers=${base.helperCount}  (${secs.toFixed(1)} s)`);
  for (const p of ['alerts_only', 'last_mile'] as const) {
    const r = c.results[p];
    console.log(`  ${p.padEnd(11)} evacuated ${ci(r.evacuatedRate)}  vulnerable evacuated ${ci(r.vulnerableEvacuatedRate)}  trapped/run ${r.trappedMean.toFixed(1)}`);
  }
  console.log(`  vulnerableLift (paired, last_mile - alerts_only): ${pts(c.vulnerableLift)}`);
  for (const a of c.assumptions.filter((x) => x.startsWith('WARNING'))) console.log(`  ${a}`);
}
