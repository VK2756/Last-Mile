# Last Mile

**Tagline:** Live evacuation dispatch for people who cannot drive away.

## Inspiration

Fast moving wildfires can overtake warnings and cut off routes, as documented in [NIST's Camp Fire case study](https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra). [CDC](https://www.cdc.gov/disability-emergency-preparedness/about/) describes transportation and communication barriers for people with disabilities. We wanted to test whether learning a household's needs and assigning a capable nearby helper could improve outcomes within a transparent simulation.

## What it does

Last Mile runs the same **synthetic** fire scenario under two policies: alerts only and active dispatch. The live view shows changing household risk, helper assignments, routes, and an explanation of each match. A call screen captures a resident's needs through voice or text, with Gemini triage and a deterministic fallback. A paired-seed Monte Carlo evaluator compares the policies and displays uncertainty intervals. The system is a decision-support prototype, not an emergency service.

## How we built it

TypeScript contracts connect a Node simulation engine and a Next.js web app. The engine models fire spread, household behavior, routing, and dispatch. Gemini extracts needs from a simulated resident conversation. MongoDB Atlas stores scenario and household data with a geospatial helper query; Tiger Data stores risk and dispatch time series with hypertables and continuous aggregates. Vultr runs the engine behind Caddy HTTPS, and Vercel hosts the web app. **Before submitting, verify every named service is deployed and used by a real run; remove any unverified claim.**

## Challenges

We needed the same seeded scenario under both policies, reproducible timing, safe handling of partial database outages, and a demo that still works without external credentials. We separated the interfaces into shared contracts and added in-memory and deterministic fallbacks. The UI labels all results as simulation outputs.

## Accomplishments

The engine streams parseable scenario frames, and the data and voice packages pass local tests. **Insert verified production demo and Monte Carlo results here after the final run.** Report vulnerable evacuation rates, paired lift, 95% confidence interval, run count, and the assumptions shown in `/results`. If the lift is zero or negative, say so.

## What we learned

Evacuation support depends on more than the warning itself: transport capability, mobility, road access, and how early needs are known all matter. Our model is deliberately simplified; its results reveal the sensitivity of those assumptions, not a real-world effectiveness estimate.

## What's next

Validate assumptions with emergency managers and disability advocates, compare routing against observed road closures, and test privacy preserving workflows before any real-world use.

## Simulation assumptions to disclose

All people and helpers are synthetic. Fire spread, travel time, behavior, helper capacity, and warning uptake are modeled assumptions. Matching assumes helpers are available and willing. The evaluator uses paired seeds to compare modeled policies; it cannot establish real-world lives saved.
