# Lane C status — 2026-11-14 14:47 EST

## Done / in review
- Merged: data/deploy #5 and #22, Gemini/triage #10, QA skeleton #15, submission drafts #18, status #30. Main advanced to `942ce97` (B dark basemap); Linux CI passed. Required postmerge command still fails on Windows CRLF (#4).
- This branch adds repeatable Atlas/Tiger evidence (`pnpm --filter @lastmile/data evidence`), `/api/risk-series`, a Vultr runbook using ignored `engine/.env`, and a freeze audit. Evidence command with no credentials: Atlas/Tiger/compression all `not configured` (PASS behavior).
- **Prince (Lane E):** `/api/triage` is already on main and returned HTTP 200 without a key. `/api/risk-series?scenarioId=demo` returns HTTP 200 with `points: []`, `source: not configured` without Tiger credentials; this route is in the current Lane C branch. With credentials, it queries Tiger `risk_samples`. Lane E owns `/call` and `/results` UI; existing C call UI PR #39 will need coordination under the new split.
- Playwright against local web: mock `/live` and `/call` 2 passed, real-engine `/live` and placeholder `/results` 2 skipped with clear reasons. With local engine + web, real `/live` and completed `/call` both passed (2/2; POST needs 200). Zero console errors in passing tests.

## Blockers / next checks
- Root `.env` is ignored (`git check-ignore` PASS) but absent in this checkout. Migration, seed, live Atlas/Tiger counts, Gemini-key path, and real evidence are pending that file; Anant has been asked to place it locally without sending values.
- Engine `DATA_SINK=real` loader exists in `engine/src/sim/sink.ts`; needs both `MONGODB_URI` and `TIGER_DATABASE_URL` to use real buffered sink. Real-run persistence must be checked after credentials arrive. Triage-call persistence still needs A #36.
- Freeze audit: 4 STUB markers (D road graph #45, E landing/results #46), SIMULATION badge PASS, static outcome scan PASS, voice-promise scan PASS, tracked-secret pattern scan PASS. No public engine URL, so `/health` fails this gate. Main `942ce97` CI passed.
- Local `pnpm verify` in clean Windows worktree: 70 engine tests pass, 1 D worker test fails loading `worker.ts` (#33). `bash scripts/postmerge.sh` fails on Windows CRLF (#4); exact command still run after merges. Main Linux CI green.
- Other integration bugs: A Monte Carlo route unmounted #29, A triage collection unwritten #36, A Windows engine start #41. Shared root deploy script #7 remains open. No domain/VM/Vercel production URL yet.
- PR #51 carries data evidence/runbook/API/QA and the real-engine call test; CI pending. Prior #34 was superseded by #51. Prior #39 closed after `/call` UI ownership moved to E; Prince can review/cherry-pick its call-page diff (#46 comment). Recheck CI and production after every merge and at least every 25 minutes.
