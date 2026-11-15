# Demo runbook: the judging table (one page)

**Simulation with synthetic people.** Say it out loud once. Numbers: [`NUMBERS.md`](NUMBERS.md). Long script: [`../DEMO_SCRIPT.md`](../DEMO_SCRIPT.md).

## Tabs (open in this order, production domain)

| # | URL | ready when |
|---|---|---|
| 1 | `https://last-mile-iamvk.vercel.app/` | live preview playing in the hero |
| 2 | `https://last-mile-iamvk.vercel.app/live?pitch=1` | paused on frame 0, both maps drawn |
| 3 | `https://last-mile-iamvk.vercel.app/call?scenario=<id>&household=<hid>&language=es` | IDs copied from a red-triangle household in tab 2 |
| 4 | `https://last-mile-iamvk.vercel.app/results` | lift card shows the engine's number (default baseline, 200 seeds), pill says "Monte Carlo engine · cached preset" |
| 5 | `https://last-mile-iamvk.vercel.app/how-it-works` | only if asked "how does it decide?" |
| — | `https://vks-macbook-pro.tailb85bea.ts.net/health` | `{"ok":true,...}` (check once, then close) |

## Fill the links (once, when the deploy is up)

One command fills every link in `docs/submission/**` (not `evidence/`). Re-running is safe; a new URL replaces the old one.

```bash
node docs/submission/tools/fill-links.mjs --demo https://<web> --api https://<engine> --video https://<video> --post https://<dev-post>
node docs/submission/tools/fill-links.mjs --check   # exits 1 while any token is left
```

<!-- fill-links:off -->

| token | flag | what |
|---|---|---|
| `[DEMO_URL]` | `--demo` | web app, no trailing slash (`[DEMO_URL]/live`, `[DEMO_URL]/results`) |
| `[API_URL]` | `--api` | engine (`[API_URL]/health`) |
| `[VIDEO_URL]` | `--video` | demo video |
| `[DEV_URL]` | `--post` | DEV Writing Challenge post |
| `[DOMAIN]` | from `--demo` | host name only, for SPONSORS.md |

<!-- fill-links:on -->

Values used are saved in `docs/submission/links.json`; commit it with the filled docs.

## The 3 minutes, 15 seconds at a time

| time | tab | do | say |
|---|---|---|---|
| 0:00 | 1 | nothing | "An alert only helps if you can act on it. Without a car, a wheelchair, oxygen: 'evacuate now' isn't a plan." |
| 0:15 | 2 | press **Space** | "Same fire, same synthetic town on real Amherst roads. Left alerts only, right Last Mile." |
| 0:30 | 2 | point at right map | "Every home has a countdown; the dispatcher sends the nearest helper who can carry them." |
| 0:45 | 2 | point at scoreboards | "Watch vulnerable households evacuated pull apart." |
| 1:00 | 2 | click an assigned home (diamond/square) | "It explains every choice:" read the "Why this helper?" line. |
| 1:15 | 2 | close card | "Re-planned every few seconds as roads close." |
| 1:30 | 3 | **Start call** | "No app, no sign-up, landlines work. It always says: in immediate danger, call 911." |
| 1:45 | 3 | speak/type: "Somos 2 personas, mi esposo usa silla de ruedas y no tengo auto." | point at "What we learned": wheelchair, no vehicle, 2 people. |
| 2:00 | 2 | find that household | "Now it's on the dispatch map as needing help." |
| 2:10 | 4 | point at lift card | "200 paired simulations. If neighbours don't give rides: 45.1% vs 74.5% of vulnerable households out, +29.4 points, CI 28.6 to 30.2." |
| 2:25 | 4 | scroll to "How much does the baseline matter?" | "If a third of neighbours give rides it's +12; if neighbours, families and alerts all work well, about +4. Last Mile wins in all 33 setups, by 4 to 29 points. Every assumption is on this page." |
| 2:40 | 4 | — | "Gemini, MongoDB Atlas, Tiger Data, Vultr, Vercel. Next: validate with emergency managers. Thank you." |

## When something breaks

| symptom | fix (in this order) | say |
|---|---|---|
| `/live` shows "Live engine offline." | 1) click **Switch to mock mode**, or open `/live?mock=1&pitch=1` | "Browser mock of the same scenario; numbers come from the evaluator." |
| Venue Wi-Fi dead | 1) phone hotspot; 2) laptop offline build: `cd web && pnpm demo` (port 3102), then `localhost:3102/live?mock=1&pitch=1`; 3) play the recorded video | "Recorded run of the same simulation." |
| `/results` says "Run the engine to see results" | press **Retry** once; if still down, read the range from NUMBERS.md (phone) | "From our evaluator run; the engine isn't reachable from here." |
| "Run full 200-seed comparison" says busy | wait 30 s or skip; the cached preset is the same evaluator | — |
| `/call` mic denied | type into "Your answer", press **Send** | — |
| `/call` shows "local mock" | continue; it's labelled | "Gemini isn't reachable; a keyword fallback is answering." |
| Map tiles missing | add `&tiles=0` to the `/live` URL (offline basemap) | — |
| Unattended table / you step away | `/live?auto=1&pitch=1` loops the presets | — |

## Do not

- Quote any number that isn't in NUMBERS.md, or call SAMPLE/mock numbers results. `node docs/submission/tools/check-numbers.mjs` fails on any figure in the docs or web copy with no source.
- Quote +29 on its own. It is the top of a range (about 4 to 29 points) and only holds if neighbours don't give rides.
- Promise rescue or say "lives saved". Say "in our simulation".
- Use the excluded claims listed at the bottom of [`SOURCES.md`](SOURCES.md).
