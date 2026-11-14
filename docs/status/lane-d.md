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

## Next
Scenario stories on real roads (lane:a preset issue), then the map alignment check with Lane B.
**Blockers:** main red (#68).
