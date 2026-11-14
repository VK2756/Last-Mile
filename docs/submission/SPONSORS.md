# Sponsor descriptions and evidence

Use these paragraphs only after confirming the corresponding service in a real demo run. Store screenshots, counts, and query output in `evidence/`. Do not claim a prize integration based solely on code or a seed fixture.

**Gemini:** `packages/ai/src/triage.ts` uses the Gemini API to extract household needs and reply in the resident's language. `/call` sends the structured result to the live engine. Evidence: a redacted call transcript, API usage screenshot, and a before/after live-map capture. Pending live API verification.

**MongoDB Atlas:** `packages/data` stores scenarios, households, helpers, and triage calls. Its `nearestHelpers` query uses `$geoNear` over a 2dsphere helper location index. Evidence: collection document counts from a real scenario, the query and result, and an Atlas screenshot. Pending credentials and real run.

**Tiger Data:** `packages/data/src/migrate.ts` defines risk, dispatch, and outcome hypertables plus one-minute continuous aggregates. The engine sink batches records during real runs. Evidence: `risk_samples`, `dispatch_events`, and `outcomes` row counts; the aggregate SQL; a compression statistic; and a Tiger dashboard screenshot. Pending credentials and real run.

**Vultr:** `deploy/vultr/` installs and runs the engine on an Ubuntu VM with systemd and Caddy HTTPS. Evidence: `/health` output from the public hostname and a Vultr dashboard screenshot. Pending VM deployment.

**GoDaddy Registry domain:** A `.tech` domain will route the web app through Vercel and `api` to the Vultr VM. Evidence: DNS records, HTTPS browser capture, and domain registration screenshot. Pending registration.

**DEV Writing Challenge:** `DEV_POST.md` is the draft explaining the simulated experiment and its limitations. Evidence: published DEV URL and post screenshot. Pending publication.

## Devpost opt-in checklist

- [ ] Grand Prize
- [ ] `[HACKUMASS] Best Software Hack` — the only `[HACKUMASS]` tag
- [ ] MLH Gemini
- [ ] MongoDB Atlas
- [ ] MLH Tiger Data
- [ ] MLH Vultr
- [ ] GoDaddy Registry domain
- [ ] DEV Writing Challenge
