// OWNER: Lane D. Splits one headless run's wall time into dispatcher / router / everything else, and
// counts shortest-path tree work. Usage (from engine/): pnpm exec tsx scripts/profile-run.ts [seeds=5]
import { ScenarioConfig } from '@lastmile/contracts';
import type { Router } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { runHeadlessWith } from '../src/sim/headless';
import { createFireModel } from '../src/sim/fire';
import { createDispatcher } from '../src/dispatch/index';
import { createRouter } from '../src/routing/index';
import { loadTown } from '../src/world/town';

const seeds = Number(process.argv[2] ?? 5);
type Acc = { wall: number; plan: number; route: number; calls: number; plans: number; trees: number; hits: number; versions: number; simCalls: number; planTrees: number };
const zero = (): Acc => ({ wall: 0, plan: 0, route: 0, calls: 0, plans: 0, trees: 0, hits: 0, versions: 0, simCalls: 0, planTrees: 0 });
const tot = { alerts_only: zero(), last_mile: zero() };
for (let seed = 1; seed <= seeds; seed++) {
  for (const policy of ['alerts_only', 'last_mile'] as const) {
    const config = ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24, seed, policy });
    const acc = tot[policy];
    const graphRouter = createRouter(loadTown(config.town), createFireModel(config));
    let inPlan = false;
    // count router calls made by the sim itself (outside dispatcher.plan)
    const router: Router = {
      travelSeconds: (a, b, t) => { if (!inPlan) acc.simCalls++; return graphRouter.travelSeconds(a, b, t); },
      route: (a, b, t) => { if (!inPlan) acc.simCalls++; return graphRouter.route(a, b, t); },
    };
    const inner = createDispatcher();
    let routeMs = 0;
    const dispatcher = {
      plan: (w: Parameters<typeof inner.plan>[0]) => {
        const r = w.router;
        const timed: Router = {
          travelSeconds: (a, b, t) => { const s = performance.now(); const v = r.travelSeconds(a, b, t); routeMs += performance.now() - s; acc.calls++; return v; },
          route: (a, b, t) => { const s = performance.now(); const v = r.route(a, b, t); routeMs += performance.now() - s; acc.calls++; return v; },
        };
        inPlan = true;
        const b0 = graphRouter.stats().treeBuilds;
        const s = performance.now();
        const out = inner.plan({ ...w, router: timed });
        acc.plan += performance.now() - s;
        inPlan = false;
        acc.planTrees += graphRouter.stats().treeBuilds - b0;
        acc.plans++;
        return out;
      },
    };
    const t0 = performance.now();
    await runHeadlessWith(config, { dispatcher, router });
    acc.wall += performance.now() - t0;
    acc.route += routeMs;
    const st = graphRouter.stats();
    acc.trees += st.treeBuilds; acc.hits += st.treeHits; acc.versions += st.version;
  }
}
const per = (x: number) => (x / seeds).toFixed(0);
for (const [policy, a] of Object.entries(tot)) {
  console.log(`${policy.padEnd(11)} per run: wall ${per(a.wall)} ms, dispatcher ${per(a.plan)} ms (router ${per(a.route)} ms), other ${per(a.wall - a.plan)} ms; ` +
    `${per(a.plans)} plans, ${per(a.calls)} dispatcher router calls, ${per(a.simCalls)} sim router calls; ` +
    `${per(a.trees)} tree builds (${per(a.planTrees)} inside plan), ${per(a.hits)} tree hits, ${per(a.versions)} road-state versions`);
}
