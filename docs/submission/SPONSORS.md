# Sponsor integrations and evidence

One paragraph per sponsor prize we enter. Each claim must be backed by a real run before submission; evidence lives in
[`evidence/`](evidence/) (Lane C). Status as of Sat 14 Nov, ~20:30 EST: code merged on main, **live deployment and
credentials pending** (no public engine URL; `evidence/data-live.md` says Atlas and Tiger are "not configured"). Do not opt into a prize whose
evidence row is still "pending" at submission time.

| sponsor | where in the code | evidence to attach | status |
|---|---|---|---|
| Gemini | `packages/ai/src/triage.ts`, `web/app/api/triage/route.ts`, `web/app/call/` | redacted `/call` transcript with Gemini replies, before/after `/live` capture, API usage screenshot | pending key |
| MongoDB Atlas | `packages/data/src/index.ts` (`nearestHelpers`, `$geoNear`) | collection counts after a real run, `$geoNear` query + result, Atlas screenshot | pending credentials |
| Tiger Data | `packages/data/src/migrate.ts`, `packages/data/src/risk-series.ts`, `/dashboard` | hypertable row counts, continuous-aggregate SQL + output, compression ratio, `/dashboard` with real data | pending credentials |
| Vultr | `deploy/vultr/`, `docs/RUNBOOK_VULTR.md` | public `/health` output, `GET /montecarlo/preset` timing, Vultr dashboard | pending VM |
| GoDaddy Registry | `docs/VERCEL.md` (custom domain) | DNS records, HTTPS capture of the site on the domain, registration screenshot | pending registration |
| DEV Writing Challenge | [`DEV_POST.md`](DEV_POST.md) | published DEV URL | pending publication |

## Paragraphs

The paste-ready paragraph for each prize (what we used, where in the code, where the evidence is, and an honest status)
is in [`DEVPOST.md`](DEVPOST.md#prize-tracks-one-paragraph-each-paste-into-the-prize-questions). Keep this table and
those paragraphs in step: when a row here stops being "pending", replace "pending live run" there with the evidence link.

**Not targeted:** SpaceXSI (requires Cursor and Grok Bot, which we did not use).
