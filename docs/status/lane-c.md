# Lane C status

Data/deploy PR #5 merged. Current branch: `c/voice-triage`. Latest merged main passed `pnpm verify` locally and CI. Direct `bash scripts/postmerge.sh` still fails in this Windows checkout due to CRLF; shared-file issue #4.

## Task list
- [x] Data sink: memory fallback, buffered Atlas/Tiger writes, query helpers, tests (local tests pass)
- [x] Tiger migration and Atlas seed code (live credentials pending)
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands (live VM pending)
- [ ] Gemini triage, API route, `/call` (fallback and page implemented; awaiting web app shell for route smoke test)
- [ ] Playwright e2e and integration QA
- [ ] Submission package and sponsor evidence

Next: merge voice PR, then e2e and QA. Lane A: import `createDataSink` and `upsertWorld` from `@lastmile/data` when ready, gated by `DATA_SINK=real`; `flush()` is exposed. Lane B: `/call` is self-contained until your app shell/UI kit lands. Blockers: no database credentials, domain, Vultr host, or production URL. Shared root deploy script request: #7.

Evidence: `pnpm verify` → `✅ verify passed` (2026-11-14 13:36 EST); `pnpm --filter @lastmile/ai test` → 6/6 passed; `pnpm --filter @lastmile/data test` → 2/2 passed. No live database or deployment test yet.
