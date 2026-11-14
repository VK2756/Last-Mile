# Lane A: ENGINE (simulator + dispatch + proof) — Vidhaan, Claude Code

You own the whole `engine/` package: `engine/**` (server, fire sim, population, policies, routing, dispatch, Monte Carlo, road data). Nobody else edits it. The web app (Lane B) and data/AI/QA (Lane C) only talk to you through `packages/contracts` and the HTTP routes in `ENGINE_ROUTES`.

Stack: Node 22 + TypeScript, Fastify + `@fastify/cors`, `tsx`, `vitest`. Cross-lane types only from `@lastmile/contracts`. Data only through the `DataSink` interface (`createMemorySink()` until Lane C's real sink; accept an injected sink via `DATA_SINK=real`).

You have the most work, so the order below is strict. **Never start a later item until the earlier ones are merged.** Anything marked STRETCH is cut first.

## M1 (first ~90 min): skeleton everyone plugs into. Land this FIRST.
1. `src/server.ts`: Fastify + CORS from `ENGINE_CORS_ORIGIN`. `GET /health`; `POST /scenarios` (validate with `ScenarioConfig`, return `{scenarioId}`); `GET /scenarios/:id/stream` (SSE, one `StreamEvent` JSON per `data:`; sends `init`, `frame`s, then `end`); `POST /scenarios/:id/control` (pause/resume/speed). Frames may be synthetic (`@lastmile/contracts/fixtures`) at first. Every emitted event passes `StreamEvent.parse` (assert in dev).
2. Scenario registry with TTL cleanup, graceful SSE disconnects, no unhandled rejections.
Tell Lane B and C in `docs/status/lane-a.md` the moment this is merged: Lane C deploys it to Vultr.

## M2 (by ~3pm Sat): the real simulation
3. `sim/fire.ts`: grid cellular automaton, wind-driven, seeded fuel noise, ignition from config; implements `FireModel` (`ignitionTime`, `isBurning`, `rings` simplified to at most 200 points, `burnedFraction`). Deterministic by seed.
4. `world/population.ts`: seeded synthetic households, helpers and safe zones near `RoadGraph` nodes. Explicit needs distribution (about 12% no vehicle, 6% wheelchair, 4% oxygen/medical, 8% limited English, 10% landline only). Every number goes into `SimInit.assumptions`.
5. `routing/index.ts` (`createRouter`): Dijkstra on the road graph (the synthetic `makeGridGraph` is fine for M2), edges blocked when burning at time t, smoke slowdown. Cache between ticks.
6. `dispatch/index.ts` (`createDispatcher`): households needing help get deadline = `tti - safetyMargin`; greedy insertion + simple local search; respect capacity, wheelchair capability, deadlines; flag unservable households. `Assignment.reason` is one clear sentence ("why this helper", shown live in the UI). Under 20ms per plan for 600 households (only re-plan on change).
7. `sim/engine.ts` tick loop: 1 tick = 1 simulated second at `speedMultiplier`; build `WorldSnapshot`, call the dispatcher for `last_mile`, advance helpers along routes, update statuses (`unaware` to `warned` to `needs_help` to `assigned` to `enroute` to `evacuated`/`trapped`), compute `Metrics`. Frame about every 500ms; under 50ms per tick at 600 households. Call `DataSink.recordRisk` (batched 1/s), `recordDispatch`, `recordOutcome`.
8. `policy/alertsOnly.ts` baseline: same fire, same people, no dispatch. Households with a vehicle self-evacuate after a random alert delay; others stay unless a stated-probability family-pickup rule fires. Conservative, never a strawman; document it in `assumptions`.
9. `POST /scenarios/:id/households/:hid/needs` (apply a `TriageResult`: update needs, flip to `needs_help`).
10. `sim/headless.ts`: replace the STUB `runHeadless` with a real no-stream run of the same engine code (same seed gives the same result). Ship it as early as the sim works.

## M3 (by ~9pm Sat): proof
11. `montecarlo/` plus `registerMonteCarlo(app)` mounted in `server.ts`: `POST /montecarlo` runs N seeds (default 200) for BOTH policies with **paired seeds** via `worker_threads` calling `runHeadless`. Return `MonteCarloComparison` with bootstrap 95% CIs and the paired `vulnerableLift`. Under 60s for N=200 on the Vultr box; cache the last result; provide a fast cached preset.
12. Tune the safety margin and heuristics honestly (never hard-code outcomes). Determinism proof. Remove every `STUB:` in your files.

## STRETCH (only if M3 is merged and green)
13. `engine/scripts/bake-roads.ts`: pull about a 5 km box around Amherst, MA from OSM Overpass once, write `engine/data/town-amherst.json`; `loadTown()` loads it (no runtime network). Keep `makeGridGraph` as the fallback.

## Tests (CI runs them)
Determinism (same seed gives identical final `Metrics`); every streamed event parses with `StreamEvent`; tick perf under 50ms at 600 households (loose bound); `helperCount=0` gives `last_mile` equal to `alerts_only`; headless equals streamed final metrics; no helper over capacity; non-wheelchair helper never gets a wheelchair household; `etaSeconds` at most `deadlineSeconds` or the household is flagged; routing avoids blocked edges; Monte Carlo deterministic for a fixed seed list and the CI math correct on a toy case.

## Done means
`/health` ok on the Vultr URL (Lane C deploys); the web split-screen shows two real runs of the same fire with real dispatch; `/montecarlo` returns an unedited result; headless equals streamed; no STUB markers left in `engine/`.
