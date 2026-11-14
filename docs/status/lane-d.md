# Lane D status (ROUTING / DISPATCH / MONTE CARLO, Rishabh)
_Updated 2026-11-14 ~2:30pm._

## Done
- Routing merged (#20), dispatch merged (#23, closes #9). This PR adds Monte Carlo and a routing speed-up: road states are refreshed per 30 s window (closures can come up to 30 s early, never late), and cached trees survive unless one of their edges changed. A last_mile run went from ~1.1 s to ~0.5 s.
- `runHeadless` on main is REAL (no STUB). Every number below comes from it, unedited.

## For Lane A (Vidhaan): mount Monte Carlo in `engine/src/server.ts` (tracked in a lane:a issue)
```ts
import { registerMonteCarlo } from './montecarlo';
// inside buildServer(), after the other routes and before `return app`:
registerMonteCarlo(app, { warmPreset: process.env.NODE_ENV !== 'test' });
```
- Adds `POST /montecarlo` (body `{ base?, runs?=200, seeds? }`; `{}` = the preset) and `GET /montecarlo/preset`. Both return `MonteCarloComparison`.
- Runs one uncached batch at a time (others get 429 + Retry-After), caches the last 8 results, and aborts a running batch on `app.close()`. With `warmPreset` on, the N=200 preset starts computing at boot.
- Checked for real: `scripts/montecarlo-smoke.ts` mounts it on `buildServer()` over HTTP. `/health` ok; POST runs=200 took 11.9 s (cache miss) and 4 ms on repeat; `GET /montecarlo/preset` took 1 ms (cache hit).

## Timing, N=200 paired (400 real runs), Intel Core Ultra 5 225H laptop
| workers | wall |
|---|---|
| 14 (default = all cores) | 10.8-11.9 s |
| 4 | 21.0 s |
| 2 | 45.7 s |
About 0.55 CPU-seconds per seed pair. Most of a last_mile run is the dispatcher and router (Lane D), not the sim loop. **For Lane C:** a 2-vCPU Vultr VM is borderline for 60 s; 4 vCPU is comfortable. The preset is cached either way.

## Monte Carlo results (`pnpm exec tsx scripts/montecarlo-cli.ts ...`, real sim, nothing tuned)
Vulnerable evacuated rate, mean [95% CI], and the paired lift:
| config | seeds | alerts_only | last_mile | lift (pts) |
|---|---|---|---|---|
| preset: wind 20 mph @90, 24 helpers | 1-200 | 47.3% [46.6, 48.1] | 79.4% [78.7, 80.1] | +32.1 [31.4, 32.8] |
| preset | 1001-1200 | 47.8% [47.2, 48.5] | 79.6% [78.8, 80.3] | +31.7 [31.0, 32.5] |
| preset | 5001-5200 | 47.3% [46.7, 48.0] | 79.2% [78.5, 79.9] | +31.8 [31.1, 32.6] |
| wind 10 mph @270, 12 helpers | 1-200 | 55.3% [54.7, 56.0] | 90.2% [89.7, 90.6] | +34.8 [34.2, 35.5] |
| wind 35 mph @45, 6 helpers | 1-200 | 36.7% [35.9, 37.4] | 56.9% [56.0, 57.7] | +20.2 [19.5, 20.9] |
| wind 35 mph @45, 48 helpers | 1-200 | 36.7% [35.9, 37.4] | 63.0% [62.1, 63.8] | +26.3 [25.5, 27.1] |
| sanity: 0 helpers | 1-50 | 46.0% [44.5, 47.4] | 46.0% [44.5, 47.4] | +0.0 [0.0, 0.0] |
All homes evacuated (preset, seeds 1-200): alerts_only 74.6%, last_mile 82.3%. Last Mile won in every config tried. The gain shrinks in fast fires with few helpers, and a fast fire caps it even with 48 helpers (63%). These numbers depend on Lane A's behaviour model (who asks for help, alert delays) as much as on dispatch.

## Dispatch quality (`scripts/unservable-report.ts`, 20 seeds, 24 helpers)
74 homes/run needed help; 34/run (46%) were flagged unservable at least once, mostly temporarily (28 of those 34 were evacuated in the end, 5.5 were trapped). Last reasons: "no helper before the safety deadline" 30/run, "roads cut off by fire" 4/run. Next PR: say when a home is waiting only because every capable helper is busy, and let busy helpers add best-effort pickups after their current trip.

## Next
Dispatch-quality PR (measured before/after), then item 13 (Amherst OSM roads).
**Blockers:** none.
