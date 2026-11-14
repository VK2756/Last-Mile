// OWNER: Lane D. Splits one headless run's wall time into dispatcher / router / everything else.
// Usage (from engine/): pnpm exec tsx scripts/profile-run.ts [seeds=5]
import { ScenarioConfig } from '@lastmile/contracts';
import type { Router } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { runHeadlessWith } from '../src/sim/headless';
import { createDispatcher } from '../src/dispatch/index';

const seeds = Number(process.argv[2] ?? 5);
const rows: string[] = [];
const tot = { alerts_only: { wall: 0, plan: 0, route: 0, calls: 0, plans: 0 }, last_mile: { wall: 0, plan: 0, route: 0, calls: 0, plans: 0 } };
for (let seed = 1; seed <= seeds; seed++) {
  for (const policy of ['alerts_only', 'last_mile'] as const) {
    const config = ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24, seed, policy });
    const acc = tot[policy];
    const inner = createDispatcher();
    let routeMs = 0;
    const dispatcher = {
      plan: (w: Parameters<typeof inner.plan>[0]) => {
        const r = w.router;
        // time every router call made from inside the dispatcher
        const timed: Router = {
          travelSeconds: (a, b, t) => { const s = performance.now(); const v = r.travelSeconds(a, b, t); routeMs += performance.now() - s; acc.calls++; return v; },
          route: (a, b, t) => { const s = performance.now(); const v = r.route(a, b, t); routeMs += performance.now() - s; acc.calls++; return v; },
        };
        const s = performance.now();
        const out = inner.plan({ ...w, router: timed });
        acc.plan += performance.now() - s;
        acc.plans++;
        return out;
      },
    };
    const t0 = performance.now();
    await runHeadlessWith(config, { dispatcher });
    acc.wall += performance.now() - t0;
    acc.route += routeMs;
  }
}
for (const [policy, a] of Object.entries(tot)) {
  rows.push(`${policy.padEnd(11)} per run: wall ${(a.wall / seeds).toFixed(0)} ms, dispatcher ${(a.plan / seeds).toFixed(0)} ms (of which router ${(a.route / seeds).toFixed(0)} ms), other ${((a.wall - a.plan) / seeds).toFixed(0)} ms; ${(a.plans / seeds).toFixed(0)} plans/run, ${(a.plan / Math.max(1, a.plans)).toFixed(2)} ms/plan, ${(a.calls / seeds).toFixed(0)} router calls/run`);
}
console.log(rows.join('\n'));
