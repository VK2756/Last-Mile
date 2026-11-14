# Lane E: STORY PAGES + SUBMISSION (Prince, Claude Code)

Deadline: Sun 15 Nov 2026, 10:00am EST. Branch prefix `e/`, label `lane:e`, status file `docs/status/lane-e.md`.

## Owns
`web/app/page.tsx` (landing), `web/app/results/**`, `web/app/dashboard/**`, `web/app/how-it-works/**`,
`web/app/call/**` (UI only; Lane C owns `web/app/api/**`), `web/components/story/**`,
and `docs/submission/**` EXCEPT `docs/submission/evidence/**` (Lane C). Never edit files outside this set;
if you need a change elsewhere, open a GitHub issue with that lane's label.

## Commit rules
Commits and PRs must look like they come from the GitHub user only. No Co-Authored-By, no "Generated with Claude Code",
no session links, no AI attribution. Plain messages like `web: results page`. (`.claude/settings.json` sets
`"attribution": {"commit": "", "pr": ""}` repo-wide.)

## Never wait
Build against `@lastmile/contracts/fixtures` and the zod types in `@lastmile/contracts`. Anything that needs a backend has a
clearly labelled fallback: a visible "SAMPLE DATA (engine not connected)" ribbon whenever fixture numbers are shown, so fake
numbers are never presented as real. `git pull` every 30 min and switch to real endpoints as they land:
Monte Carlo `POST NEXT_PUBLIC_ENGINE_URL/montecarlo`; triage `POST /api/triage`; risk series `GET /api/risk-series`.
Use Lane B's theme tokens (`web/app/globals.css`, Tailwind `bg-surface`, `text-fg-muted`, `border-line`, `text-accent`...).
`package.json` changes only via small `deps:` PRs (`pnpm add <pkg> --filter @lastmile/web`); never hand-edit `pnpm-lock.yaml`.

## Honesty rules (non-negotiable)
Everything involving residents, helpers and fires is a SIMULATION with synthetic people; every page that shows results shows a
SIMULATION badge and links to the assumptions. No hard-coded outcome numbers anywhere, ever. The voice agent never promises
rescue and always says: if you are in immediate danger, call 911. Every real-world statistic must be in
`docs/submission/SOURCES.md` with a URL.

## Backlog (one PR per item; after each merge: `bash scripts/postmerge.sh`, `gh issue list --label lane:e`, update status)
0. `docs: lane E`: 5-lane ownership table in CLAUDE.md / AGENTS.md, this brief, attribution off in `.claude/settings.json`, `lane:e` label.
1. `/results`: POST /montecarlo; alerts-only vs Last Mile evacuated rate and vulnerable-evacuated rate with 95% CI error bars
   (Recharts), paired lift, assumptions list, N seeds, loading state with progress, error state, SAMPLE DATA ribbon on fixture
   fallback. Testids: `results-chart`, `results-lift`, `results-sample-ribbon`.
2. Landing `/`: hero with one-sentence promise, 10-second explainer (Predict, Dispatch, Call), big "Run the live demo" button
   to /live, stack strip (Gemini, MongoDB Atlas, Tiger Data, Vultr, Vercel), honesty/assumptions section, link to /results,
   footer with the team. Must look like a real crisis-operations product.
3. `/how-it-works`: inline-SVG pipeline explainer (fire model, per-household risk clock, dispatch optimizer, voice triage,
   Monte Carlo proof) with plain-language descriptions, accurate to the code.
4. `/call`: Web Speech API STT + SpeechSynthesis TTS with typed fallback, live "what we learned" card (needs, ride,
   can-walk-to-road, residents, urgency); on done POST the TriageResult to
   `NEXT_PUBLIC_ENGINE_URL/scenarios/:id/households/:hid/needs` (`?scenario=&household=`). Calls `POST /api/triage`; on 404/error
   use a clearly labelled local mock responder. Always show the 911 notice.
5. `/dashboard`: Recharts time series from `GET /api/risk-series` (households per status over time, min time-to-impact,
   dispatches per minute); sample-data ribbon when unavailable.
6. Submission docs: DEVPOST.md, SPONSORS.md, PRIZE_CHECKLIST.md (Grand Prize, ONE [HACKUMASS] tag = Best Software Hack, MLH
   Gemini, MongoDB Atlas, MLH Tiger Data, MLH Vultr, GoDaddy Registry domain, DEV Writing Challenge; SpaceXSI NOT targeted),
   DEV_POST.md (tags hackumass, mlh, gemini, mongodb, ai), VIDEO.md (2:30 shot list), architecture.svg, PITCH_QA.md (15 hardest
   judge questions, honest answers).
7. Verify every URL in SOURCES.md supports its claim; DEMO_SCRIPT.md keeps [X] placeholders, adds exact click path and the
   `?mock=1` backup plan.
8. Polish: favicon, Open Graph image, 404 page, metadata, keyboard access, prefers-reduced-motion, mobile landing.
9. Ask the human ONLY for secrets, new accounts, or contract-breaking decisions.
