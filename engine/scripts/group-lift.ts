// OWNER: Lane D. Where does the Last Mile lift come from? Breaks the evacuated rate down by household group,
// for both policies, under three baselines, on the same paired seeds as the headline (1-200).
// Groups are exclusive, assigned in this order:
//   1. wheelchair            needs include 'wheelchair' (the model has no separate "limited mobility" need)
//   2. alone + medical need  1 resident with oxygen, dementia, medical device or vision impairment
//                            (closest proxy for "elderly alone": the model has no age field)
//   3. no car, none nearby   no vehicle, and no household with a vehicle within NEIGHBOR_RIDE_RADIUS_M (300 m)
//   4. no car, car nearby    no vehicle, at least one household with a vehicle within 300 m
//   5. everyone else         has a vehicle and is in none of the groups above
// Only households the fire reaches within the horizon are counted (same rule as Metrics).
// Usage (from engine/): pnpm exec tsx scripts/group-lift.ts [runs=200] [seedStart=1]
import { ScenarioConfig } from '@lastmile/contracts';
import type { Household } from '@lastmile/contracts';
import { createSim, HORIZON_S } from '../src/sim/engine';
import { createFireModel } from '../src/sim/fire';
import { NEIGHBOR_RIDE_RADIUS_M } from '../src/policy/alertsOnly';
import { BaseConfig, PRESET_BASE } from '../src/montecarlo/index';
import { bootstrapMean } from '../src/montecarlo/stats';

const runs = Number(process.argv[2] ?? 200);
const seedStart = Number(process.argv[3] ?? 1);
const GROUPS = ['wheelchair', 'alone + medical need', 'no car, none within 300 m', 'no car, car within 300 m', 'everyone else'] as const;
type Group = (typeof GROUPS)[number];
const ALONE_NEEDS = new Set(['oxygen', 'dementia', 'medical_device', 'vision_impaired']);

const generous = { neighborRideProb: 0.6, familyPickupProb: 0.5, urgentFamilyPickup: true, prepDelayScale: 0.5, alertIssueS: 0 };
const baselines: { label: string; base: BaseConfig }[] = [
  { label: 'preset defaults', base: PRESET_BASE },
  { label: '30% neighbour rides', base: BaseConfig.parse({ ...PRESET_BASE, baseline: { neighborRideProb: 0.3 } }) },
  { label: 'everything generous at once', base: BaseConfig.parse({ ...PRESET_BASE, baseline: generous }) },
];

function metres(a: Household['position'], b: Household['position']): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * 111_320, (a.lng - b.lng) * 111_320 * k);
}

function groupsOf(hh: Household[]): Map<string, Group> {
  const cars = hh.filter((h) => h.hasVehicle);
  const out = new Map<string, Group>();
  for (const h of hh) {
    let g: Group;
    if (h.needs.includes('wheelchair')) g = 'wheelchair';
    else if (h.residents === 1 && h.needs.some((n) => ALONE_NEEDS.has(n))) g = 'alone + medical need';
    else if (!h.hasVehicle) g = cars.some((c) => metres(c.position, h.position) <= NEIGHBOR_RIDE_RADIUS_M) ? 'no car, car within 300 m' : 'no car, none within 300 m';
    else g = 'everyone else';
    out.set(h.id, g);
  }
  return out;
}

interface Tally { n: number; evac: number }
function runOne(config: ScenarioConfig): Map<Group, Tally> {
  const sim = createSim(config, `group-${config.seed}-${config.policy}`);
  const fire = createFireModel(config);
  const groups = groupsOf(sim.init.households);
  const atRisk = new Set(sim.init.households.filter((h) => fire.ignitionTime(h.position) <= HORIZON_S).map((h) => h.id));
  while (!sim.done) sim.advance(600);
  const t = new Map<Group, Tally>(GROUPS.map((g) => [g, { n: 0, evac: 0 }]));
  for (const h of sim.frame().households) {
    if (!atRisk.has(h.id)) continue;
    const x = t.get(groups.get(h.id)!)!;
    x.n++; if (h.status === 'evacuated') x.evac++;
  }
  return t;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const t0 = performance.now();
console.log(`seeds ${seedStart}-${seedStart + runs - 1}, paired; groups exclusive in the order listed\n`);
for (const { label, base } of baselines) {
  const per = new Map<Group, { n: number; ao: number; lm: number; diffs: number[] }>(GROUPS.map((g) => [g, { n: 0, ao: 0, lm: 0, diffs: [] }]));
  for (let seed = seedStart; seed < seedStart + runs; seed++) {
    const ao = runOne(ScenarioConfig.parse({ ...base, seed, policy: 'alerts_only' }));
    const lm = runOne(ScenarioConfig.parse({ ...base, seed, policy: 'last_mile' }));
    for (const g of GROUPS) {
      const a = ao.get(g)!, l = lm.get(g)!, p = per.get(g)!;
      if (a.n !== l.n) throw new Error(`seed ${seed} ${g}: at-risk counts differ between policies (${a.n} vs ${l.n})`);
      p.n += a.n; p.ao += a.evac; p.lm += l.evac;
      if (a.n) p.diffs.push((l.evac - a.evac) / a.n);
    }
  }
  const extra = GROUPS.reduce((s, g) => s + per.get(g)!.lm - per.get(g)!.ao, 0);
  console.log(`### ${label}`);
  console.log(`| group | at-risk homes per run | alerts-only evac | Last Mile evac | lift, pts [95% CI] | share of Last Mile's extra evacuations |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const g of GROUPS) {
    const p = per.get(g)!;
    if (!p.n) { console.log(`| ${g} | 0 | n/a | n/a | n/a | 0% |`); continue; }
    const ci = bootstrapMean(p.diffs);
    console.log(`| ${g} | ${(p.n / runs).toFixed(1)} | ${pct(p.ao / p.n)} | ${pct(p.lm / p.n)} | ${(ci.mean * 100).toFixed(1)} [${(ci.ci95[0] * 100).toFixed(1)}, ${(ci.ci95[1] * 100).toFixed(1)}] | ${pct((p.lm - p.ao) / extra)} |`);
  }
  console.log(`(Last Mile evacuates ${((extra) / runs).toFixed(1)} more at-risk homes per run in total)\n`);
}
console.log(`${((performance.now() - t0) / 1000).toFixed(0)} s`);
