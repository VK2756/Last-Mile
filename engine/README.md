# @lastmile/engine

Fastify + SSE server and the wildfire evacuation simulator. Everything here is a **simulation with synthetic people**.

## Run
```bash
pnpm install
pnpm --filter @lastmile/engine start      # http://localhost:8080
pnpm --filter @lastmile/engine test
```

## Environment variables
| var | default | meaning |
|---|---|---|
| `PORT` / `ENGINE_PORT` | `8080` | listen port |
| `ENGINE_CORS_ORIGIN` | `*` | `*` or a comma-separated list of allowed origins |
| `ENGINE_RATE_LIMIT_PER_MIN` | `60` | `POST /scenarios` per client IP |
| `ENGINE_MAX_SCENARIOS` | `300` | live scenarios held in memory (idle ones expire after 30 min) |
| `DATA_SINK` | `memory` | `real` loads `@lastmile/data` (Atlas + Tiger); falls back to memory on failure |
| `LOG_LEVEL` | `info` | structured JSON logs (pino) |

## Routes (see `ENGINE_ROUTES` in `@lastmile/contracts`)
- `GET /health`, `GET /presets` (3 curated scenarios)
- `POST /scenarios` body `ScenarioConfig` -> `{scenarioId}`; `GET /scenarios/:id/stream` SSE of `StreamEvent` (`init`, `frame` every 500 ms, `end`)
- `POST /scenarios/:id/control` `{action: pause|resume|speed, value?}`
- `POST /scenarios/:id/households/:hid/needs` body `TriageResult` (voice triage updates the live sim)

## How the simulation works
- `sim/fire.ts`: wind-driven fire on a 50 m grid. Arrival time of the fire at every cell by minimum-time propagation with seeded fuel noise; `ignitionTime(p)` is a lookup. Wind direction = bearing the wind blows toward.
- `world/population.ts`: 600 seeded synthetic households (needs mix listed in `SimInit.assumptions`), helpers, safe zones. Depends only on the seed, never on the policy, so paired runs see identical people and fire.
- `sim/engine.ts`: tick = 1 simulated second. Households go unaware, warned, (needs_help, assigned, enroute,) evacuated or trapped. `policy/alertsOnly.ts` is the baseline resident behaviour used by both policies; `policy/lastMile.ts` adds help requests. The dispatcher (Lane D) is called when something changes or every 5 sim s; the engine executes its assignments (pickup within 40 m, drop at the nearest safe zone) and rejects over-capacity or non-wheelchair-capable plans.
- `Metrics` count only households the fire reaches within 2 h ("at risk").
- `sim/headless.ts` runs the identical engine without streaming; same seed gives the same metrics as the streamed run.
- `sim/presets.ts` / `sim/presetsReport.ts`: curated scenarios and a script that prints their real headless numbers.
