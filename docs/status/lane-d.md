# Lane D status (ROUTING / DISPATCH / MONTE CARLO, Rishabh)
_Updated 2026-11-14 ~2:40pm._

## Done (merged)
#20 routing, #23 dispatch (closes #9), #28 Monte Carlo + routing speed-up, #35 clearer unservable reasons.
**This PR: item 13, the real Amherst roads.** `loadTown('amherst')` now reads `engine/data/town-amherst.json` from disk: OSM, 5 km box, 710 nodes, 1,507 directed edges, 185 one-way ways, largest strongly connected component only. It is baked once by `scripts/bake-roads.ts` with no runtime network; `synthetic_grid`/`paradise_like`, or a missing file, fall back to `makeGridGraph`. The router only snaps to the largest strongly connected component, so trips never start on an island. No `STUB:` markers are left in Lane D files.

## For Lane A (Vidhaan): mount Monte Carlo (issue #29)
```ts
import { registerMonteCarlo } from './montecarlo';
// inside buildServer(), after the other routes and before `return app`:
registerMonteCarlo(app, { warmPreset: process.env.NODE_ENV !== 'test' });
```
This adds `POST /montecarlo` (`{ base?, runs?=200, seeds? }`; `{}` = preset) and `GET /montecarlo/preset`. It runs one uncached batch at a time (429 otherwise), caches results, and aborts a running batch on close. Checked over real HTTP against `buildServer()` with `scripts/montecarlo-smoke.ts`.
**Heads-up:** with real roads, `amherst` scenarios now use OSM streets. Fewer homes are at risk (about 270 instead of 364 for seed 1) and routes follow real streets. 78/78 engine tests pass, and the real sim shows 0 rejected assignments.

## Monte Carlo on REAL Amherst roads (real runHeadless, `scripts/montecarlo-cli.ts`, nothing tuned)
Vulnerable evacuated rate, mean [95% CI], and the paired lift:
| config | seeds | alerts_only | last_mile | lift (pts) |
|---|---|---|---|---|
| preset: wind 20 mph @90, 24 helpers | 1-200 | 45.1% [44.2, 45.9] | 72.5% [71.6, 73.3] | +27.4 [26.6, 28.2] |
| preset | 1001-1200 | 44.8% [43.9, 45.8] | 71.7% [70.8, 72.6] | +26.8 [25.9, 27.7] |
| wind 10 mph @270, 12 helpers | 1-200 | 55.7% [54.9, 56.4] | 85.1% [84.4, 85.9] | +29.5 [28.8, 30.2] |
| wind 35 mph @45, 6 helpers | 1-200 | 36.7% [35.9, 37.4] | 51.3% [50.5, 52.1] | +14.7 [14.1, 15.2] |
| wind 35 mph @45, 48 helpers | 1-200 | 36.7% [35.9, 37.4] | 62.0% [61.2, 62.8] | +25.4 [24.6, 26.0] |
| sanity: 0 helpers | 1-50 | equal | equal | +0.0 [0.0, 0.0] |
All homes evacuated (preset): 69.7% vs 76.2%. Last Mile wins in every config. The lift is smaller on real roads than on the synthetic grid (grid preset was +32.1), smallest in fast fires with few helpers, and a fast fire caps it even with 48 helpers.

## Timing, N=200 (400 real runs), real roads, Intel Core Ultra 5 225H
All 14 cores: 13.4 s. 2 workers: 50.4 s. **For Lane C:** a 2-vCPU Vultr VM is borderline for 60 s, so use 4 vCPU if possible. The preset is cached and warmed at boot either way.

## Dispatch quality (`scripts/unservable-report.ts`, 20 seeds, grid)
46% of homes needing help are flagged at least once, mostly because every capable helper is busy (28 of 34 per run), not because they are too far. Most of them are evacuated later. I tried letting busy helpers add best-effort pickups after their trip: no gain (32.2 -> 32.0 pts) and more trapped homes that were never flagged, so I didn't keep it.

## Next
Re-time on the Vultr box once Lane C deploys; watch `gh issue list --label lane:d`. **Blockers:** none.
