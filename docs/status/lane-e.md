# Lane E status (STORY PAGES + SUBMISSION) — Prince / Claude Code
_Updated: Sat 14 Nov, ~16:40 EST._

## Done (merged)
- #44 docs: 5-lane ownership (CLAUDE.md, AGENTS.md), `docs/lanes/LANE_E_STORY.md`, attribution off in `.claude/settings.json`, `lane:e` label.
- #48 `/results`: POST /montecarlo (200 paired seeds), CI bar chart, numbers table, paired lift with honest reading, assumptions (`#assumptions`), loading/progress, error + retry. If the engine is unset/unreachable: SAMPLE DATA ribbon, numbers computed from the in-browser mock over 60 paired seeds (never hard-coded). Testids: `results-chart`, `results-lift`, `results-sample-ribbon`, `confidence-intervals`.
- #49 landing `/`: hero, Predict/Dispatch/Call, counterfactual, stack strip, honesty + 911, team footer. Facts cite NIST/CDC from SOURCES.md. Testid `landing-cta`.
- #52 `/call`: STT (Web Speech, live captions), TTS with mute, typed fallback, live needs card, POST to engine `/scenarios/:id/households/:hid/needs` on done, labelled local mock responder if /api/triage fails, persistent 911 notice. Testids `call-911`, `call-learned`, `call-mock-ribbon`.
- #58 `/how-it-works`: inline-SVG pipeline (fire, risk clock, dispatch, voice, Monte Carlo) + plain-language sections with parameters read from engine code.
- #62 landing v2: hero live preview iframe `/live?mock=1&view=maps&pitch=1&auto=1` (loaded after idle; static illustration on phones / reduced motion), Who this is for, How we prove it, scroll reveal, full footer.
- #70 `/results` v2: instant paint from `GET /montecarlo/preset`, "Run full 200-seed comparison" = fresh seeds 1001-1200 via POST, SAMPLE ribbon only if engine unreachable or response says placeholder, model assumptions beside the chart, harsher-assumptions panel from `docs/submission/SENSITIVITY.md` (real sweep, raw JSON in `docs/submission/sensitivity/`).
- `/dashboard` (this PR): Recharts from `GET /api/risk-series?scenarioId=` (status groups stacked, min TTI, dispatches/min when the API returns them); SAMPLE ribbon + mock-derived series when no scenario, Tiger not configured, or error.
- Closed #46 (stubs/CIs) with evidence.

## Evidence
- Local engine (`PORT=8080 pnpm --filter @lastmile/engine start`) + web: preset +29.4 pts [28.6, 30.2] (matches CLI); full run seeds 1001-1200 +29.6 [28.8, 30.4]; engine killed -> SAMPLE ribbon.
- `bash scripts/postmerge.sh` on main after #52: verify passed. CI green on all four PRs.
- Browser (next dev): /results sample path renders chart+CIs, 0 console errors; / at desktop and 375px, no horizontal scroll; /call via real /api/triage and with /api/triage forced to 404, 0 console errors.

## Other lanes must know
- D: #78 add model assumptions to the Monte Carlo response (results page currently reads them from a scenario init).
- C: #79 `/api/risk-series` should also return dispatches per minute.
- A/C: /results shows engine numbers once Vercel has NEXT_PUBLIC_ENGINE_URL pointing at the Vultr engine.
- C: #53 e2e `getByText('SIMULATION')` is now ambiguous; use `getByTestId('sim-badge').first()`.

## Next
submission docs (DEVPOST, SPONSORS, PRIZE_CHECKLIST, DEV_POST, VIDEO, PITCH_QA), SOURCES check, polish.
