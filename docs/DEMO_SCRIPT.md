# 3-minute demo (live judging; the 2:30 video version is `docs/submission/VIDEO.md`)

Numbers come from [`docs/submission/NUMBERS.md`](submission/NUMBERS.md) (real Monte Carlo, main @ `47c452c`); facts from
[`docs/submission/SOURCES.md`](submission/SOURCES.md). Re-run `node docs/submission/tools/numbers.mjs` against the deployed
engine on submission morning and update this page if anything moved. Say "simulation" out loud.

## Before judges arrive (2 min)

Open these tabs, in this order, on the demo laptop (production domain, not localhost):

1. `/` (landing, live preview playing)
2. `/live?pitch=1` (split screen, paused on frame 0; big type)
3. `/call?scenario=<id>&household=<hid>&language=es` (fill after step 2: click a red triangle on the right map, copy the
   scenario and household IDs from its card)
4. `/results` (wait until the lift card shows the engine's number; it is the cached preset, instant once the engine is warm)
5. `/how-it-works` (backup for "how does dispatch work?")

Check: SIMULATION badge visible in every tab; laptop on power; notifications off; volume up for the `/call` voice.

## Script and click path

**0:00 Hook (15 s), tab 1.** "An evacuation alert only helps if you can act on it. In the 2018 Camp Fire, about 40,000
people evacuated and 85 died; NIST counted nearly 200 evacuation-assistance and rescue events. Without a car, in a
wheelchair, on oxygen, 'evacuate now' isn't a plan. Last Mile is live dispatch for the people who can't drive out."

**0:15 Split screen (45 s), tab 2.** Press **Space**. "Same fire, same town: 600 synthetic households on real Amherst
streets. Left: alerts only. Right: Last Mile. Every home has a countdown to the fire. On the right, the dispatcher
sends the nearest helper who can actually carry each household, and re-plans as roads close." Point at both scoreboards
as the vulnerable-evacuated counts separate.

**1:00 Why this helper? (30 s), tab 2.** Click a household with a helper assigned on the right map (diamond or square).
In the card, read the "Why this helper?" line exactly as shown: kind of vehicle, minutes away, minutes of margin before
the fire. "It doesn't just dispatch; it explains every choice."

**1:30 The phone call (40 s), tab 3.** Click **Start call** (the assistant greets in Spanish and says to call 911 in
immediate danger). Click the mic and say, or type: "Somos 2 personas, mi esposo usa silla de ruedas y no tengo
auto." (this phrasing also parses in both no-Gemini fallbacks) Point at the "What we learned" card (wheelchair, no vehicle, no ride, 2 residents). "No app, no registration;
landlines work. Gemini turns the answer into needs." Switch to tab 2: the household is now "needs help" and gets a helper.

**2:10 The proof (30 s), tab 4.** "One run proves nothing, so we ran 200 paired simulations: same seed, both policies.
If neighbours don't give each other rides, vulnerable households evacuated go from **45.1%** with alerts only to
**74.5%** with Last Mile: **+29.4 points**, 95% CI **28.6 to 30.2**." Scroll to "How much does the baseline matter?":
"That baseline is pessimistic. If a third of neighbours with a car give a ride, the gain is **+12**; with neighbours,
families and early alerts all working well, about **+4**. Last Mile wins in all 33 setups we tried, by **4 to 29
points**. It matters most where informal help is thin. This is a simulation with synthetic people, and every assumption
is on this page."

**2:40 Stack + close (20 s).** "Gemini for the calls, MongoDB Atlas for geospatial matching, Tiger Data for the time
series, Vultr running the engine, Vercel for the web. Next we'd validate the assumptions with emergency managers and
disability advocates. Thank you."

## Backup plan

| problem | do this | say this |
|---|---|---|
| Engine down / venue Wi-Fi slow | tab 2 → `/live?mock=1&pitch=1` (runs entirely in the browser, labelled "mock data") | "This is the browser mock of the same scenario; the numbers I'll quote come from the evaluator." |
| No network at all | open a `next start` build on localhost with `?mock=1`, or play the recorded video | same as above |
| `/results` says "Run the engine to see results" | press **Retry** once; if still down, read the range from `docs/submission/NUMBERS.md` on your phone | "These are from our evaluator run at 47c452c; the live engine isn't reachable from here." |
| `/call` mic blocked | type the answer into "Your answer" and press Send | — |
| `/call` says "local mock" | fine to continue; it's labelled | "Gemini isn't reachable, so a keyword fallback is answering." |
| Unattended station | `/live?auto=1&pitch=1` loops through the presets | — |

See `docs/submission/DEMO_RUNBOOK.md` for the one-page table version.
