# Last Mile

Live evacuation dispatch for people who can't drive out of a wildfire or flood. Built at HackUMass XIV.

> All residents, helpers and fires in this project are **simulated**. See `docs/submission/` for the write-up.

- `engine/` simulation, routing, dispatch, Monte Carlo (deployed on Vultr)
- `web/` Next.js demo (deployed on Vercel)
- `packages/contracts` shared zod types and fixtures
- `packages/data` MongoDB Atlas + Tiger Data layer
- `packages/ai` Gemini voice triage

Contributors: read `CLAUDE.md`. Quick gate: `pnpm verify`.
