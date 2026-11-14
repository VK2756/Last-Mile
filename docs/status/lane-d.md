# Lane D status (ROUTING / DISPATCH / MONTE CARLO, Rishabh)
_Updated 2026-11-14 ~3:30pm._

## Merged
#20 routing, #23 dispatch, #28 Monte Carlo, #35 dispatch reasons, #43 real Amherst roads (stub markers removed; closed #45), #47 Windows worker fix (#33 open until Lane C retests).

## Open PRs (all blocked only by main being red: #68, a Lane A test regex)
- #66 Monte Carlo ~2x cheaper. Exact: same results as main. Per seed pair 544 -> ~220-256 ms single thread; N=200 on 2 workers 50.4 s -> 23-30 s wall on this laptop.
- #75 fuzz invariants: 300 random public configs on real roads, 0 failures (routes avoid burning ground, capacity and wheelchair rules hold, ETAs >= 0, terminates, deterministic). 3 seeds run in CI.
- #76 baseline fairness review (this file's update rides with it).

## For Lane E (Prince): please link `docs/submission/BASELINE_REVIEW.md`
It answers "is alerts-only a strawman?": 20 harsher configs from the public knobs only, 100 paired seeds each. Last Mile wins in all of them, but **by only ~6 pts with a single helper**, and fast fires cap it at ~52% vulnerable evacuated. It suggests one honest pitch sentence. The missing baseline behaviours are filed for Lane A: #69 neighbours give rides, #71 self-evacuation and family-pickup rates, #72 smarter family pickup, #73 fleet capacity and mix.

## For Lane A (Vidhaan)
- Mount Monte Carlo (issue #29): `import { registerMonteCarlo } from './montecarlo';` then `registerMonteCarlo(app, { warmPreset: process.env.NODE_ENV !== 'test' });` inside `buildServer()` before `return app`.
- #68: `sim.test.ts:101` regex `/SENSITIVITY: helpers .* far from the fire/` can't match "(far from the fire)". Drop the space before `far`.

## Monte Carlo on real Amherst roads (preset, 200 paired seeds)
Vulnerable evacuated 45.1% -> 72.5%, lift +27.4 pts [26.6, 28.2]; all homes 69.7% -> 76.2%. Full stress table in BASELINE_REVIEW.md.

## Scenario stories on real roads (`scripts/find-stories.ts`; exact configs in #81 for presets)
These came out of searching 36 ignition x wind settings x 4 seeds. Each seed is the median-lift seed of 10, not the best. All use 24 helpers and 20 mph wind.
1. **south-fire-cut-off** (seed 4, ignition 42.36242,-72.5199, wind toward 180): burning roads cut homes off (~7 per run flagged "fire has cut off the roads", the most of any setting). Vulnerable 8/21 -> 11/21 (+14; +8 to +31 over 10 seeds). This is where Last Mile struggles, and the demo should say so.
2. **southeast-big-lift** (seed 10, ignition 42.36242,-72.505309, wind toward 180): vulnerable 9/18 -> 17/18 (+44; +14 to +60), trapped 15 -> 7.
3. **downtown-north-wheelchair** (seed 7, ignition 42.3732,-72.5199, wind toward 0): vulnerable 44/98 -> 76/98 (+33), trapped 124 -> 92, but ~5.5 wheelchair homes per run are still trapped without a capable vehicle (waits up to ~12 min).

## Map alignment (checked, no Lane B issue needed)
`scripts/check-map-alignment.ts`, 5 seeds of real engine output vs the baked Amherst roads:
- homes are a median 13 m from the nearest road segment (max ~48 m, house setbacks); helpers and safe zones sit exactly on road nodes
- 6-12 of 600 homes per seed sit just outside the baked box (by <= 35 m)
- fire rings are in `[lng, lat]` order and enclose the ignition point; route vertices are on roads, except the stop points at homes
- visually, the baked roads drawn over the same OpenFreeMap/OSM basemap the web uses sit exactly on the streets (Spring St, College St, Northampton Rd, Lincoln Ave), with homes along them. The web code converts `{lat, lng}` to `[lng, lat]` correctly everywhere I looked (`web/lib/geo.ts`).

## Next
Merge #66, #75, #76, #82 once main is green (#68). Re-time Monte Carlo on the Vultr box.
**Blockers:** main red (#68).
