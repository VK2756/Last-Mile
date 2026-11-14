# Lane C status

Data/deploy #5, voice #10, QA #15, submission #18, hardening #22, status #30 merged. Latest main Linux CI is green. Clean Windows worktree `pnpm verify` fails in Lane D Monte Carlo worker test (#33); 70 engine tests pass, 1 fails loading `worker.ts`. Required `bash scripts/postmerge.sh` still fails on CRLF checkout (#4).

## Task list
- [x] Data sink with memory fallback, buffered Atlas/Tiger writes, query helpers, unit tests
- [x] Tiger migration, Atlas collections/seed code; live credentials pending
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands; restricted service restart added; VM/domain pending
- [x] Gemini triage, API route and `/call` voice/typed flow with fallback
- [ ] QA integration: mock and real `/live`, plus a completed real-engine `/call`, pass in Chromium; `/results` pending
- [ ] Submission drafts/evidence checklist; local 200-seed Monte Carlo captured; sponsor and deployment evidence pending

## Evidence and integration
- `pnpm --filter @lastmile/data typecheck` passed; `pnpm --filter @lastmile/data test` passed 2/2. Migration policies now use `if_not_exists`; no Tiger connection yet.
- Live `POST /api/triage` returned a valid fallback result. `pnpm exec playwright test -g 'call screen' --reporter=line` passed 1/1 in Chromium with zero console errors.
- `pnpm exec playwright test -g 'mock live view|call screen' --reporter=line` passed 2/2 in Chromium, zero console errors. With a local real engine, real `/live` passed 1/1 and a completed `/call` updated its scenario (HTTP 200, 1/1). `/results` confidence intervals await Lane B M3; #13 tracks the web e2e script.
- `pnpm --filter @lastmile/engine exec tsx scripts/montecarlo-cli.ts --runs 200 --workers 0` completed in 32.1s; paired vulnerable lift 32.2 percentage points [31.6, 33.0]. Full output and simulation caveat in `docs/submission/evidence/montecarlo-local.md`.
- Lane A added `upsertWorld` in #24 (#17 closed). Monte Carlo routes remain unmounted (#29, GET preset 404). Successful triage never persists `triage_calls` (#36). Engine `start` exits without listening on Windows (#41); local integration used `buildServer().listen()`. Shared deploy script #7 and demo claims #16 remain open. No Lane C issues open.
- No DB credentials, production URL, Vultr host, or domain yet; cannot verify live Atlas/Tiger, production health, or hostnames. User will provide DB credentials when available.
