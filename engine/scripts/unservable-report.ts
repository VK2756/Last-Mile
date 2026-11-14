// OWNER: Lane D. How often does the dispatcher flag homes as unservable in the real sim, why, and
// what happened to them in the end? Usage (from engine/): pnpm exec tsx scripts/unservable-report.ts [seeds=20] [helpers=24]
import { ScenarioConfig, isVulnerable } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { createSim } from '../src/sim/engine';
import { createDispatcher } from '../src/dispatch/index';

const seeds = Number(process.argv[2] ?? 20);
const helpers = Number(process.argv[3] ?? 24);
const category = (reason: string) => reason.replace(/\(.*?\)/g, '').replace(/; a best-effort.*$/, '').replace(/\d+(\.\d+)?/g, 'N').replace(/\.$/, '').trim();

let needHelp = 0, everFlagged = 0, flaggedEvac = 0, flaggedTrapped = 0, bestEffortTrips = 0, unflaggedTrapped = 0;
const reasons = new Map<string, number>();
for (let seed = 1; seed <= seeds; seed++) {
  const config = ScenarioConfig.parse({ ...sampleInit.config, helperCount: helpers, seed, policy: 'last_mile' });
  const inner = createDispatcher();
  const lastReason = new Map<string, string>();
  const askedForHelp = new Set<string>();
  const beHomes = new Set<string>();
  const dispatcher = {
    plan: (w: Parameters<typeof inner.plan>[0]) => {
      for (const [id, s] of Object.entries(w.householdStates)) if (s.status === 'needs_help' || s.status === 'assigned') askedForHelp.add(id);
      const out = inner.plan(w);
      for (const u of inner.lastUnservable()) { lastReason.set(u.householdId, u.reason); if (u.bestEffort) beHomes.add(u.householdId); }
      return out;
    },
  };
  const sim = createSim(config, `unservable-${seed}`, { dispatcher });
  while (!sim.done) sim.advance(600);
  const final = new Map(sim.frame().households.map((h) => [h.id, h.status]));
  needHelp += askedForHelp.size;
  bestEffortTrips += beHomes.size;
  for (const id of askedForHelp) {
    const st = final.get(id);
    if (lastReason.has(id)) {
      everFlagged++;
      if (st === 'evacuated') flaggedEvac++;
      if (st === 'trapped') flaggedTrapped++;
      const c = category(lastReason.get(id)!);
      reasons.set(c, (reasons.get(c) ?? 0) + 1);
    } else if (st === 'trapped') unflaggedTrapped++;
  }
}
const per = (x: number) => (x / seeds).toFixed(1);
console.log(`${seeds} seeds, ${helpers} helpers, last_mile`);
console.log(`homes that needed help: ${per(needHelp)}/run; flagged unservable at least once: ${per(everFlagged)}/run (${((100 * everFlagged) / Math.max(1, needHelp)).toFixed(1)}%)`);
console.log(`  of flagged: evacuated ${per(flaggedEvac)}/run, trapped ${per(flaggedTrapped)}/run; homes given a best-effort trip: ${per(bestEffortTrips)}/run`);
console.log(`never-flagged homes that still ended trapped: ${per(unflaggedTrapped)}/run`);
console.log('last reason given for flagged homes:');
for (const [c, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${per(n).padStart(6)}/run  ${c}`);
void isVulnerable;
