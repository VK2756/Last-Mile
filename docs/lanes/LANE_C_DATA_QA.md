# Lane C: DATA, VOICE, DEPLOY, QA, SUBMISSION — Anant, Codex

You own: `packages/data/**`, `packages/ai/**`, `web/app/call/**`, `web/app/api/**`, `web/e2e/**`, `web/playwright.config.ts`, `deploy/vultr/**`, `docs/submission/**`. Setup: read `AGENTS.md` and `CLAUDE.md`; your sandbox must allow network access (see `docs/HUMAN_SETUP.md`). Everything must work with NO credentials via fallbacks (memory sink, deterministic triage parser) so CI and teammates never need your keys.

Priority order (do them in this order; later items are cut first):
1. Data layer + deploy scripts (the engine needs these early)
2. Gemini triage + `/call`
3. QA verifier + e2e (you are the only agent with no feature pressure: protect the demo)
4. Submission package

## Part 1: Data layer (`@lastmile/data`), M1
- Humans give you `MONGODB_URI`, `MONGODB_DB`, `TIGER_DATABASE_URL`, `GEMINI_API_KEY` (names in `.env.example`).
- `createDataSink(): DataSink` (contract interface): real Atlas + Tiger when env is present, else the memory sink. Never throw into the engine: log and drop on failure. Batch writes (flush every 1s or 500 rows), expose `flush()`.
- **Tiger Data** idempotent migration `pnpm --filter @lastmile/data migrate`: hypertables `risk_samples`, `dispatch_events`, `outcomes`; continuous aggregates `risk_1m` (time_bucket 1 minute: households per status, min tti) and `dispatch_1m` with refresh policies (create aggregates outside a transaction); compression on the raw hypertables.
- **MongoDB Atlas**: collections `households`, `helpers` (2dsphere index on `location`), `scenarios`, `triage_calls`. `nearestHelpers(point, {wheelchair, minCapacity, limit})` using `$geoNear`, plus `riskSeries(scenarioId)` reading Tiger. Seed script `pnpm --filter @lastmile/data seed`.
- Add `typecheck` and `test` scripts; unit-test the memory implementation.
- Lane A injects your sink behind `DATA_SINK=real`: coordinate only through status files and contracts.
- `GET /api/risk-series?scenarioId=` in `web/app/api/risk-series/**` (stretch for Lane B's dashboard).
- Collect sponsor evidence into `docs/submission/evidence/`: row counts, the aggregate SQL, the `$geoNear` query, compression ratio, screenshots.

## Part 2: Deploy (`deploy/vultr/**`), M1
Write the scripts; **the human runs them over SSH** (you cannot SSH from a sandbox). `setup.sh` (idempotent, Ubuntu 24.04: Node 22, pnpm, Caddy, systemd unit `lastmile-engine`, ufw 22/80/443), `deploy.sh` (git pull, `pnpm install --frozen-lockfile`, restart, curl `/health`), Caddy reverse proxy `https://api.<domain>` to `localhost:8080` (HTTPS is mandatory: Vercel is HTTPS and browsers block mixed content; use `<ip>.sslip.io` until the domain exists). Add a root script `deploy:engine`. Give the human the exact commands to paste. Screenshots of the Vultr dashboard go into evidence (Vultr prize).

## Part 3: Gemini voice triage (`@lastmile/ai` + `/call`), M2
- `packages/ai/src/triage.ts`: `triage(req: TriageRequest): Promise<TriageResult>` with `@google/genai`, JSON response schema, model from `GEMINI_MODEL`. System prompt rules: calm, short sentences; at most one question per turn; extract needs (`Need` enum), ride availability, can-walk-to-road, resident count; urgency 1-5; reply in the resident's language (test English, Spanish, Portuguese, Mandarin); NEVER promise rescue or times; if in immediate danger say to call 911; `done=true` once needs are captured.
- Deterministic fallback when `GEMINI_API_KEY` is missing or the API errors (keyword/regex extractor + canned replies in en/es).
- `web/app/api/triage/route.ts`: POST wrapper (validate with `TriageRequest`), light rate limit.
- `web/app/call/page.tsx`: "phone call" screen: Web Speech API STT + SpeechSynthesis TTS (typed fallback), a live "what we learned" card, and on `done` POST the `TriageResult` to the engine (`POST /scenarios/:id/households/:hid/needs`) so the household turns into `needs_help` on `/live` (`?scenario=…&household=…`). Reuse Lane B's UI kit; do not edit it.
- Tests: fallback-path unit tests with contract validation; golden tests for 5 utterances.

## Part 4: QA verifier + e2e (start in hour 1 with the skeleton, never stop)
- Every 25 minutes and after every merge to main: `bash scripts/postmerge.sh`; check CI (`gh run list --branch main`), Vercel production, the engine (`curl https://api.<domain>/health`). File precise issues: `gh issue create --label integration-bug --label lane:<a|b> --title ... --body <repro, expected, actual>`.
- Playwright suite in `web/e2e/` (`pnpm --filter @lastmile/web e2e`) against `BASE_URL`: `/live?mock=1` renders both maps and the frame counter increments; `/live` against the real engine updates both scoreboards and shows the SIMULATION badge; `/results` renders CIs; `/call` renders; **zero console errors**. Use Lane B's `data-testid`s.
- Honesty audit: SIMULATION badge + assumptions everywhere; no hard-coded outcome numbers (`grep` for suspicious constants); voice agent never promises rescue; every real-world stat in `SOURCES.md`.
- **Freeze gate** (Sun 2:00am; report PASS/FAIL per item): `grep -rn "STUB:" engine packages web` is empty; main green; production = main; Vercel + Vultr healthy; e2e green; `/results` numbers come from a real `/montecarlo` run; Atlas and Tiger populated; secrets scan clean (`git log -p | grep -iE "(api[_-]?key|mongodb\+srv|postgres://)"` shows no real values).

## Part 5: Submission package (`docs/submission/`; skeleton in hour 1, finish by Sun 4:30am)
- `DEVPOST.md`: title, tagline, Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, What's next. Honest: simulation with synthetic people; list the assumptions.
- `SPONSORS.md`: one tight paragraph per prize with exactly how/where it is used + evidence. Opt-in checklist for the Devpost form: Grand Prize, `[HACKUMASS] Best Software Hack` (ONLY ONE `[HACKUMASS]` tag allowed), MLH Gemini, MongoDB Atlas, MLH Tiger Data, MLH Vultr, GoDaddy Registry domain, DEV Writing Challenge. (SpaceXSI is not targeted.)
- `SOURCES.md` (seeded), `DEV_POST.md` (publish after submitting; tags `hackumass`, `mlh`, `gemini`, `mongodb`, `ai`), `VIDEO.md` (shot list + narration from `docs/DEMO_SCRIPT.md`), `architecture.svg`.
- Domain: register a `.tech` name via the GoDaddy Registry link (tech.study); `@`/`www` to Vercel, `api` A-record to the Vultr IP; tell Lanes A and B the hostnames.

## Done means
`migrate` + `seed` work; real runs populate Atlas and Tiger; `/call` completes a triage and updates the live map; freeze gate all PASS; Devpost text, video and DEV post ready; submitted by Sun 7:00am.
