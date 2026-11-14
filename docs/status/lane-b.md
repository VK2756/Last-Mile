# Lane B status (WEB) — Shrish / Claude Code
_Updated: Sat 14 Nov, M2 in progress._

## Done (M2)
- Split-screen `/live` merged (#25): LEFT Alerts only / RIGHT Last Mile, same config except policy, one Run, shared clock (frames buffered per side, shown at the slower side's t), pause/speed to both scenarios, mirrored cameras. testids `map-left/right`, `scoreboard-left/right`, `frame-counter`, plus e2e aliases `map-alerts`, `map-last-mile`, `score-alerts`, `score-last-mile`.
- Operator panel: at-risk households sorted by ttiSeconds, countdown chips, Vulnerable/All filter, click flies + shows Assignment.reason (`operator-panel`, `operator-row`, `operator-reason`).

## Done (M1, merged #19)
- **UI kit published: `web/components/ui/**`** (import from `@/components/ui`): AppShell (top bar + nav Live/Results/Call), Button, Badge, Banner, Panel, StatTile, SimBadge (`data-testid="sim-badge"`), CountdownChip, StatusIcon/ShapeGlyph, Drawer, Segmented, Spinner, EmptyState, Kbd, Logo. Tokens in `web/app/globals.css` (Tailwind v4 `@theme`: bg-surface, text-fg-muted, border-line, text-accent…). Lane C: wrap /call in `<AppShell right={<SimBadge />}>`.
- `web/lib/stream.ts` `useScenarioStream(config, {mock})` -> `{init, frame, final, status, error, control}`; real SSE + mock backend; every event goes through `StreamEvent.parse`.
- `web/lib/mock.ts` deterministic in-browser mock (fixtures + 140 seeded synthetic homes, both policies). Labelled "mock data"; NOT results.
- `/live`: MapLibre (GeoJSON layers, canvas icons, works with no tiles/glyphs), fire, households (shape = status, colour = time left), helpers, animated routes, clock, scoreboard, SIMULATION badge, Assumptions drawer, household card with "Why this helper?", engine-down banner -> one-click mock.
- URL flags: `?mock=1`, `?tiles=0` (offline basemap), `?speed=30`, `?pitch=1` (WIP).
- testids: `map-left`, `scoreboard-left`, `run-button`, `sim-badge`, `household-card`, `why-helper`, `assumptions-button`.

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
