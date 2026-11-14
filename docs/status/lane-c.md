# Lane C status

Data/deploy PR #5, voice PR #10, and QA skeleton PR #15 merged. Current branch: `c/submission-draft`. Latest merged main passed `pnpm verify` locally; CI for #15 was green before merge. Direct `bash scripts/postmerge.sh` still fails in this Windows checkout due to CRLF; shared-file issue #4.

## Task list
- [x] Data sink: memory fallback, buffered Atlas/Tiger writes, query helpers, tests (local tests pass)
- [x] Tiger migration and Atlas seed code (live credentials pending)
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands (live VM pending)
- [x] Gemini triage, API route, `/call` code and fallback tests (web app shell pending for route smoke test)
- [ ] Playwright e2e and integration QA (suite merged, browser run waits on web UI)
- [ ] Submission package and sponsor evidence (drafting; live evidence pending)

Next: merge submission draft; run e2e when Lane B UI lands. Lane A fixed `@lastmile/data` dependency in PR #14; `pnpm --filter @lastmile/engine exec tsx -e "import('@lastmile/data')..."` succeeds after `pnpm install`. Real scenarios still do not populate Atlas households/helpers (#17). Lane B: requested stable test IDs and e2e script (#13). Four `STUB:` markers remain in Lane D routing/dispatch/town files (work in progress). Blockers: no database credentials, domain, Vultr host, or production URL. Shared root deploy script #7; unverified demo hook #16.

Evidence: `pnpm verify` → `✅ verify passed` after PR #10; `pnpm --filter @lastmile/ai test` → 6/6 passed; `pnpm --filter @lastmile/data test` → 2/2 passed; `pnpm exec playwright test --list` → 4 tests. No live database, web, or deployment test yet.
