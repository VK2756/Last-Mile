# Video: 2:30 shot list and narration

Based on [`docs/DEMO_SCRIPT.md`](../DEMO_SCRIPT.md), tightened to 2:30, with the unsourced opening claims removed (see
[`SOURCES.md`](SOURCES.md)). Numbers in brackets come from [`NUMBERS.md`](NUMBERS.md); paste them, never round them by
hand. The SIMULATION badge must be visible in every product shot.

**Record:** 1920x1080, browser at 100% zoom, `?pitch=1` on `/live` (bigger type, no dev chrome), cursor highlighting on,
notifications off. Record each shot separately; cut on the narration. Keep a backup take of `/live?mock=1&pitch=1`.

| time | shot (URL, action) | narration (≈ 150 words/min) |
|---|---|---|
| 0:00–0:12 | `/` hero, live preview playing; slow push-in on the headline | "An evacuation alert only helps if you can act on it. Without a car, in a wheelchair, on oxygen, or on a landline that never got the text, 'evacuate now' isn't a plan. Last Mile is live dispatch for the people who can't drive out." |
| 0:12–0:50 | `/live?pitch=1`, press Space; let the fire run ~20 s; point at both scoreboards | "Same fire, same town: 600 synthetic households on real Amherst streets. Left, alerts only. Right, Last Mile. Every home has a countdown to the fire. On the right, the dispatcher matches each home that can't leave alone to the nearest helper who can actually carry them, and re-plans as roads close." |
| 0:50–1:10 | Click a household with a helper assigned; zoom on "Why this helper?" | "And it explains every choice: a wheelchair-capable van, how far away, how many minutes before the fire it arrives." |
| 1:10–1:40 | `/call?scenario=…&household=…`, Spanish, speak one answer; cut to `/live` showing the household flip to needs help | "Many of the people who most need help never open an app, so Last Mile calls them, in their language, landlines included. Gemini turns the answer into needs, and the household appears on the dispatch map. It never promises rescue, and it always says: in immediate danger, call 911." |
| 1:40–2:15 | `/results`: lift card, then chart, then the harsher-assumptions panel | "One run proves nothing, so we ran 200 paired simulations: same seed, both policies. If neighbours don't give each other rides, vulnerable households evacuated go from 45.1% to 74.5%, a lift of 29.4 points, 95% interval 28.6 to 30.2. If a third of neighbours give rides it's 12 points; with neighbours, families and early alerts all working well, about 4. Last Mile wins every time, by 4 to 29 points. This is a simulation with synthetic people, and every assumption is on the page." |
| 2:15–2:30 | `architecture.svg`, then `/` footer with team names | "Gemini for the calls, MongoDB Atlas for geospatial matching, Tiger Data for the time series, Vultr running the engine, Vercel for the web. Built at HackUMass by Vidhaan, Shrish, Anant, Rishabh and Prince." |

## Checklist before upload

- [ ] Every bracketed number replaced from `NUMBERS.md` (same values as Devpost and the DEV post)
- [ ] "Simulation" said out loud at least once (1:40–2:15) and badge visible on screen
- [ ] No claim not in `SOURCES.md`; no rescue promise; the 911 line is audible in the `/call` shot
- [ ] Length ≤ 2:30 (Devpost limit is longer; shorter is better for judges)
- [ ] Captions burned in or uploaded (judges often watch muted)
- [ ] Upload unlisted/public; link in Devpost and `PRIZE_CHECKLIST.md`

## Backup if the engine is down while recording

Use `/live?mock=1&pitch=1` (browser-only mock, labelled "mock data") for the 0:12–1:10 shots and say "a recorded
simulation" instead of "live". Do not show `/results` with the SAMPLE DATA ribbon as if it were the result; instead show
the numbers from `NUMBERS.md` as a title card citing the evaluator run.
