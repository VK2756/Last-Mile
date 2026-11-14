# Lane C status

Data/deploy #5, voice #10, QA #15, submission #18, hardening #22, status #30 merged. Latest main Linux CI is green. Clean Windows worktree `pnpm verify` now fails in Lane D Monte Carlo worker test (#33); 68 engine tests pass, 1 fails loading `worker.ts`. Required `bash scripts/postmerge.sh` still fails on CRLF checkout (#4).

## Task list
- [x] Data sink with memory fallback, buffered Atlas/Tiger writes, query helpers, unit tests
- [x] Tiger migration, Atlas collections/seed code; live credentials pending
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands; restricted service restart added; VM/domain pending
- [x] Gemini triage, API route and `/call` voice/typed flow with fallback
- [ ] QA integration: mock split maps and `/call` pass in Chromium; `/results` and real engine pending
- [ ] Submission drafts/evidence checklist; real Monte Carlo, sponsor and deployment evidence pending

## Evidence and integration
- `pnpm --filter @lastmile/data typecheck` passed; `pnpm --filter @lastmile/data test` passed 2/2. Migration policies now use `if_not_exists`; no Tiger connection yet.
- Live `POST /api/triage` returned a valid fallback result. `pnpm exec playwright test -g 'call screen' --reporter=line` passed 1/1 in Chromium with zero console errors.
- `pnpm exec playwright test -g 'mock live view|call screen' --reporter=line` passed 2/2 in Chromium, zero console errors. Full suite still has `/results` confidence intervals pending Lane B M3 and real engine skipped; #13 also tracks missing web e2e script.
- Lane A added the `upsertWorld` hook in #24 and closed #17 (live Atlas verification pending). Lane D Monte Carlo code landed in #29, but A server does not mount its routes: GET `/montecarlo/preset` returns 404 (#31). Shared deploy script #7 and unverified demo claims #16 remain open. No Lane C issues open.
- No DB credentials, production URL, Vultr host, or domain yet; cannot verify live Atlas/Tiger, production health, or hostnames. User will provide DB credentials when available.
