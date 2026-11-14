# Lane B: WEB (what the judges see) — Shrish, Claude Code

You own `web/**` EXCEPT `web/app/call/**`, `web/app/api/**`, `web/e2e/**`, `web/playwright.config.ts` (Lane C). That includes `/`, `/live`, `/results`, the UI kit and Vercel. A judge decides in 10 seconds: it must look like a real crisis-operations product and never break. Link to `/call` from your nav.

Stack: Next.js App Router (TypeScript), Tailwind (add via a `deps:` PR), MapLibre GL JS (GeoJSON layers, NOT per-household DOM markers: 600+ points must stay 60fps), Recharts. Package `@lastmile/web`. Types from `@lastmile/contracts`. Use the `frontend-design` skill if available: distinctive dark ops-center look, big readable type, nothing template-like. You publish the shared UI kit in `web/components/ui/**`; Lane C reuses it.

## M1 (first 3-4h): runnable on fixtures, deployed
1. Add scripts `dev`, `build`, `typecheck`, `lint`, `test` to `web/package.json`; app shell + nav (Live, Results, Call). Vercel: Root Directory `web`, "Include source files outside of the Root Directory" ON, env `NEXT_PUBLIC_ENGINE_URL`. Publish the UI kit within about 90 min and say so in your status file.
2. `web/lib/stream.ts`: `useScenarioStream(config)` returning `{init, frame, status}` with two backends: real SSE to `NEXT_PUBLIC_ENGINE_URL` and **mock mode** (`?mock=1`) animating `@lastmile/contracts/fixtures` (growing fire, moving helpers). Parse every event with `StreamEvent.parse`. Mock mode is also the last-resort demo fallback.
3. `/live` single map: dark MapLibre style with a no-tiles fallback style (flaky venue network must not kill the demo), fire polygon, household dots by `status`, helpers, animated routes, sim clock, permanent **SIMULATION** badge, "Assumptions" drawer from `SimInit.assumptions`.

## M2 (by ~3pm Sat): the signature demo
4. **Split-screen**: two synchronized maps, same fire and same people. LEFT "Alerts only", RIGHT "Last Mile" (two scenarios with identical config except `policy`). One Run button, shared clock, big live scoreboards (evacuated / trapped / vulnerable evacuated), controls via `POST /scenarios/:id/control`.
5. **Operator panel** (Last Mile side): at-risk households sorted by `ttiSeconds` with countdown chips; click to fly there and show `Assignment.reason` ("Why this helper?"). A highlight: make it great.
6. Scenario picker (wind, ignition, helper count, seed) with 3 curated presets plus Randomize.

## M3 (by ~9pm Sat): results + polish
7. `/results` (`web/app/results/page.tsx`): calls `POST /montecarlo`; both policies' evacuated and vulnerable-evacuated rates with 95% CI error bars, the paired lift, the assumptions list, a loading state (or cached result) and an error state. Build it against `MonteCarloComparison` from fixtures first.
8. Landing `/` (hero + 10-second explainer + Run demo + stack strip: Gemini, MongoDB Atlas, Tiger Data, Vultr, Vercel) and **pitch mode** (`?pitch=1`: dev chrome hidden, bigger type; space = start, R = reset, 1/2/3 = presets).
9. Failure UX: SSE auto-reconnect; if the engine is unreachable show a clear banner with one-click switch to mock mode. Never a blank screen. Respect `prefers-reduced-motion`; never rely on color alone for status (icons/shapes).
10. STRETCH: `/dashboard` with Tiger Data time-series charts (Lane C provides `/api/risk-series`).

## Tests
Unit: stream parser rejects malformed events; mock stream yields valid frames. Typecheck/build clean (Vercel preview on every PR). Add stable `data-testid`s: `map-left`, `map-right`, `scoreboard-left`, `scoreboard-right`, `run-button`, `sim-badge` (Lane C's e2e uses them).

## Done means
Production Vercel URL: split-screen against the real engine, `/results` with real CIs, no console errors, SIMULATION badge always visible, "Why this helper?" works, `?mock=1` works offline.
