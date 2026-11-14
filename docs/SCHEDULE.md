# Schedule (all times EST). Deadline: Sun 15 Nov, 10:00am. Freeze is early on purpose.

| When | Milestone | Gate |
|---|---|---|
| Sat 3:00-5:00am | **M0 Setup**: starter pack on GitHub, 3 agents running in their own clones, accounts created | each agent has run `pnpm verify` green |
| Sat by 10:00am | **M1 Skeleton**: A: /health + SSE merged. B: `/live?mock=1` on Vercel + UI kit. C: data package + migrations + Vultr scripts, engine deployed over HTTPS | `/health` ok, Vercel URL loads, CI green |
| Sat by 4:00pm | **M2 Real thing**: real fire + routing + dispatch; split-screen against the real engine; Atlas + Tiger receiving data; triage endpoint works | end-to-end demo run, no console errors |
| Sat by 10:00pm | **M3 Proof**: Monte Carlo + `/results`; `/call` updates the map; sponsor evidence collected | full 3-min demo rehearsed once |
| Sun 2:00am | **FEATURE FREEZE**: only bug fixes from here. Nothing new merges without the manager OK | main green, production = main |
| Sun 2:00-4:30am | Record video, finalize Devpost + SPONSORS.md, domain live | video uploaded |
| Sun by 7:00am | **SUBMIT on Devpost** (3-hour safety margin) with all prize opt-ins | confirmation screenshot |
| Sun 7:00-9:30am | DEV post, rehearse live demo, charge laptops, offline fallback ready (`?mock=1`) | |

If a milestone slips by more than 90 minutes, tell the manager chat immediately: we cut scope, we never cut the freeze.
Sleep in shifts. The one rule: main stays green while you sleep (`pnpm watch` on a spare terminal).
