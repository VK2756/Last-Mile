# Last Mile: Devpost submission (ready to paste)

Paste each section into the matching Devpost field. Numbers come from [`NUMBERS.md`](NUMBERS.md) and
[`BASELINE_REVIEW.md`](BASELINE_REVIEW.md); `node docs/submission/tools/check-numbers.mjs` fails if any figure here has
no source. Links are filled by `node docs/submission/tools/fill-links.mjs` (see [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md)).
Real-world facts come only from [`SOURCES.md`](SOURCES.md).

---

**Project name:** Last Mile

**Tagline (≤ 200 chars):** Live evacuation dispatch for the people who can't drive out: predict every home's time to the fire, send the nearest helper who can carry them, and prove it in simulation.

> Everything in this project involving residents, helpers and fires is a **simulation with synthetic people**.

## Inspiration

An evacuation alert only helps if you can act on it. Without a car, with a wheelchair or an oxygen line, or on a
landline that never got the text, "evacuate now" is not a plan. In the 2018 Camp Fire about 40,000 people evacuated and
85 died, and NIST's
[case study](https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra)
counted nearly 200 evacuation-assistance and rescue events. The
[CDC](https://www.cdc.gov/disability-emergency-preparedness/about/) notes that evacuation plans and emergency
communications may not meet the needs of people with disabilities. We wanted to ask a narrow, testable question: if a
county knew who can't leave on their own and could send the nearest capable helper, how much would that change
outcomes, and under which assumptions?

## What it does

- **Predict.** A wind-driven fire model gives every household a countdown: seconds until the fire reaches that door.
- **Dispatch.** Households that can't leave alone are matched to the nearest helper who can actually carry them (a
  wheelchair user only goes in a wheelchair-capable van or bus) and reach them before their deadline. Routes avoid
  roads the fire is about to cut, and the plan is redone as the fire moves. Every assignment carries a plain-English
  "why this helper".
- **Call.** A Gemini voice agent talks to at-risk homes in their language and turns the answers (ride, can walk to the
  road, how many people, wheelchair, oxygen...) into structured needs on the live map. It never promises rescue and
  always says: if you are in immediate danger, call 911.
- **Prove.** `/live` runs the same fire twice side by side: alerts only vs Last Mile. `/results` runs that comparison
  over 200 paired seeds, reports the difference with a 95% confidence interval next to every assumption, and lets you
  rerun it against a stronger baseline with one click.

**Result (simulation): coordinated dispatch raised the share of vulnerable households that got out before the fire by
about 4 to 29 percentage points, depending on how much informal help the town already has.** Last Mile won in all 33
configurations we tested, but by how much depends on the baseline:

- If neighbours never give each other rides (our default): 45.1% with alerts only vs 74.5% with Last Mile, +29.4 pts
  (95% CI [28.6, 30.2]) over 200 paired seeds on real Amherst, MA streets.
- If 30% of neighbours with a car pick someone up: +12.3 pts [11.5, 13.2].
- If neighbours, families and early alerts all work well: +4.1 pts [3.5, 4.8].

The baseline rows use 100 paired seeds each. Coordinated dispatch matters most where informal help is thin. With zero
helpers the two policies give exactly the same result, as they should.

## How we built it

- **Engine (Node + TypeScript, Fastify + Server-Sent Events, on Vultr).** Fire spread as arrival times on a 50 m grid
  (minimum-time propagation with wind and seeded fuel noise). 600 synthetic households on OpenStreetMap roads for
  Amherst, baked offline. Dijkstra routing with fire-closed roads and smoke slow-downs. Dispatcher: greedy insertion in
  deadline order, local search, then exact re-verification of every trip; capacity, wheelchair capability and deadlines
  are hard constraints, and homes no trip can reach in time are flagged, never silently dropped.
- **Monte Carlo evaluator.** Paired design: population and fire depend only on the seed, never on the policy. Both
  policies share the same baseline behaviour; Last Mile only adds dispatched help. Worker-thread pool, percentile
  bootstrap CIs (2,000 resamples), a cached 200-seed preset for instant first paint, and `POST /montecarlo` accepting
  baseline knobs (neighbour rides, family pickup, departure speed, alert time).
- **Gemini voice triage.** `/call/live` is a real-time Gemini Live call (ephemeral, constrained tokens; 16 kHz audio over
  WebSocket). `/call` is the fallback: Web Speech API in, speech synthesis out. In both, `gemini-2.5-flash` returns
  JSON validated against a shared zod schema; without a key, a deterministic parser answers so the demo never breaks.
- **MongoDB Atlas.** Scenarios, households, helpers and triage calls; helper matching with `$geoNear` over a 2dsphere
  index, filtered by capacity and wheelchair capability.
