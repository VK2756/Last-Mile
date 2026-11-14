# Three-minute video shot list

Based on `docs/DEMO_SCRIPT.md`, with its unverified opening claims removed. Record production only after the freeze gate passes. Keep an offline `/live?mock=1` capture as backup and label it clearly.

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:15 | Title and live view | "During the 2018 Camp Fire, evacuation traffic and changing fire conditions created serious danger. Last Mile tests active dispatch for households that cannot drive away. This is a simulation." |
| 0:15–1:00 | `/live` split screen, click Run | "Same synthetic town, fire, and seeded households. Left: alerts only. Right: active dispatch. Watch risk, helper movement, and the scoreboards." |
| 1:00–1:30 | Household assignment detail | "The system explains why this helper was chosen, including capacity, accessibility, route, and time before modeled fire impact." |
| 1:30–2:10 | `/call`, then return to `/live` | "A simulated resident describes their needs in Spanish. Gemini extracts them, and the live map updates. If the API is unavailable, a deterministic parser keeps the demo usable." |
| 2:10–2:40 | `/results` | "Across [RUNS] paired simulated runs, vulnerable evacuation was [BASE]% versus [LAST]%. The modeled lift was [LIFT] points, 95% interval [LOW, HIGH]. These numbers come from the evaluator, not a real disaster." |
| 2:40–3:00 | Architecture and ending | "The prototype connects Gemini, MongoDB Atlas, Tiger Data, Vultr, and Vercel. We would validate it with emergency managers and disability advocates before real-world use." |

Replace every bracketed result with output from a reproducible `/montecarlo` run. If the lift is not positive, state the actual result. Show the SIMULATION badge and assumptions during the relevant shots. Avoid any rescue promise.
