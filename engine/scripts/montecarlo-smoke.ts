// OWNER: Lane D. End-to-end check of the Monte Carlo routes over real HTTP, mounted on Lane A's real
// server exactly the way server.ts should mount them (without editing server.ts).
// Usage (from engine/): pnpm exec tsx scripts/montecarlo-smoke.ts [runs=200]
import { MonteCarloComparison } from '@lastmile/contracts';
import { buildServer } from '../src/server';
import { PRESET_BASE, registerMonteCarlo } from '../src/montecarlo/index';

const runs = Number(process.argv[2] ?? 200);
const app = await buildServer();
registerMonteCarlo(app, { warmPreset: false }); // server.ts should pass warmPreset: process.env.NODE_ENV !== 'test'
const address = await app.listen({ port: 0, host: '127.0.0.1' });

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const call = async (method: 'GET' | 'POST', path: string, body?: unknown) => {
  const t0 = performance.now();
  const res = await fetch(`${address}${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status}: ${await res.text()}`);
  return { ms, json: (await res.json()) as unknown, cache: res.headers.get('x-montecarlo-cache') };
};

try {
  const health = await call('GET', '/health');
  console.log(`GET /health -> ${JSON.stringify(health.json)}`);
  const first = await call('POST', '/montecarlo', { base: PRESET_BASE, runs });
  const body = MonteCarloComparison.parse(first.json);
  const again = await call('POST', '/montecarlo', { base: PRESET_BASE, runs });
  console.log(`POST /montecarlo runs=${runs}: ${first.ms.toFixed(0)} ms (cache ${first.cache}), repeat ${again.ms.toFixed(0)} ms (cache ${again.cache})`);
  if (runs === 200) {
    const preset = await call('GET', '/montecarlo/preset');
    console.log(`GET /montecarlo/preset: ${preset.ms.toFixed(0)} ms (cache ${preset.cache})`);
  }
  const { results: r, vulnerableLift: l } = body;
  console.log(`alerts_only vulnerable evacuated ${pct(r.alerts_only.vulnerableEvacuatedRate.mean)} [${pct(r.alerts_only.vulnerableEvacuatedRate.ci95[0])}, ${pct(r.alerts_only.vulnerableEvacuatedRate.ci95[1])}]`);
  console.log(`last_mile   vulnerable evacuated ${pct(r.last_mile.vulnerableEvacuatedRate.mean)} [${pct(r.last_mile.vulnerableEvacuatedRate.ci95[0])}, ${pct(r.last_mile.vulnerableEvacuatedRate.ci95[1])}]`);
  console.log(`vulnerableLift ${pct(l.mean)} [${pct(l.ci95[0])}, ${pct(l.ci95[1])}]`);
  for (const a of body.assumptions.filter((x) => x.startsWith('WARNING'))) console.log(a);
} finally {
  await app.close();
}
