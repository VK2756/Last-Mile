# Lane A status (SIM + SERVER, Vidhaan)

## Done (merged unless noted)
- 4-lane split docs (#1); M1 server skeleton (#2); fire model + rng + geo (#3); population (#6).
- PR "sim engine" (this one): real tick loop `sim/engine.ts`, `policy/alertsOnly.ts` + `policy/lastMile.ts`, real `runHeadless` (`sim/headless.ts`), real stream. `sim/synthetic.ts` STUB deleted.
- Evidence: `PORT=8099 pnpm start`; POST /scenarios (last_mile, seed 1) then stream: init has 600 households; frames t=120,135.. with metrics total=364 (at-risk), burnedFraction growing. Headless seed 1 alerts_only: total 364, evacuated 222, trapped 142, 130 ms per run.

- Needs endpoint merged in the next PR: `POST /scenarios/:id/households/:hid/needs` body TriageResult -> 200 {ok,status,flipped}; 404 unknown scenario/household; 400 bad body or householdId mismatch; 409 if already resolved/leaving. hasRide=false / canWalkToRoad=false / urgency>=4 flips the household to needs_help and drops its own car.

## Monte Carlo timing (mounted: POST /montecarlo, GET /montecarlo/preset; ENGINE_MC_WORKERS sets the worker count)
Real HTTP, N=200 (400 real runs, real Amherst roads), 2 workers, 12-core Mac with background load: **39.8 s** (was 56.3 s before the changes below). Cached preset: 3 ms. Result: vulnerable evacuated 45.1% -> 74.5%, paired lift +29.4 pts [28.6, 30.2].
Cost cuts (determinism kept; same seed same metrics): (1) fire model / population / graph built once per seed and shared by both policies (`sim/cache.ts`); (2) helpers are driven leg by leg timed from ONE router tree per leg instead of one query per road segment (engine router tree builds per run 2,653 -> 69); (3) re-plan cadence 3/10 s -> 6/20 s. Remaining cost is ~60% inside the dispatcher's router queries (Lane D). CPU per paired run: 587 ms -> 361 ms.

## Sensitivity: how much does the lift depend on our assumptions? (real headless, `engine/src/sim/sensitivityReport.ts`, 50 paired seeds per row)
Vulnerable households evacuated, preset base (wind 20 mph, real Amherst roads). The alerts-only column never changes: same fire, same people. Every non-default assumption is printed in SimInit.assumptions ("SENSITIVITY").
| assumption set | alerts only | Last Mile | paired lift (pts) [95% CI] | all-homes trapped (alerts -> LM) |
|---|---|---|---|---|
| headline assumptions (help known 1-3 min, 24 helpers at random nodes) | 44.2% | 74.2% | 30.0 [28.2, 31.8] | 30.4% -> 23.2% |
| help requests known 5-10 min after warning | 44.2% | 71.9% | 27.7 [26.1, 29.3] | 30.4% -> 23.7% |
| 12 helpers | 44.2% | 72.0% | 27.8 [26.4, 29.3] | 30.4% -> 23.7% |
| 6 helpers | 44.2% | 65.6% | 21.4 [19.9, 23.0] | 30.4% -> 25.2% |
| helpers start far from the fire (30% of nodes it reaches last) | 44.2% | 73.8% | 29.6 [28.1, 31.1] | 30.4% -> 23.3% |
| HARSH: 5-10 min + 12 helpers + far start | 44.2% | 68.1% | 23.9 [22.3, 25.6] | 30.4% -> 24.7% |
| HARSHEST: 5-10 min + 6 helpers + far start | 44.2% | 64.3% | 20.1 [18.7, 21.4] | 30.4% -> 25.6% |
Read: harsher assumptions cut the lift from +30 to about +20 points (6 helpers, 5-10 min request delay, far start) but never to zero, and homes trapped still fall (30.4% -> 25.6%). The request delay matters little because the fire needs about an hour to reach most homes; the number of helpers matters most. Not tested: a much faster fire, helpers that break down, wrong help requests.

## Preset results (real `runHeadless`, `engine/src/sim/presetsReport.ts`, nothing tuned)
REAL Amherst OSM roads, REAL router and Lane D's real dispatcher (#20, #23, #28+). Engine re-plans at most every 6 sim s after an event / every 20 s (cadence chosen for speed: ~430 ms per last_mile run, ~70 ms per alerts_only run, 0 rejected plans, max tick 6.5 ms). Single seed per preset, so no CIs here; /montecarlo gives those.
| preset | policy | at-risk | evacuated | trapped | vulnerable evacuated |
|---|---|---|---|---|---|
| wind-driven-run | alerts_only | 434 | 316 (72.8%) | 118 (27.2%) | 42/98 (42.9%) |
| wind-driven-run | last_mile | 434 | 346 (79.7%) | 88 (20.3%) | 72/98 (73.5%) |
| crosswind-flank | alerts_only | 465 | 411 (88.4%) | 54 (11.6%) | 51/98 (52.0%) |
| crosswind-flank | last_mile | 465 | 454 (97.6%) | 11 (2.4%) | 94/98 (95.9%) |
| slow-burn-few-helpers | alerts_only | 381 | 304 (79.8%) | 77 (20.2%) | 50/95 (52.6%) |
| slow-burn-few-helpers | last_mile | 381 | 328 (86.1%) | 53 (13.9%) | 74/95 (77.9%) |
Caveat for the pitch: dispatch assumes help requests are known 1-3 min after a warning and that helpers are available at random road nodes; both are listed in the assumptions.

## Production readiness (Vultr)
`GET /health` -> {ok, service, commit, env, scenarios, uptimeS} (commit = GIT_COMMIT env or git). One `engine started` log line lists env flag NAMES in use (never values). Entrypoint check is path-based so it works on Windows (#41). With DATA_SINK=real a successful triage is persisted via `recordTriageCall` (#36), errors are logged and never affect the sim. Vercel: https://last-mile-seven.vercel.app (Root `web`, outside-root files on, Node 22.x), mock mode until NEXT_PUBLIC_ENGINE_URL is set.

## Contract change (additive, PR `contract: ...`)
ScenarioConfig gains OPTIONAL `helperMix`, `helperCapacityScale`, `baseline{familyPickupProb, prepDelayScale, alertIssueS, urgentFamilyPickup, neighborRideProb}` (issues #69-#73). Absent = today's behaviour, results do not move. Engine support lands knob by knob right after. Everyone: run scripts/postmerge.sh.

## Knob #73 (helper fleet) merged
Stress (40 paired seeds, preset base, vulnerable evacuated): default fleet lift +30.9 [28.8, 32.9]; all-neighbour fleet (capacity 3, no wheelchair vehicles) +23.1 [21.3, 24.8]; all-neighbour with capacities x0.67 +17.8 [16.5, 19.1]. `engine/test/golden.test.ts` pins default results so no knob can move them silently.

## Knob #71 (baseline rates) merged
30 paired seeds, vulnerable evacuated, lift [95% CI]: familyPickupProb 0.25 (default) +30.9; 0.5 -> alerts 49.6%, LM 75.0%, lift +25.4 [22.9, 27.8]; 0.75 -> alerts 56.0%, LM 75.0%, lift +19.0 [17.0, 21.1]. prepDelayScale 0.5 -> +31.8 [29.3, 34.4]; 1.5 -> +31.8 [29.3, 34.4] (prep speed barely matters for the lift because the people Last Mile helps have no car).

## Knob #72 (urgent family pickup) merged
30 paired seeds, vulnerable evacuated: urgentFamilyPickup alone -> alerts 47.2%, LM 76.1%, lift +28.8 [26.2, 31.4]; urgent + familyPickupProb 0.5 -> alerts 58.1%, LM 77.0%, lift +18.9 [16.5, 21.3].

## Knob #69 (neighbours give rides) merged: the strongest baseline lever
30 paired seeds, vulnerable evacuated, lift [95% CI]: neighborRideProb 0.1 -> alerts 52.8%, LM 77.0%, lift +24.2 [21.8, 26.6]; 0.3 -> 64.9% / 77.8%, +12.9 [10.8, 15.0]; 0.5 -> 69.5% / 78.7%, +9.1 [7.6, 10.7]. Say this in the pitch: if half of all drivers voluntarily took a vehicle-less neighbour, most of the gap closes; Last Mile still helps but the margin is single digits.

## Public-server safety, load and timing (merged with a/public-safety)
- `POST /montecarlo`: one uncached batch at a time (429 + Retry-After while busy, Lane D's route), runs/seeds capped at 200 (400 above), cached preset answers in ~1 ms. Body limit 64 KB (413). Live scenarios capped at 50 (503 when full; only scenarios idle over 1 min are evicted) and deleted after 15 min idle (`ENGINE_SCENARIO_TTL_MS`). CORS: `ENGINE_CORS_ORIGIN` list used exactly (default `*`). SIGTERM closes streams and exits.
- Clean checkout (fresh `git clone`, `pnpm install --frozen-lockfile` 8 s, `NODE_ENV=production pnpm --filter @lastmile/engine start`): listening and `/health` ok after 4.1 s while the preset warm-up was still running (preset request timed out at 3 s mid warm-up, then answered from cache in ~1 ms).
- Monte Carlo N=200, wall time incl. ~5 s tsx start, on a loaded 12-core Mac (load avg 10-20): 2 workers 55 s and 45 s, 4 workers 32 s and 35 s, 12 workers ~39 s. Default is now min(4, cores-1) (`ENGINE_MC_WORKERS` overrides); a 2 vCPU box gets 1 worker.
- Load test `engine/scripts/load-sse.ts` (20 streams at 8x, 60 s, one 40-run Monte Carlo after 8 s, MC pinned to 1 worker to mimic 2 vCPU): 0 errors, first frame 1.4 s, frame gap p50 501 ms / p99 513 / max 549 (expected 500), 71 KB/s per stream, server CPU 15% avg with 20 streams, ~170% avg (peak 250%) while the batch runs, RSS 191 -> 305 MB, the batch took 17 s. No frame downsampling needed. Caveat: measured on a 12-core Mac, not a real 2 vCPU; on Vultr run `pnpm exec tsx scripts/load-sse.ts --url http://127.0.0.1:8080 --pid <pid>`.
- Presets (#81): 3 real-road stories appended after the original three (the web slices `/presets` to 3, so they need a lane:b change to show). Median-seed results: south-fire-cut-off vulnerable 8/21 -> 11/21, southeast-big-lift 9/18 -> 17/18, downtown-north-wheelchair 44/98 -> 76/98.

## /live click-through against the real engine (local, real dispatcher, real Amherst roads)
Engine on :8080 + `next dev` on :3100 with NEXT_PUBLIC_ENGINE_URL. Worked: all three presets load and stream (465/381/434 at-risk homes), 60x speed (T+9 -> T+13 in ~4 s), Pause freezes the clock, Resume continues, Restart starts a fresh paired run, a household need injected by POST .../needs flipped the home to needs_help in both scenarios, the "LIVE · ENGINE" badge and the SIMULATION badge are shown, no console errors except while the engine was down. SIGTERM: process exits in 0.15 s with open streams.
Broken: after killing and restarting the engine the page sits on RECONNECTING forever (old scenario ids 404) -> lane:b issue #126. `/presets` has 6 entries but the page slices to 3 and has 6 dead seconds of nothing at the start -> lane:b issue #127. Fixed on my side: assumption 7 said the road network is a synthetic grid; it now says the real Amherst OSM street network with synthetic households. Fixed earlier today: #114 (a home listed under two helpers) and #118 (loaded helper waiting at a cut-off safe zone).
Engine-side checks over all 6 presets (4 s frames): max helper speed 18.9 m/s (no teleporting); first helper moves at t=368-388 s (alert at 300 s); longest a home stays `assigned` before pickup is 1350-2040 s (real queueing behind 24 helpers, not a stuck state). Not verified: the household self-evacuation destination still uses the nearest safe zone even if cut off (changing it would move the baseline).

## Next
Vercel deploy, sensitivity table, full-stack click-through, Vultr readiness.

## For Lane D (Rishabh): contracts between our code (all adapters live in engine/src/sim/deps.ts)
- Router (#20) is wired: `createRouter(graph, fire)` and `routingAssumptions()` go into SimInit.assumptions. Still expecting the real `createDispatcher()` and `loadTown(town)`; adapters in `engine/src/sim/deps.ts`.
- Engine calls `dispatcher.plan(snapshot)` when something changed or every 5 sim s (not every tick), only if some household is `needs_help`/`assigned`. Treat the returned list as the COMPLETE plan: helpers missing from it have their not-yet-picked-up targets released.
- Assignment semantics I execute: `route` is followed from the helper's current position; the helper drives leg by leg to each household in the order of `householdIds`, timed by the router's own travel time (it ignores the polyline geometry except for display); after the last pickup the helper goes to the nearest safe zone if the route did not end there. Assignments with over-capacity (people, `residents`) or a wheelchair household on a non-capable helper are REJECTED (counted in sim.stats). `householdIds` may only contain `needs_help` households (or ones already assigned to that helper). Helpers that are `loaded` may be given more pickups.
- `Metrics.total` counts only households the fire reaches within 2 h ("at risk"), same for both policies.
- Household status meaning: `assigned` = a helper is dispatched to it; `enroute` = picked up, riding to the safe zone.
- Headless: `import { runHeadless, runHeadlessWith } from '../sim/headless'` (no stream, no sink, ~100 ms/run). `runHeadlessWith(config, { dispatcher, router })` lets you inject yours in tests.

## For Lane B (Shrish)
- Frames are now REAL (600 households). Wind `dirDeg` = bearing the wind blows TOWARD (90 = east). `fire.rings` is one star-shaped polygon, up to 73 points.
- `init.assumptions` is populated: show it.

## For Lane C (Anant)
- `DATA_SINK=real` loads `@lastmile/data`'s `createDataSink()` by dynamic import (falls back to memory sink on failure). It needs `@lastmile/data` as an engine dependency: I'll open a small `deps:` PR for that.
- Sink calls: recordRisk every 30 sim s (unresolved at-risk households), recordDispatch per adopted assignment, recordOutcome once at the end.
