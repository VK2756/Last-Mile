# Lane C status

Data/deploy PR #5 and voice PR #10 merged. Current branch: `c/qa-e2e`. Latest merged main passed `pnpm verify` locally and CI. Direct `bash scripts/postmerge.sh` still fails in this Windows checkout due to CRLF; shared-file issue #4.

## Task list
- [x] Data sink: memory fallback, buffered Atlas/Tiger writes, query helpers, tests (local tests pass)
- [x] Tiger migration and Atlas seed code (live credentials pending)
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands (live VM pending)
- [x] Gemini triage, API route, `/call` code and fallback tests (web app shell pending for route smoke test)
- [ ] Playwright e2e and integration QA (suite drafted, web UI pending)
- [ ] Submission package and sponsor evidence

Next: merge QA skeleton, run e2e when Lane B UI lands, then submission docs. Lane A: `DATA_SINK=real` cannot resolve `@lastmile/data` (#12); `upsertWorld` and `flush()` are available. Lane B: requested stable test IDs and e2e script (#13). Four `STUB:` markers remain in Lane D routing/dispatch/town files (work in progress). Blockers: no database credentials, domain, Vultr host, or production URL. Shared root deploy script request: #7.

Evidence: `pnpm verify` → `✅ verify passed` after PR #10; `pnpm --filter @lastmile/ai test` → 6/6 passed; `pnpm --filter @lastmile/data test` → 2/2 passed; `pnpm exec playwright test --list` → 4 tests. No live database, web, or deployment test yet.