- **Tiger Data (TimescaleDB).** `risk_samples`, `dispatch_events` and `outcomes` hypertables, one-minute continuous
  aggregates and a compression policy; `/dashboard` charts the risk series.
- **Web (Next.js 15 on Vercel).** Split-screen MapLibre `/live`, `/results` (Recharts with CI whiskers),
  `/how-it-works`, `/call`, `/dashboard`. Shared contracts in `packages/contracts` (zod) let five people build in
  parallel lanes without breaking each other.

## Challenges we ran into

- **A fair baseline.** It is easy to make "alerts only" a strawman. We made the baseline a strict subset of Last Mile
  (same people, same fire, same self-evacuation and family pickups), so Last Mile can only add help, and a zero-helper
  run gives exactly zero lift. Then a teammate turned the baseline up: once neighbours give rides, most of the gap
  closes (+12 points at 30% of neighbours, about +4 with everything working well). That is why we report a range, not
  one number.
- **Speed vs fidelity.** 400 full simulations per comparison had to finish during a demo. Sharing the fire, population
  and road graph across both policies of a seed, and timing helper legs from one shortest-path tree, brought a
  200-seed comparison to about 14 s on a 12-core laptop.
- **Real roads.** Moving from a synthetic grid to OpenStreetMap Amherst lowered the lift (fewer homes at risk, real
  one-way streets). We kept the harder, more honest version.
- **Never showing fake numbers.** If the engine is unreachable, `/results` shows no numbers at all, only "Run the
  engine to see results" with a retry button. A layout preview exists, but it is opt-in, greyed out and hides the lift.

## Accomplishments that we're proud of

- A reproducible counterfactual: same seed, same metrics, every time. A fresh seed block (1001–1200) replicates the
  default-baseline figure within its interval (+29.6 pts [28.8, 30.4]).
- We found our own weak spot (the baseline) and put it on the results page as buttons that rerun the engine, instead of
  burying it.
- Explainable dispatch: every assignment says why this helper, how far away, and how much margin before the fire.

## What we learned

Evacuation outcomes for vulnerable people depend less on the alert and more on transport, mobility and how early needs
are known. In our model, how much informal help already exists (neighbours giving rides) matters most, then the number
of helpers; how fast help requests arrive matters less, because the fire needs about an hour to reach most homes. Those
are properties of our assumptions, not field facts, which is exactly why they are listed beside every result.

## What's next

- Measure what we haven't: how much of the remaining lift is wheelchair users and homes with no car nearby (which our
  modelled neighbour rides can't serve), and add helpers who don't show up, wrong or false requests, and people who
  refuse to leave. Each would lower our numbers.
- Validate the assumptions, especially the neighbour-ride rate, with emergency managers, home-care agencies and
  disability advocates.
- Replace synthetic people with an opt-in registry (minimum data, consent, retention limits) and test against real
  road-closure records.
- Pilot as decision support alongside, never instead of, 911 and official evacuation orders.

## Assumptions we disclose (also beside every result on `/results`)

- All residents and helpers are synthetic (seeded random); no real person is in the system.
- Fire spread is a simplified wind-driven model: no terrain, spotting or firebreaks. Not an operational forecast.
- The alert goes out 300 s after ignition; households react after a random delay (longer for landline-only,
  limited-English or no-signal homes).
- Households with a car leave on their own; 25% of households without a car get a family pickup 15–40 min after being
  warned; by default neighbours don't give rides (the range above shows what changes when they do).
- Last Mile learns of a household that can't drive 1–3 min after it is warned; helpers start at random road nodes and
  are always willing and available.
- Metrics count only households the fire reaches within 2 hours. "Trapped" is a simulation outcome, not a casualty
  estimate.

## Built with

typescript, node.js, fastify, next.js, react, maplibre-gl, recharts, zod, gemini, mongodb-atlas, timescaledb
(tiger-data), vultr, vercel, caddy, openstreetmap, web-speech-api

## Links

- Live demo: https://last-mile-iamvk.vercel.app (offline fallback: https://last-mile-iamvk.vercel.app/live?mock=1)
- Results with every assumption: https://last-mile-iamvk.vercel.app/results
- Engine health: https://vks-macbook-pro.tailb85bea.ts.net/health
- Video: [VIDEO_URL]
- DEV post: [DEV_URL]
- Code: https://github.com/VK2756/Last-Mile

---

## Prize tracks (one paragraph each; paste into the prize questions)

Status words are literal: **"pending live run"** means the code is merged but we have not yet captured evidence from
the deployed system. Before submitting, replace it with the evidence link, or do not opt into that prize
([`PRIZE_CHECKLIST.md`](PRIZE_CHECKLIST.md)).

