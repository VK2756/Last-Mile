# Sponsor integrations and evidence

One paragraph per sponsor prize we enter. Each claim must be backed by a real run before submission; evidence lives in
[`evidence/`](evidence/) (Lane C). Status as of Sat 14 Nov, ~17:00 EST: code merged on main, **live deployment and
credentials pending** (no public engine URL, Atlas/Tiger `.env` not yet provided). Do not opt into a prize whose
evidence row is still "pending" at submission time.

| sponsor | where in the code | evidence to attach | status |
|---|---|---|---|
| Gemini | `packages/ai/src/triage.ts`, `web/app/api/triage/route.ts`, `web/app/call/` | redacted `/call` transcript with Gemini replies, before/after `/live` capture, API usage screenshot | pending key |
| MongoDB Atlas | `packages/data/src/index.ts` (`nearestHelpers`, `$geoNear`) | collection counts after a real run, `$geoNear` query + result, Atlas screenshot | pending credentials |
| Tiger Data | `packages/data/src/migrate.ts`, `packages/data/src/risk-series.ts`, `/dashboard` | hypertable row counts, continuous-aggregate SQL + output, compression ratio, `/dashboard` with real data | pending credentials |
| Vultr | `deploy/vultr/`, `docs/RUNBOOK_VULTR.md` | public `/health` output, `GET /montecarlo/preset` timing, Vultr dashboard | pending VM |
| GoDaddy Registry | `docs/VERCEL.md` (custom domain) | DNS records, HTTPS capture of the site on the domain, registration screenshot | pending registration |
| DEV Writing Challenge | [`DEV_POST.md`](DEV_POST.md) | published DEV URL | pending publication |

## Gemini: voice triage

Most people who most need help never open an evacuation app. Last Mile's `/call` screen is the phone call: the browser's
speech recognition transcribes the resident, and Gemini (`gemini-2.5-flash`, JSON output constrained by a schema that
mirrors our shared `TriageResult` zod type) extracts needs from a fixed list (no vehicle, wheelchair, oxygen, dementia,
limited English...), whether they have a ride, can walk to the road, how many people are home, and an urgency from 1 to
5, then writes the next question in the resident's language. A system instruction forbids promising rescue, dispatch
or arrival times, and the server appends the 911 line whenever the utterance signals immediate danger. When the call is
done, the result is posted to the live scenario and flips that household to "needs help" on the dispatch map. Without
a key a deterministic parser answers, so the demo never breaks. Evidence: [`evidence/`](evidence/) (Gemini transcript: TBD).

## MongoDB Atlas: geospatial helper matching

Atlas holds each scenario's synthetic households, helpers and triage calls. Helper lookup is a `$geoNear` aggregation
over a 2dsphere index on `helpers.location`, filtered by capacity and, when needed, `wheelchairCapable: true`, so a
wheelchair user is only ever matched with a vehicle that can carry them. The engine's data sink writes through
`@lastmile/data` when `DATA_SINK=real`. Evidence: [`evidence/data-live.md`](evidence/data-live.md) (Atlas counts and
query output: TBD).

## Tiger Data: time series of risk and dispatch

Every 30 simulated seconds the engine records each unresolved at-risk household's status and time to impact into the
`risk_samples` hypertable; each adopted assignment goes to `dispatch_events`, and final metrics to `outcomes`.
One-minute continuous aggregates (`risk_1m`, `dispatch_1m`) with refresh policies and compression keep the dashboard
fast. `/dashboard` reads `GET /api/risk-series` to chart households by status, the minimum time to impact and dispatches
per minute. Evidence: [`evidence/data-live.md`](evidence/data-live.md) (row counts, aggregate output, compression
ratio: TBD).

## Vultr: the engine

The simulation, dispatcher and Monte Carlo evaluator run as one Node service on a Vultr VM (systemd + Caddy for HTTPS),
streaming live frames over Server-Sent Events and running 400-simulation comparisons on a worker pool. The cached
200-seed preset is warmed at boot so `/results` paints instantly. Evidence: [`evidence/`](evidence/) (`/health`, preset
timing, VM screenshot: TBD).

## GoDaddy Registry: the domain

The web app is served from a GoDaddy Registry domain ([DOMAIN]) via Vercel, with `api.[DOMAIN]` pointing at the Vultr
engine. Evidence: DNS records and an HTTPS capture (TBD).

## DEV Writing Challenge

[`DEV_POST.md`](DEV_POST.md) explains how we tested a dispatch idea honestly: the paired counterfactual, the
non-strawman baseline, the sensitivity table, and what a simulation cannot prove. Evidence: published URL (TBD).

**Not targeted:** SpaceXSI (requires Cursor and Grok Bot, which we did not use).
