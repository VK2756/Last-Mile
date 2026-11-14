# Lane D status (routing, dispatch, Monte Carlo): Rishabh, Claude Code
_Updated 2026-11-14._

**Done (pushed, PRs pending: `gh` not signed in yet):**
- `d/routing`: `createRouter(graph?, fire?, options?)` in `engine/src/routing`. Dijkstra on the road graph, roads close 60 s before the fire reaches them, smoke slows roads within 15/5 min, trees cached until an edge changes state. `routingAssumptions()` returns lines for `SimInit.assumptions`.
- `d/dispatch` (stacked on routing): `createDispatcher(options?)` in `engine/src/dispatch`. Greedy insertion + local search, enforcing capacity, wheelchair and deadline (`tti - 120 s`). Flags unservable homes via `lastUnservable()`, makes best-effort trips that still beat the fire, gives a one-sentence `reason`. 600 homes / 24 helpers: ~10 ms cold, ~5 ms warm. `dispatchAssumptions()` provided.
- `d/montecarlo` (stacked on dispatch): `registerMonteCarlo(app)` in `engine/src/montecarlo`. `POST /montecarlo` takes `{base?, runs?, seeds?}` (empty body = preset), and `GET /montecarlo/preset` returns the cached N=200 preset. Paired seeds, worker_threads pool calling `runHeadless`, bootstrap 95% CIs, paired `vulnerableLift`, in-memory cache.

**For Lane A (Vidhaan):**
- Mount it with `registerMonteCarlo(app)` in `server.ts`. It warms the preset on register.
- Build per scenario with `createRouter(loadTown(), fire)` and `createDispatcher()`, then call `plan(world)` each tick. Assignment times are relative to now. `etaSeconds`/`deadlineSeconds` are for the stop with the least slack, and `eta > deadline` only happens on flagged best-effort trips. Helpers with status `loaded`/`done` are not planned. An `enroute` helper keeps its current first pickup.
- MC results are only meaningful once the real `runHeadless` lands. Until then the response carries a WARNING assumption (identical runs).

**For Lane B (Shrish):** `/results` can call `GET /montecarlo/preset` (fast after warm-up) or `POST /montecarlo` with `{}`.

**Evidence:** `pnpm verify` green; engine tests 35/35. `pnpm exec tsx scripts/montecarlo-smoke.ts 200` (stub runHeadless, 2 workers+):
`POST /montecarlo runs=200: 295 ms (cache miss), repeat 5 ms (cache hit)`, plus the WARNING line as expected.

**Next:** open and merge the 3 PRs (needs `gh auth login`), re-time N=200 once the real sim lands, then STRETCH bake-roads.
**Blockers:** `gh` CLI not authenticated on this machine (Rishabh to run `gh auth login`).
