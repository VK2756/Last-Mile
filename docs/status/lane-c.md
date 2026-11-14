# Lane C status — 2026-11-14 15:05 EST

## Merged and verified
- Data, Atlas/Tiger migration and seed, memory/real sink, Gemini triage API/fallback, risk-series API, Vultr scripts/runbook, evidence generator, and Playwright suite are on main via #5, #10, #15, #18, #22, #51. Latest observed main `15e6f35` (#57); CI passed. Required `bash scripts/postmerge.sh` was run after the merge but fails in this Windows checkout because Git gives it CRLF (#4). Full `pnpm verify` passed in clean worktree at #51 (79 engine tests, web build).
- `pnpm --filter @lastmile/data evidence` without credentials passed and wrote `not configured` for Atlas, Tiger, and compression. `.env` is ignored but absent locally; Anant said he will provide it later. Live migrate/seed/counts, real sink persistence, and Gemini-key path remain unverified.
- **Prince (Lane E):** `/api/triage` returned HTTP 200 without Gemini key. `/api/risk-series?scenarioId=demo` returned HTTP 200 with `points: []`, `source: not configured` without Tiger. Both routes are on main. `/call` UI is Lane E-owned.
- Local Playwright with engine: mock `/live`, real `/live`, completed `/call` passed; typed `/call` passed after creating a real scenario. Zero console errors in those checks. The connected `/results` test correctly fails: `POST /montecarlo` returns 404 and the page shows labelled browser sample. Added exact repro to A issue #29; this blocks real results and full e2e green.
- Freeze audit now passes all five source checks: no stub markers, SIMULATION badge on live/results/call, no hard-coded outcome percentage, no rescue promise, no tracked credential pattern. QA audit fix is in this branch. D's Windows worker fix #47 retested: 79/79 engine tests passed; closed #33.

## Next / blockers
- Run live `migrate`, `seed`, evidence and with-key API checks when ignored root `.env` arrives. User has already been asked; do not request it again.
- A: mount Monte Carlo endpoint #29 and persist triage calls #36. A Windows engine start #41 remains open. Shared script CRLF #4 and root deploy script #7 remain open.
- Public engine URL, Vultr VM IP, and Vercel URL are not available; production `/health`, CORS, full freeze gate, and production e2e are pending deployment. Runbook gives the exact SSH blocks.
