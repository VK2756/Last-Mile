# Lane C status

Branch: `c/migration-hardening`. Data/deploy #5, voice #10, QA #15, submission #18 merged. Main CI after Lane B M1 #19 is green. Local Windows `pnpm verify` is red in Next `/404` prerender (#21); typecheck, lint, tests pass. Required `bash scripts/postmerge.sh` fails on CRLF checkout (#4).

## Task list
- [x] Data sink with memory fallback, buffered Atlas/Tiger writes, query helpers, unit tests
- [x] Tiger migration, Atlas collections/seed code; live credentials pending
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands; restricted service restart added; VM/domain pending
- [x] Gemini triage, API route and `/call` voice/typed flow with fallback
- [ ] QA integration: Playwright suite exists; `/call` passes; split maps and results pending Lane B
- [ ] Submission drafts/evidence checklist; real Monte Carlo, sponsor and deployment evidence pending

## Evidence and integration
- `pnpm --filter @lastmile/data typecheck` passed; `pnpm --filter @lastmile/data test` passed 2/2. Migration policies now use `if_not_exists`; no Tiger connection yet.
- Live `POST /api/triage` returned a valid fallback result. `pnpm exec playwright test -g 'call screen' --reporter=line` passed 1/1 in Chromium with zero console errors.
- Full Playwright: 1 passed, 1 skipped (real engine), 2 failed. `/live?mock=1` lacks `map-alerts` (#13); `/results` lacks `confidence-intervals` (Lane B M1 stub). Badge selector corrected after first run.
- Lane A real scenarios still do not populate Atlas households/helpers (#17); shared deploy script #7 and unverified demo claims #16 remain open. No Lane C issues open.
- No DB credentials, production URL, Vultr host, or domain yet; cannot verify live Atlas/Tiger, production health, or hostnames. User will provide DB credentials when available.
