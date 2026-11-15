---
title: "We built an evacuation dispatcher, then tried hard to prove it doesn't work"
published: false
tags: hackumass, mlh, gemini, mongodb, ai
---

<!-- DEV allows up to 4 tags on some forms; if so drop `ai`. Numbers: copy from NUMBERS.md, never retype. -->

> **Everything in this post is a simulation with synthetic people.** No real resident, helper or fire is involved, and
> nothing here is a claim about lives saved in a real disaster.

## The problem an alert can't solve

"Evacuate now" assumes you can. If you don't have a car, use a wheelchair, depend on oxygen, or have a landline that
never got the text, an alert is information without a way out. NIST's
[case study of the 2018 Camp Fire](https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra),
where about 40,000 people evacuated and 85 died, digs into how notification, traffic and rescues played out, and the
[CDC](https://www.cdc.gov/disability-emergency-preparedness/about/) points out that evacuation plans and alerts can miss
disability-related needs.

At HackUMass XIV our team of five built **Last Mile**: live dispatch for the households that can't leave on their own.
It predicts when the fire reaches each home, matches each household that needs help to the nearest helper who can
actually carry them, re-plans as the fire moves, and uses a Gemini voice agent to phone homes and learn their needs.

The more interesting part, and the reason for this post, is how we tried to keep ourselves honest about whether it works.

## A demo is not evidence

Our `/live` page runs the same fire twice, side by side: alerts only on the left, Last Mile on the right. It looks
great. It also proves nothing: one run is one roll of the dice, and we chose the dice.

So the headline number comes from a **paired Monte Carlo evaluator**:

1. For each random seed, build one synthetic town (600 households on real Amherst, MA streets from OpenStreetMap), one
   fire and one set of helpers. The population and fire depend only on the seed, never on the policy.
2. Run it twice: alerts only, then Last Mile.
3. Repeat for 200 seeds and report the mean paired difference with a 95% bootstrap confidence interval.

## Don't build a strawman baseline

The easiest way to "win" a simulation is a lazy baseline where nobody leaves unless your product saves them. We made the
baseline a strict subset of our policy. In both runs, households with a car pack and leave on their own after the
alert, and a quarter of households without a car get picked up by family. Last Mile can only **add** dispatched help
on top. A built-in sanity check: with zero helpers the two policies must be identical, and they are (lift +0.0).

## What we found (in simulation)

With our default baseline, vulnerable households evacuated before the fire arrived went from **45.1% with alerts only
to 74.5% with Last Mile**, a paired lift of **+29.4 pts** (95% CI [28.6, 30.2]) over 200 seeds. A fresh block of seeds
that the preset never used gives +29.6 pts [28.8, 30.4], so the number isn't an artifact of which seeds we picked.

That default has a catch, and a teammate found it: neighbours in our baseline never give each other rides.

## Then we tried to break it

A single number hides its assumptions, so we moved them, one at a time and together:

| harsher assumption | lift |
|---|---|
| help requests arrive 5–10 min after the warning instead of 1–3 | +26.6 pts [25.5, 27.7] |
| helpers start far from the fire | +28.5 pts [27.4, 29.6] |
| 6 helpers instead of 24 | +20.1 pts [19.4, 20.8] |
| a faster fire (35 mph wind) | +23.3 pts [22.6, 23.9] |
| faster fire **and** 6 helpers | +15.0 pts [14.5, 15.6] |

The lift roughly halves in the worst case but never reaches zero. Of these, the number of helpers matters most; how fast
help requests arrive matters surprisingly little, because in this town the fire needs about an hour to reach most homes.
That is a property of our fire model and town, exactly the kind of thing a real deployment would need to check.

## The baseline was too pessimistic

Then we made the baseline stronger. Rishabh added knobs for neighbours giving rides, more family pickups, faster
departures and earlier alerts, and reran 33 configurations with 100 paired seeds each:

| alerts-only baseline | alerts only | Last Mile | lift |
|---|---|---|---|
| no neighbour rides (our default) | 45.0% | 74.3% | +29.3 pts [28.1, 30.5] |
| 30% of neighbours with a car give a ride | 65.0% | 77.3% | +12.3 pts [11.5, 13.2] |
| every neighbour with a free seat gives a ride | 72.8% | 78.2% | +5.4 pts [4.8, 6.0] |
| neighbours, families and early alerts all working well | 84.5% | 88.6% | +4.1 pts [3.5, 4.8] |

Last Mile won in all 33, but neighbour rides close most of the gap. So the honest headline isn't "+29 points". It's
**about 4 to 29 points, depending on how much informal help a town already has, and about 12 if a third of neighbours
pitch in.** Coordinated dispatch matters most where informal help is thin, and for wheelchair users, whom our modelled
neighbour rides can't carry. We haven't yet measured how much of the remaining gain is those households.

## How it's built

- **Engine (Node + TypeScript on Vultr):** arrival-time fire spread on a 50 m grid; Dijkstra routing that closes roads
  60 s before the fire reaches them and slows roads in smoke; a dispatcher that does greedy insertion by deadline,
  local search, then re-verifies every trip with exact travel times. Capacity, wheelchair capability and deadlines are
  hard constraints; homes no trip can reach in time are flagged, never silently dropped.
- **Gemini voice triage:** the browser transcribes speech, Gemini returns JSON constrained to our shared schema (needs,
  ride, can walk to the road, residents, urgency), and the result flips that household to "needs help" on the live map.
  The agent never promises rescue and always says to call 911 in immediate danger. No key? A deterministic parser
  keeps the demo alive.
- **MongoDB Atlas** stores households and helpers and finds candidates with `$geoNear`; **Tiger Data** keeps risk and
  dispatch time series in hypertables with continuous aggregates; **Vercel** serves the Next.js front end.

## What a simulation can't tell you

It can't tell you how many neighbours in a real town would give a ride, whether helpers show up, whether people answer
an unknown number, or whether a county can maintain a registry of who needs help without violating their privacy. It can tell you which assumptions matter most, and that is
where we would start with emergency managers, home-care agencies and disability advocates.

*Last Mile is a HackUMass XIV prototype, not an emergency service. In immediate danger, call 911.*

Code: https://github.com/VK2756/Last-Mile · Demo: [DEMO_URL] · Results with every assumption: [DEMO_URL]/results
