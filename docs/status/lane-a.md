# Lane A status (SIM + SERVER, Vidhaan)

## Done
- 4-lane split docs merged (PR #1).
- M1 server skeleton: `engine/src/server.ts` (Fastify + CORS via ENGINE_CORS_ORIGIN, PORT/ENGINE_PORT, default 8080), `sim/registry.ts` (scenario registry, TTL sweep, SSE fan-out), `sim/synthetic.ts` (STUB runner replaying contract fixtures).
- Routes: GET /health, POST /scenarios, GET /scenarios/:id/stream (SSE init, frames every 500ms wall, end), POST /scenarios/:id/control (pause/resume/speed). Every event is StreamEvent.parse'd before send.
- Evidence: `PORT=8099 pnpm start`; curl /health -> {"ok":true,...}; POST /scenarios -> sc-2bdd3f86; stream gave init then frames t=4,8,12... (speed 8).

## Next
fire.ts, population.ts, real tick loop (sim/engine.ts), alertsOnly policy, needs endpoint, real runHeadless.

## For other lanes
- Lane C: engine is deployable now: `pnpm --filter @lastmile/engine start`, env PORT, ENGINE_CORS_ORIGIN. Frames are SYNTHETIC until M2.
- Lane B: frames currently carry fixture data (3 households); real data arrives with M2. Contract unchanged.
- Lane D: mount `registerMonteCarlo(app)` will go in server.ts when you ship it; runHeadless is still a STUB.
