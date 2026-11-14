// OWNER: Lane D. Real end-to-end check of POST /montecarlo over HTTP with the worker pool.
// Usage (from engine/): pnpm exec tsx scripts/montecarlo-smoke.ts [runs=200]
// Prints wall time and the headline numbers; exits non-zero if the response fails the contract.
import Fastify from 'fastify';
import { MonteCarloComparison } from '@lastmile/contracts';
import { PRESET_BASE, registerMonteCarlo } from '../src/montecarlo/index';

const runs = Number(process.argv[2] ?? 200);
const app = Fastify();
registerMonteCarlo(app, { warmPreset: false });
const address = await app.listen({ port: 0, host: '127.0.0.1' });

const post = async () => {
  const t0 = performance.now();
  const res = await fetch(`${address}/montecarlo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ base: PRESET_BASE, runs }),
  });
  const ms = performance.now() - t0;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = MonteCarloComparison.parse(await res.json());
  return { ms, body, cache: res.headers.get('x-montecarlo-cache') };
};

try {
  const first = await post();
  const second = await post();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const { results: r, vulnerableLift: l } = first.body;
  console.log(`POST /montecarlo runs=${runs}: ${first.ms.toFixed(0)} ms (cache ${first.cache}), repeat ${second.ms.toFixed(0)} ms (cache ${second.cache})`);
  console.log(`alerts_only vulnerable evacuated ${pct(r.alerts_only.vulnerableEvacuatedRate.mean)} [${pct(r.alerts_only.vulnerableEvacuatedRate.ci95[0])}, ${pct(r.alerts_only.vulnerableEvacuatedRate.ci95[1])}]`);
  console.log(`last_mile   vulnerable evacuated ${pct(r.last_mile.vulnerableEvacuatedRate.mean)} [${pct(r.last_mile.vulnerableEvacuatedRate.ci95[0])}, ${pct(r.last_mile.vulnerableEvacuatedRate.ci95[1])}]`);
  console.log(`vulnerableLift ${pct(l.mean)} [${pct(l.ci95[0])}, ${pct(l.ci95[1])}]`);
  for (const a of first.body.assumptions.filter((x) => x.startsWith('WARNING'))) console.log(a);
} finally {
  await app.close();
}
