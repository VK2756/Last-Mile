# Lane B status (WEB) — Shrish / Claude Code
_Updated: Sat 14 Nov, M1._

## Done (M1, on branch b/m1-live)
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
M2: split-screen (`map-right`, `scoreboard-right`), operator panel, scenario picker. M3: /results, landing, pitch mode.

## Blockers
- Push to GitHub from this agent is 403 (Claude GitHub App lacks write access to VK2756/Last-Mile). Vercel not connected yet.
