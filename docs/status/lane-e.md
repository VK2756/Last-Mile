# Lane E status (STORY PAGES + SUBMISSION) — Prince / Claude Code
_Updated: Sat 14 Nov, ~15:40 EST._

## Done (merged)
- #44 docs: 5-lane ownership (CLAUDE.md, AGENTS.md), `docs/lanes/LANE_E_STORY.md`, attribution off in `.claude/settings.json`, `lane:e` label.
- #48 `/results`: POST /montecarlo (200 paired seeds), CI bar chart, numbers table, paired lift with honest reading, assumptions (`#assumptions`), loading/progress, error + retry. If the engine is unset/unreachable: SAMPLE DATA ribbon, numbers computed from the in-browser mock over 60 paired seeds (never hard-coded). Testids: `results-chart`, `results-lift`, `results-sample-ribbon`, `confidence-intervals`.
- #49 landing `/`: hero, Predict/Dispatch/Call, counterfactual, stack strip, honesty + 911, team footer. Facts cite NIST/CDC from SOURCES.md. Testid `landing-cta`.
- #52 `/call`: STT (Web Speech, live captions), TTS with mute, typed fallback, live needs card, POST to engine `/scenarios/:id/households/:hid/needs` on done, labelled local mock responder if /api/triage fails, persistent 911 notice. Testids `call-911`, `call-learned`, `call-mock-ribbon`.
- #58 `/how-it-works`: inline-SVG pipeline (fire, risk clock, dispatch, voice, Monte Carlo) + plain-language sections with parameters read from engine code.
- Landing v2 (this PR): hero live preview iframe `/live?mock=1&view=maps&pitch=1&auto=1` (loaded after idle; static illustration on phones / reduced motion), Who this is for, How we prove it, scroll reveal, full footer.
- Closed #46 (stubs/CIs) with evidence.

## Evidence
- `bash scripts/postmerge.sh` on main after #52: verify passed. CI green on all four PRs.
- Browser (next dev): /results sample path renders chart+CIs, 0 console errors; / at desktop and 375px, no horizontal scroll; /call via real /api/triage and with /api/triage forced to 404, 0 console errors.

## Other lanes must know
- A: /results shows real numbers only once `registerMonteCarlo(app)` is mounted (#29) and Vercel has NEXT_PUBLIC_ENGINE_URL.
- C: #53 e2e `getByText('SIMULATION')` is now ambiguous; use `getByTestId('sim-badge').first()`.
- B: hero preview waits on `/live?auto=1` (until then it shows the paused first frame).

## Next
/results preset + full run + sensitivity, /dashboard, submission docs (DEVPOST, SPONSORS, PRIZE_CHECKLIST, DEV_POST, VIDEO, PITCH_QA), SOURCES check, polish.
