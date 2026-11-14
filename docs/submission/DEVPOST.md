# Last Mile

**Tagline:** Live evacuation dispatch for the people who can't drive out.

> Everything in this project involving residents, helpers and fires is a **simulation with synthetic people**. Outcome
> numbers below come only from our Monte Carlo evaluator; their exact values and refresh command live in
> [`NUMBERS.md`](NUMBERS.md). Real-world facts come from [`SOURCES.md`](SOURCES.md).

## Inspiration

An evacuation alert only helps if you can act on it. Without a car, with a wheelchair or an oxygen line, or on a
landline that never got the text, "evacuate now" is not a plan. NIST's
[Camp Fire case study](https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra)
examines how notification, traffic and rescues played out in a fire where about 40,000 people evacuated and 85 died, and
the [CDC](https://www.cdc.gov/disability-emergency-preparedness/about/) notes that evacuation plans and emergency
communications can miss disability-related needs. We wanted to ask a narrow, testable question: if a county knew who
can't leave on their own and could send the nearest capable helper, how much would that change outcomes, and under
which assumptions?

## What it does

- **Predict.** A wind-driven fire model gives every household a countdown: seconds until the fire reaches that door.
- **Dispatch.** Households that cannot leave alone are matched to the nearest helper who can actually carry them (a
  wheelchair user only goes in a wheelchair-capable van or bus) and reach them before their deadline. Routes avoid
  roads the fire is about to cut and the plan is redone as the fire moves. Every assignment carries a plain-English
  "why this helper".
- **Call.** A Gemini voice agent phones at-risk homes, in their language, landlines included, and turns the answers
  (ride, can walk to the road, residents, wheelchair, oxygen...) into structured needs on the live map. It never
  promises rescue and always says: if you are in immediate danger, call 911.
- **Prove.** `/live` runs the same fire twice side by side: alerts only vs Last Mile. `/results` runs that comparison
  over 200 paired seeds and reports the difference with a 95% confidence interval, next to every assumption that
  drives it, plus how the result moves under harsher assumptions.

**Result (simulation):** vulnerable households evacuated before the fire arrived: 45.1% with alerts only vs
74.5% with Last Mile, a paired lift of +29.4 pts (95% CI [28.6, 30.2]) over 200 seeds on real Amherst, MA streets.
Under the harshest assumptions we tested (35 mph wind and 6 helpers instead of 24) the lift falls to +15.0 pts [14.5, 15.6]; with
zero helpers it is exactly zero, as it should be.

## How we built it

- **Engine (Vultr, Node + TypeScript, Fastify + SSE).** Fire spread as arrival times on a 50 m grid (minimum-time
  propagation with wind and seeded fuel noise). 600 synthetic households on OpenStreetMap roads for Amherst, baked
  offline. Dijkstra routing with fire-closed roads and smoke slow-downs. Dispatcher: greedy insertion in deadline order,
  local search, then exact re-verification of every trip; capacity, wheelchair capability and deadlines are hard
  constraints, and unservable homes are flagged, never silently dropped.
- **Monte Carlo evaluator.** Paired design: population and fire depend only on the seed, never the policy. Both policies
  share the same baseline behaviour (self-evacuation, family pickups); Last Mile only adds dispatched help. Worker-thread
  pool; percentile bootstrap CIs (2,000 resamples). `GET /montecarlo/preset` is cached for instant first paint.
- **Gemini voice triage.** `/call` uses the Web Speech API for speech-to-text and speech synthesis for replies; Gemini
  returns JSON validated against a shared zod schema. Without a key, a deterministic parser answers so the demo never breaks.
- **MongoDB Atlas.** Scenarios, households, helpers and triage calls; helper matching with `$geoNear` over a 2dsphere index.
- **Tiger Data (Timescale).** `risk_samples`, `dispatch_events` and `outcomes` hypertables, one-minute continuous
  aggregates, compression; `/dashboard` reads the risk series.
- **Web (Vercel, Next.js 15).** Split-screen MapLibre `/live`, `/results` (Recharts with CI whiskers), `/how-it-works`,
  `/call`, `/dashboard`. Shared contracts in `packages/contracts` (zod); five lanes worked in parallel through them.

## Challenges we ran into

- **A fair baseline.** It is easy to make "alerts only" a strawman. We made the baseline a strict subset of Last Mile:
  same people, same fire, same self-evacuation and family pickups; Last Mile can only add help. A zero-helper run gives
  exactly zero lift.
- **Speed vs fidelity.** 400 full simulations per comparison had to finish during a demo. Sharing the fire, population
  and road graph across both policies of a seed, and timing helper legs from one shortest-path tree, cut CPU per paired
  run from 587 ms to 361 ms (N=200 in about 40 s on 2 workers; about 14 s on 12 cores).
- **Real roads.** Moving from a synthetic grid to OpenStreetMap Amherst lowered the lift (fewer homes at risk, real
  one-way streets). We kept the harder, more honest version.
- **Never showing fake numbers.** Every page that can fall back to sample data says so with a "SAMPLE DATA (engine not
  connected)" ribbon, and the sample is still computed, never typed in.

## Accomplishments that we're proud of

- A reproducible counterfactual: same seed, same metrics, every time; a fresh seed block (1001–1200) replicates the
  headline within its interval (+29.6 pts [28.8, 30.4]).
- Explainable dispatch: every assignment says why this helper, how far, and how much margin before the fire.
- A sensitivity table instead of a single number: slower help requests, helpers starting far away, fewer helpers, a
  faster fire (see [`SENSITIVITY.md`](SENSITIVITY.md)).

## What we learned

Evacuation outcomes for vulnerable people depend less on the alert and more on transport capability, mobility and how
early needs are known. In our model the number of available helpers matters most; how fast help requests arrive matters
less, because the fire needs about an hour to reach most homes. Those are properties of our assumptions, not field facts.

## What's next

Validate the assumptions with emergency managers, home-care agencies and disability advocates; replace synthetic people
with opt-in registries (privacy by design: minimum data, consent, retention limits); test against real road-closure
records; add helper reliability and false-request models; pilot as decision support alongside, never instead of, 911
and official evacuation orders.

## Assumptions we disclose (also shown beside every result)

- All residents and helpers are synthetic (seeded random); no real person is in the system.
- Fire spread is a simplified wind-driven model: no terrain, spotting or firebreaks. Not an operational forecast.
- The alert goes out 300 s after ignition; households react after a random delay (longer for landline-only,
  limited-English or no-signal homes).
- Households with a car leave on their own after packing; 25% of households without a car get a family pickup 15–40
  min after being warned; the rest wait.
- Last Mile learns of a household that cannot drive 1–3 min after it is warned (voice call / app / registry); helpers
  start at random road nodes, drive at road speed with congestion, and are always willing and available.
- Metrics count only households the fire reaches within 2 hours. "Trapped" is a simulation outcome, not a casualty estimate.

## Built with

TypeScript, Node.js, Fastify, Next.js, React, MapLibre GL, Recharts, zod, Gemini API, MongoDB Atlas, Tiger Data
(TimescaleDB), Vultr, Vercel, Caddy, OpenStreetMap, Web Speech API.

## Links

- Live demo: [DEMO_URL] · Engine health: [ENGINE_URL]/health
- Video: [VIDEO_URL] · DEV post: [DEV_URL]
- Evidence: [`docs/submission/evidence/`](evidence/)
