# Lane E status (STORY PAGES + SUBMISSION): Prince / Claude Code
_Updated: Sat 14 Nov, ~20:45 EST._

## Done (merged)
- Earlier: #44 docs, #48/#70 /results, #49/#62 landing, #52 /call, #58 /how-it-works, #83 /dashboard, #87 submission docs, #94 NUMBERS.md, #99 UI kit, #101 SOURCES + DEMO_SCRIPT, #103 DEMO_RUNBOOK, #105 polish.
- #112 (closes #109): headline is a range with the neighbour-ride caveat, from BASELINE_REVIEW (about +4 to +29 pts; +12.3 at 30% neighbour rides; +4.1 strong baseline; Last Mile wins all 33). numbers.mjs reads the review's rows. PITCH_QA Q3 "Isn't your baseline a strawman?" with the table and what isn't measured.
- #119: /results with the engine unreachable shows no numbers, only "Run the engine to see results" + Retry (dashes in the CI table). The sample preview is opt-in, greyed out, with the lift hidden. #78 done: assumptions come from the /montecarlo response (#92); the throwaway-scenario fetch is removed.
- #123: /results "How much does the baseline matter?" panel. Buttons POST /montecarlo with `base.baseline` knobs (seeds 1-100). Verified locally: rides 30% gives +12.3 [11.5, 13.2], strong gives +4.1 [3.5, 4.8], both exactly matching BASELINE_REVIEW.
- #128: `tools/fill-links.mjs --demo --api --video --post` fills [DEMO_URL] [API_URL] [VIDEO_URL] [DEV_URL] [DOMAIN] across docs/submission (idempotent, links.json, `--check`).
- #133: `tools/check-numbers.mjs` fails on any % or points figure in docs/web copy with no source in NUMBERS/BASELINE_REVIEW/sensitivity. 189 figures checked, all match (removed the stale pre-#61 numbers).
- #141 (closes #111, #135): diagram a11y fix; /results Lighthouse mobile 97/100/100/100 (was 89/96), desktop 100x4; /how-it-works 99/100/100/100 and 100x4. OG image and 404 verified.
- Submission pack + #139 hero "Talk to the voice agent" button (this PR): DEVPOST.md ready to paste with a paragraph per prize ("pending live run" until evidence exists), 2:00 VIDEO.md matching the runbook beats, DEV post final, SPONSORS/PRIZE_CHECKLIST aligned.

## Evidence
- Local engine + prod build: preset +29.4 [28.6, 30.2]; baseline buttons as above; engine down shows the offline card; 0 console errors.
- `check-numbers.mjs`, `numbers.mjs --check`, `web/e2e/audit.mjs` all pass; postmerge OK after every merge.

## Other lanes must know
- C: #129, evidence/montecarlo-local.md still quotes +32.2 (stale). e2e real-engine text "Monte Carlo engine" now exists on /results.
- B: #106 (fg-dim contrast, NEXT_PUBLIC_SITE_URL on Vercel). C: #79 dispatches/min in /api/risk-series.

## Still open (needs the deploy)
Run `fill-links.mjs` with real URLs; re-run `ENGINE_URL=… numbers.mjs` against Vultr; capture sponsor evidence (Atlas/Tiger say "not configured"); record the video; publish DEV post; submit Devpost by 8am.