**[HACKUMASS] Best Software Hack.** Last Mile is a full TypeScript system built at HackUMass by five people working in
parallel lanes through shared zod contracts: a deterministic fire, routing and dispatch engine; a paired Monte Carlo
evaluator with bootstrap confidence intervals; a live split-screen map over Server-Sent Events; and a voice triage
agent. Every main-branch merge passes typecheck, lint, tests and build in CI. Evidence: the repository
(https://github.com/VK2756/Last-Mile), `/results` (rerun the comparison live, including against a stronger
baseline) and [`BASELINE_REVIEW.md`](BASELINE_REVIEW.md). Status: code and evidence on main; live site pending live run.

**MLH: Best Use of Gemini API.** Gemini is used twice. `/call/live` is a real-time Gemini Live voice conversation: the
server mints a single-use ephemeral token constrained to a Live audio model, audio replies, transcription and our fixed
triage instruction, and the browser streams 16 kHz microphone audio over the constrained WebSocket, with interruption
handling. Each finished turn then goes to `gemini-2.5-flash` (also the engine of the simpler `/call` screen), which turns
the resident's answer into structured needs (no vehicle, wheelchair, oxygen, ride, can walk to the road, number of people, urgency)
using JSON output constrained to our shared `TriageResult` schema, then writes the next question in the resident's
language. A system instruction forbids promising rescue, and the 911 line is always present. The result is posted to
the running simulation and flips that household to "needs help" on the dispatch map. Code:
`packages/ai/src/live-token.ts`, `packages/ai/src/triage.ts`, `web/app/api/live-token/route.ts`,
`web/app/api/triage/route.ts`, `web/app/call/` (design notes: `docs/VOICE.md`). Evidence: Gemini call transcript in
[`evidence/`](evidence/). Status: pending live run (needs `GEMINI_API_KEY` on the deployed web app; without it the deterministic fallback answers and we will say so).

**MLH: Best Use of MongoDB Atlas.** Atlas stores each scenario's synthetic households, helpers and triage calls. Helper
candidates come from a `$geoNear` aggregation over a 2dsphere index on `helpers.location`, filtered by capacity and,
for wheelchair users, `wheelchairCapable: true`, so nobody is matched with a vehicle that can't carry them. Code:
`packages/data/src/index.ts`. Evidence: collection counts and a `$geoNear` query with its output in
[`evidence/data-live.md`](evidence/data-live.md). Status: pending live run (the file currently says "Atlas: not
configured").

**MLH: Best Use of Tiger Data.** The engine writes each at-risk household's status and time to impact every 30
simulated seconds into the `risk_samples` hypertable, each adopted assignment into `dispatch_events`, and final metrics
into `outcomes`. One-minute continuous aggregates (`risk_1m`, `dispatch_1m`) with refresh policies and a compression
policy keep `/dashboard` fast. Code: `packages/data/src/migrate.ts`, `packages/data/src/risk-series.ts`,
`web/app/dashboard/`. Evidence: hypertable row counts, aggregate output and the configured compression policy in
[`evidence/data-live.md`](evidence/data-live.md). Status: pending live run.

**MLH: Best Use of Vultr.** The whole engine (simulation, dispatcher, Monte Carlo evaluator) runs as one Node service on
a Vultr VM behind Caddy for HTTPS, streaming live frames over Server-Sent Events and running 400-simulation comparisons
on a worker pool; the 200-seed preset is warmed at boot so `/results` paints instantly. Code: `deploy/vultr/`,
`docs/RUNBOOK_VULTR.md`. Evidence: public https://vks-macbook-pro.tailb85bea.ts.net/health and `/montecarlo/preset` timing in [`evidence/`](evidence/).
Status: pending live run.

**MLH: Best Domain Name from GoDaddy Registry.** The web app is served on our GoDaddy Registry domain, last-mile-iamvk.vercel.app, via
Vercel, with `api.last-mile-iamvk.vercel.app` pointing at the Vultr engine. Evidence: DNS records and an HTTPS capture in
[`evidence/`](evidence/). Status: pending live run (domain not registered yet).

**DEV Writing Challenge.** Our post, "We built an evacuation dispatcher, then tried hard to prove it doesn't work"
([`DEV_POST.md`](DEV_POST.md)), explains the paired counterfactual, how a teammate showed our baseline was too
pessimistic, why the honest headline is a range of 4 to 29 points, and what a simulation can't tell you. Evidence:
[DEV_URL]. Status: pending publication.

**Not entered:** SpaceXSI (needs Cursor and Grok Bot, which we did not use).
