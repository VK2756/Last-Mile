# Lane A status (SIM + SERVER, Vidhaan)

## Done (merged unless noted)
- 4-lane split docs (#1); M1 server skeleton (#2); fire model + rng + geo (#3); population (#6).
- PR "sim engine" (this one): real tick loop `sim/engine.ts`, `policy/alertsOnly.ts` + `policy/lastMile.ts`, real `runHeadless` (`sim/headless.ts`), real stream. `sim/synthetic.ts` STUB deleted.
- Evidence: `PORT=8099 pnpm start`; POST /scenarios (last_mile, seed 1) then stream: init has 600 households; frames t=120,135.. with metrics total=364 (at-risk), burnedFraction growing. Headless seed 1 alerts_only: total 364, evacuated 222, trapped 142, 130 ms per run.

## Next
needs endpoint (POST /scenarios/:id/households/:hid/needs), mount registerMonteCarlo(app) when Lane D ships, tuning pass, determinism proof test for CI.

## For Lane D (Rishabh): contracts between our code (all adapters live in engine/src/sim/deps.ts)
- Please export `createRouter(graph: RoadGraph, fire: FireModel): Router`, `createDispatcher(): Dispatcher`, `loadTown(town: ScenarioConfig['town']): RoadGraph`. Today your stubs take no args; I call them through casts so nothing breaks either way.
- Engine calls `dispatcher.plan(snapshot)` when something changed or every 5 sim s (not every tick), only if some household is `needs_help`/`assigned`. Treat the returned list as the COMPLETE plan: helpers missing from it have their not-yet-picked-up targets released.
- Assignment semantics I execute: `route` is followed from the helper's current position; pickup happens within 40 m of a household; after the last pickup the helper goes to the nearest safe zone if the route did not end there. Assignments with over-capacity (people, `residents`) or a wheelchair household on a non-capable helper are REJECTED (counted in sim.stats). `householdIds` may only contain `needs_help` households (or ones already assigned to that helper). Helpers that are `loaded` may be given more pickups.
- `Metrics.total` counts only households the fire reaches within 2 h ("at risk"), same for both policies.
- Household status meaning: `assigned` = a helper is dispatched to it; `enroute` = picked up, riding to the safe zone.
- Headless: `import { runHeadless, runHeadlessWith } from '../sim/headless'` (no stream, no sink, ~100 ms/run). `runHeadlessWith(config, { dispatcher, router })` lets you inject yours in tests.

## For Lane B (Shrish)
- Frames are now REAL (600 households). Wind `dirDeg` = bearing the wind blows TOWARD (90 = east). `fire.rings` is one star-shaped polygon, up to 73 points.
- `init.assumptions` is populated: show it.

## For Lane C (Anant)
- `DATA_SINK=real` loads `@lastmile/data`'s `createDataSink()` by dynamic import (falls back to memory sink on failure). It needs `@lastmile/data` as an engine dependency: I'll open a small `deps:` PR for that.
- Sink calls: recordRisk every 30 sim s (unresolved at-risk households), recordDispatch per adopted assignment, recordOutcome once at the end.
