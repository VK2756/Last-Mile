# Lane B status (WEB): Shrish / Claude Code
_Updated: Sat 14 Nov, evening. Main green (postmerge ✅ after every merge)._

## Merged today
- #115 a11y: `--color-fg-dim` #5e6b79 -> #8290a0 (>= 4.52:1 on bg, every surface and line; closes #106). Closed drawer is `inert`, map canvases uniquely labelled, sr-only h1 on /live. **Lighthouse accessibility 100** on /, /live, /results, /call, /dashboard, /how-it-works. axe: 0 violations everywhere except Lane E's pipeline diagram on /how-it-works (#111).
- #121 map: style starts tile-free (MapLibre `load` needs no network); OpenFreeMap tiles stream in underneath afterwards; until MapLibre itself is up, `StaticMap` draws the live frame as SVG. "Loading map" is gone: Slow 3G 9.0 s -> 0 s; tiles blocked: map ready 0.4 s.
- #125 `NEXT_PUBLIC_SITE_URL` (lib/site.ts): Copy demo link, pitch QR, root metadataBase/og:url, new /sitemap.xml + /robots.txt; falls back to window.location.origin. Documented in docs/VERCEL.md. Closes #108: postmerge.sh 3x in a row, all green.
- #134 mock realism: no home within 10 fire-minutes of the ignition; Last Mile dispatches from ~T+10-20 s; 0 trapped in the first 10 sim-min on presets 1-3; still labelled mock. Operator rows say "No helper" only for needs_help homes.
- #137 engine unreachable: engine URL set but /health fails (down/CORS/blocked) -> mock + banner "Engine unreachable, showing the mock. Retrying..." with 5/10/15/30 s re-checks, auto-switch back to the engine. Tested: closed port (banner at 1.5 s, no Application error), CORS-blocked engine (stays on mock), engine back (LIVE · ENGINE at next check).
- #140 "Talk to the voice agent" header link -> /call/live (exists on main). Landing hero button is Lane E's file: #139.
- #146 (closes #126, #127): engine restart mid-run -> /live sees the 404, restarts the same scenario with a notice (tested: back 4 s after the engine). Picker shows all 6 engine presets (keys 1-9). Each run fast-forwards at 60x to the first dispatch, then returns to the chosen speed. #146 merged with a stale test (3 -> 6 presets) and turned main red for ~3 min; fixed forward in #147, main CI green.
- Devpost gallery: `docs/submission/media/01-07*.png`, 1920x1080, real local engine, QR shows the Vercel URL, each < 1 MB.

## For Lane E (Prince)
- Shared UI: `SimBadge`, `AssumptionsList`, `Stat`, `SectionHeading`/`eyebrowClass`, `buttonClass`, `VOICE_AGENT_HREF` from `@/components/ui`. Open for you: #111 (diagram a11y), #139 (landing voice button).

## Needs the human
- Vercel: set `NEXT_PUBLIC_ENGINE_URL=https://<engine>` and (optional) `NEXT_PUBLIC_SITE_URL=https://<domain>`, then redeploy. Then send me the https engine URL for the production check (CORS, LIVE · ENGINE, 3-min SSE).
- Demo laptop: Low Power Mode caps Chrome at 30 fps; plug in / turn it off before pitching.

## Run it locally
- Engine: `pnpm --filter @lastmile/engine start` (:8080). Web: `pnpm --filter @lastmile/web demo` (http://localhost:3102, separate `.next-demo`, so verify can't break it).
