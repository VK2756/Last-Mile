# Lane B status (WEB) — Shrish / Claude Code
_Updated: Sat 14 Nov, M2 + pitch mode + stretch merged._

## Done (M2)
- Split-screen `/live` merged (#25): LEFT Alerts only / RIGHT Last Mile, same config except policy, one Run, shared clock (frames buffered per side, shown at the slower side's t), pause/speed to both scenarios, mirrored cameras. testids `map-left/right`, `scoreboard-left/right`, `frame-counter`, plus e2e aliases `map-alerts`, `map-last-mile`, `score-alerts`, `score-last-mile`.
- Operator panel: at-risk households sorted by ttiSeconds, countdown chips, Vulnerable/All filter, click flies + shows Assignment.reason (`operator-panel`, `operator-row`, `operator-reason`).
- Scenario picker: 3 presets from engine `GET /presets` (built-in copy when mock/offline), wind speed/direction, helpers, seed, click-map ignition, Randomize; edits apply on Run. testids `scenario-picker`, `preset-1..3`, `randomize`, `pick-ignition`.
- Pitch mode `?pitch=1`: nav, legend and picker sliders hidden, bigger type, opens paused on the first frame ("Press Space to start"). Keys on /live: Space start/pause, R reset, 1/2/3 presets, ? (or /) shortcuts overlay, Esc close. `web/package.json` has `e2e` (#13).
- Failure UX: engine-offline banner has Retry + Switch to mock (verified: engine killed -> banner; engine back -> Retry -> LIVE). Perf: 0 long tasks (>50ms) over 5s with 2x545 households streaming (prod build).
- docs/VERCEL.md: click-by-click Vercel setup; NEXT_PUBLIC_ENGINE_URL is baked in at build (redeploy after changing).
- Stretch: replay scrubber under the maps (both sides rewind together from a 5s-downsampled history while the runs continue; ←/→ ±30s, L = live; `replay-scrubber`, `replay-badge`, `replay-live`). Screenshot layout `?view=maps` (two maps + scoreboards only, no zoom buttons; add `&pitch=1` to hide nav).
- Basemap: CARTO raster tiles now need an API key (they render an "API KEY REQUIRED" watermark), so /live uses OpenFreeMap vector tiles (free, no key) styled dark here: roads, water, parks, buildings, no labels. Offline grid stays underneath; `?tiles=0` still forces offline.
- Polish (#59 + this): Inter/JetBrains Mono, rem type scale with root 16/17/20/28px at laptop/1080p/1440p/4K, glass panels, count-up numbers, skeletons, run verdict + winner highlight from real final metrics, maps refit on resize, icons follow UI scale, fire halo + pulsing front + decorative embers, helpers glide between frames (instant under reduced motion). Header fits 375px (#57, closes #54).

## Done (M1, merged #19)
- **UI kit published: `web/components/ui/**`** (import from `@/components/ui`): AppShell (top bar + nav), Button, Badge, Banner, Panel, StatTile, SimBadge (`data-testid="sim-badge"`), CountdownChip, StatusIcon/ShapeGlyph, Drawer, Segmented, Spinner, EmptyState, Kbd, Logo. Tokens in `web/app/globals.css` (Tailwind v4 `@theme`: bg-surface, text-fg-muted, border-line, text-accent…). Lane C: wrap /call in `<AppShell right={<SimBadge />}>`.
- `web/lib/stream.ts` `useScenarioStream(config, {mock})` -> `{init, frame, final, status, error, control}`; real SSE + mock backend; every event goes through `StreamEvent.parse`.
- `web/lib/mock.ts` deterministic in-browser mock (fixtures + 140 seeded synthetic homes, both policies). Labelled "mock data"; NOT results.
- `/live`: MapLibre (GeoJSON layers, canvas icons, works with no tiles/glyphs), fire, households (shape = status, colour = time left), helpers, animated routes, clock, scoreboard, SIMULATION badge, Assumptions drawer, household card with "Why this helper?", engine-down banner -> one-click mock.
- URL flags: `?mock=1`, `?tiles=0` (offline basemap), `?speed=30`, `?pitch=1`, `?view=maps`.
- testids: `map-left`, `scoreboard-left`, `run-button`, `sim-badge`, `household-card`, `why-helper`, `assumptions-button`.

## Run it locally
- `pnpm --filter @lastmile/engine start` (engine on :8080), then `pnpm --filter @lastmile/web demo` (prod build in `web/.next-demo`, served on http://localhost:3102, engine URL defaults to http://localhost:8080). The demo build dir is separate, so `pnpm verify` / `postmerge.sh` can't break a running demo.
- No `pnpm` on PATH? `corepack enable pnpm` (or prefix commands with `corepack pnpm`).

## Evidence
- `pnpm verify` ✅ (web: 13 unit tests incl. parser rejects malformed events, mock frames all parse).
- `next start` + Playwright: `/live?mock=1` renders, 0 console errors (besides blocked tile requests in sandbox).
- Against local engine (`tsx src/server.ts`, NEXT_PUBLIC_ENGINE_URL=http://localhost:8080): SSE streams, 0 console errors. Engine killed -> "Live engine offline" banner + Switch to mock.

## Other lanes
- Engine deploy (A/C): set `ENGINE_CORS_ORIGIN` to include the Vercel URL(s) (or `*` for the weekend), else the browser blocks POST /scenarios.

## Next
Scenario picker + presets, pitch mode, failure UX, docs/VERCEL.md. (/, /results, /dashboard, /call UI moved to Lane E.)

## Blockers
- None. Pushing works now. Vercel not connected yet (Vidhaan).
- #21 (Windows build): path-casing on Anant's checkout, explained on the issue.
