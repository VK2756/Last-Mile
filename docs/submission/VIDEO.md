# Video: 2-minute script and shot list

Same beats, in the same order, as the live demo in [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md), cut to 2:00. Numbers come from
[`NUMBERS.md`](NUMBERS.md) and [`BASELINE_REVIEW.md`](BASELINE_REVIEW.md); facts from [`SOURCES.md`](SOURCES.md). The
SIMULATION badge must be visible in every product shot, and "simulation" is said out loud.

**Record:** 1920x1080, browser at 100% zoom, production domain, `?pitch=1` on `/live`, cursor highlight on,
notifications off. Record each shot as its own take and cut on the narration (about 150 words per minute). Burn in
captions: judges often watch muted.

## Shot list

| time | runbook beat | shot (URL, action) | on screen | narration |
|---|---|---|---|---|
| 0:00–0:12 | 0:00 hook | `/` hero, live preview playing; slow push-in | headline, SIMULATION badge | "An evacuation alert only helps if you can act on it. Without a car, in a wheelchair, on oxygen, 'evacuate now' isn't a plan. Last Mile is live dispatch for the people who can't drive out." |
| 0:12–0:20 | (DEMO_SCRIPT hook) | title card over the hero, blurred | "2018 Camp Fire: ~40,000 evacuated, 85 died. Source: NIST TN 2252" | "In the 2018 Camp Fire, about 40,000 people evacuated and 85 died." |
| 0:20–0:42 | 0:15–0:45 split screen | `/live?pitch=1`, press Space, let it run ~15 s | both maps, countdown chips, scoreboards pulling apart | "Same fire, same synthetic town on real Amherst roads. Left, alerts only. Right, Last Mile. Every home has a countdown to the fire, and the dispatcher sends the nearest helper who can actually carry them, re-planning as roads close." |
| 0:42–0:54 | 1:00 why this helper | click an assigned home (diamond or square); zoom on the card | "Why this helper?" line | "And it explains every choice: what vehicle, how far away, how many minutes of margin before the fire." |
| 0:54–1:14 | 1:30–2:00 the call | `/call?scenario=…&household=…&language=es`: Start call, type or say the Spanish line, then cut to `/live` with that household now needing help | 911 line, "What we learned" card | "No app, no sign-up. A Gemini voice agent asks what each home needs, in their language, and puts it on the dispatch map. It never promises rescue; it always says, in immediate danger, call 911." |
| 1:14–1:32 | 2:10 the proof | `/results`, hold on the lift card | lift card with CI, "Monte Carlo engine" pill | "One run proves nothing, so we ran 200 paired simulations. If neighbours don't give each other rides, vulnerable households that got out rise from 45.1% to 74.5%: 29.4 points, 95% interval 28.6 to 30.2." |
| 1:32–1:50 | 2:25 the baseline | scroll to "How much does the baseline matter?", click "Neighbours give rides 30%", wait for the row | the row filling in from the engine | "But that baseline is pessimistic. If a third of neighbours give rides, the gain is about 12 points; if neighbours, families and early alerts all work well, about 4. Last Mile wins every time, by 4 to 29 points. This is a simulation with synthetic people, and every assumption is on this page." |
| 1:50–2:00 | 2:40 close | `architecture.svg`, then `/` footer | sponsor stack, team names | "Gemini for the calls, MongoDB Atlas for matching, Tiger Data for the time series, Vultr for the engine. Built at HackUMass by Vidhaan, Shrish, Anant, Rishabh and Prince." |

Spanish line for the call (it also parses in both no-Gemini fallbacks): "Somos 2 personas, mi esposo usa silla de ruedas y
no tengo auto."

## Checklist before upload

- [ ] `node docs/submission/tools/check-numbers.mjs` passes, and the numbers spoken match NUMBERS.md (refreshed from the
      deployed engine on submission morning)
- [ ] "Simulation" said out loud (1:32–1:50) and the badge visible in every product shot
- [ ] The range (4 to 29 points) is said; never the 45% to 74% figure on its own
- [ ] No claim outside `SOURCES.md`; no rescue promise; the 911 line is audible or visible in the `/call` shot
- [ ] Length ≤ 2:00; captions burned in
- [ ] Uploaded public or unlisted, then `node docs/submission/tools/fill-links.mjs --video <url>`

## If the engine is down while recording

Use `/live?mock=1&pitch=1` (browser-only mock, labelled "mock data") for 0:20–0:54 and say "a recorded simulation"
instead of "live". `/results` will say "Run the engine to see results" and show no numbers; never record the greyed
sample preview as if it were a result. Show NUMBERS.md's baseline table as a title card citing the evaluator run instead.
