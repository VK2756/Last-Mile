# The 15 hardest judge questions, with honest answers

Numbers in brackets: [`NUMBERS.md`](NUMBERS.md). Facts: [`SOURCES.md`](SOURCES.md). If you don't know, say so and say
how we'd find out. Never claim lives saved.

**1. Is this real?**
The software is real and running: fire model, router, dispatcher, Monte Carlo evaluator, voice triage, databases. The
people, helpers and fires are synthetic. Every number we show is a simulation output, labelled SIMULATION, with its
assumptions next to it. It is a prototype of decision support, not a deployed emergency service.

**2. Why not just send better alerts?**
Alerts solve "didn't know"; they don't solve "can't go". A household without a car or with a wheelchair needs a vehicle
that can carry them before the fire arrives. In our model alerts alone evacuate 45.1% of vulnerable households;
the gap is transport, not information.

**3. How do you know the baseline isn't a strawman?**
The baseline is a strict subset of Last Mile: same people, same fire, same self-evacuation for everyone with a car, same
25% family pickups for those without. Last Mile can only add dispatched help. With zero helpers the two policies give
identical results (lift exactly 0.0), which is our sanity check. Code: `engine/src/policy/alertsOnly.ts` is used by both policies.

**4. Did you tune the numbers?**
No. The evaluator runs the same engine as `/live`, headless, deterministic by seed. The headline, +29.4 pts [28.6, 30.2], uses seeds 1–200; a fresh
block (1001–1200) gives +29.6 pts [28.8, 30.4], within the same range. The "Run full comparison" button on `/results` reruns it live.

**5. Which assumption is doing the work?**
Helper count matters most: 6 helpers instead of 24 cuts the lift to +20.1 pts [19.4, 20.8]. A faster fire plus 6 helpers gives
+15.0 pts [14.5, 15.6]. Help-request delay matters less (+26.6 pts [25.5, 27.7] at 5–10 min instead of 1–3) because the fire takes about an
hour to reach most homes in this town. Full table: [`SENSITIVITY.md`](SENSITIVITY.md).

**6. Where do the helpers come from?**
In a real deployment: county paratransit and accessible vans, school buses, home-care agencies, vetted volunteer
drivers (CERT-style), and neighbours who opt in. In the model they start at random road nodes and are always willing;
that is an assumption we list and test (far-from-fire start: +28.5 pts [27.4, 29.6]).

**7. How do you know who needs help?**
Today: the voice call. A real deployment would add an opt-in registry run with a county partner. In the model, households without a vehicle make a help request 1–3 min after the warning. We do not scrape or
infer disability from data.

**8. Privacy?**
We store synthetic data only. A real version should collect the minimum (location, mobility needs, number of people),
with explicit consent, encryption, access limited to dispatchers during an active incident, and deletion after. The
voice agent asks only for what dispatch needs.

**9. What if the voice AI gets it wrong?**
Gemini's output is constrained to a fixed schema and validated; anything unparseable falls back to a deterministic
parser. The agent never promises rescue and always gives the 911 line. Urgency only raises priority; a human dispatcher
would review in a real deployment.

**10. Does it scale?**
A 200-seed comparison (400 full simulations, 600 households each) takes about 40 s on 2 workers and about 14 s on a
12-core machine. Live dispatch re-plans every few simulated seconds for 24 helpers. A county-scale deployment would
partition by area; we have not tested that.

**11. How realistic is the fire model?**
Deliberately simple: wind-driven spread on a 50 m grid with fuel noise; no terrain, spotting or firebreaks. It produces
plausible arrival times for testing dispatch logic, not forecasts. A real deployment would ingest an operational fire
model's perimeter forecasts through the same interface (`FireModel.ignitionTime`).

**12. Why Amherst?**
It's where we are, and real OpenStreetMap roads (one-way streets, a real network) make routing honest. Moving from a
synthetic grid to real roads lowered our lift; we kept the harder version.

**13. What would a real deployment need?**
Partnerships with an emergency management office and transport providers, a consented registry, helper vetting and
liability coverage, integration with official evacuation orders and 911/CAD, telephony for outbound calls, and a field
pilot measuring real response times.

**14. Who pays?**
Our hypothesis: counties and emergency management agencies, and home-care or paratransit providers responsible for
the people they serve. We have not talked to buyers or validated pricing.

**15. What's the biggest weakness?**
We assume helpers are available, willing and reliable, and that people accept the ride. We haven't modelled breakdowns,
refusals or false requests. Those are next, and they could shrink the lift.
