# Registered-number phone demo

This is an **automated AI call for a wildfire evacuation simulation using synthetic data**. It is not an emergency service. The agent tells the recipient to call 911 in a real emergency and never promises rescue. Only E.164 numbers in `DEMO_PHONE_NUMBERS` can receive a call.

## Flow

1. The Mac runs `@lastmile/phone` on loopback port 8443 next to the engine. Tailscale Funnel publishes that port as HTTPS/WSS on the Mac's `*.ts.net:8443` address. The web page sends `POST /api/phone/call`; its Next.js server forwards the request with `PHONE_SHARED_SECRET`. The browser never sees that secret or the Gemini/Twilio keys.
2. The phone service checks the shared secret and exact allowlist, limits each number to three calls per hour and one active call across the service, and obtains a Live-capable model from the key's model list. `GEMINI_LIVE_MODEL` is an optional preference. It creates a Twilio outbound call with inline TwiML and a signed, single-use stream parameter. A five-minute Twilio time limit and local timer end the call.
3. Twilio connects to `/media` over WSS. The service verifies the first `start` event's token and call SID before opening a Gemini WebSocket using the server-side key. Twilio 8 kHz mu-law is converted to 16 kHz PCM; 24 kHz Gemini PCM is filtered and encoded as 8 kHz mu-law for Twilio. Gemini VAD detects turns; an interruption sends Twilio `clear` to discard queued playback. Input/output transcription is retained for triage and the finished transcript.
4. After each resident turn, `@lastmile/ai` extracts needs. If both scenario and household IDs were supplied, the service posts the result to `ENGINE_URL/scenarios/:id/households/:hid/needs`. With Atlas configured, the finished transcript is written to `triage_calls`; database failure cannot end the call.

## Environment names

| Name | Where | Purpose |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Mac only | Twilio REST authentication |
| `TWILIO_FROM_NUMBER` | Mac only | Twilio caller ID in E.164 format |
| `DEMO_PHONE_NUMBERS` | Mac only | Comma-separated exact E.164 allowlist |
| `PHONE_SHARED_SECRET` | Mac and Vercel server | Authenticates `POST /call`; never prefix with `NEXT_PUBLIC_` |
| `PUBLIC_PHONE_URL` | Mac only | Public HTTPS origin, e.g. `https://your-node.ts.net:8443` |
| `ENGINE_URL` | Mac only | Local engine origin, normally `http://127.0.0.1:8080` |
| `GEMINI_API_KEY` | Mac only | Server-side Gemini Live and structured triage |
| `GEMINI_LIVE_MODEL` | Mac only, optional | Preference from the key's discovered Live models |
| `MONGODB_URI`, `MONGODB_DB` | Mac only, optional | Atlas transcript sink |
| `PHONE_SERVICE_URL` | Vercel server, optional Mac CLI | Public phone service origin; Mac CLI defaults to local port 8443 |
| `NEXT_PUBLIC_PHONE_DEMO` | Vercel build | Set to `1` to show **Call my phone** |
| `PHONE_PORT` | Mac only, optional | Local service port, default 8443; keep aligned with Funnel |

## Steps on Anant's Mac

1. Install Node 22, pnpm 9, and Tailscale. Sign in to Tailscale and enable Funnel for this node. In the checkout, run `git pull --ff-only` and `pnpm install --frozen-lockfile`.
2. Put the Mac-only values above in a local ignored environment file sourced by `scripts/mac-host.sh` (root `.env` is the standard place; `scripts/mac-host.sh` reads root `.env` first, then `engine/.env` if present, which overrides it). Restrict its file permissions. Register only your own/consenting demo number(s) in `DEMO_PHONE_NUMBERS`. Never place Twilio or Gemini secrets in Vercel's public variables.
3. Set `PUBLIC_PHONE_URL` to the Mac's Funnel HTTPS origin ending in `:8443`, and `ENGINE_URL=http://127.0.0.1:8080`. Run `bash scripts/mac-host-install.sh`. It starts the engine supervisor and configures the existing engine Funnel plus a separate phone Funnel at external port 8443. `TWILIO_ACCOUNT_SID` makes the supervisor start the phone service. Use `tailscale funnel status` and `curl -fsS https://YOUR-NODE.ts.net:8443/health` to check reachability.
4. Set Vercel server variables `PHONE_SERVICE_URL=https://YOUR-NODE.ts.net:8443` and the same `PHONE_SHARED_SECRET`. Set `NEXT_PUBLIC_PHONE_DEMO=1`, then redeploy the web app. Open `/call/live`, confirm **SIMULATION** and the 911 notice, and submit only an allowlisted number.
5. In the Mac terminal, load your ignored environment file without printing it (for example, `. scripts/load-env.sh; lm_load_env .env`, run from the repo root (a plain `. ./.env` breaks if a value contains `&`)). For a terminal-initiated call, use `pnpm phone:call -- +1XXXXXXXXXX`. It prints only the Twilio call SID and status. Answer the call, test an interruption, say “stop,” then confirm the call ends. Check the engine's household needs only with a scenario and household in the page URL.

## No-key test and limits

`pnpm --filter @lastmile/phone test` uses mock sockets and no credentials. `GET /health` works without keys, while `POST /call` cannot dial until all required Mac values are set. A real Twilio/Gemini call and Mac Funnel have not been tested from this Windows checkout.

Allowlist, hourly counters, single-use tokens, and active-call state are in memory; restarting the service clears them. This is a controlled hackathon demo, not a public dialer. Twilio account restrictions and charges still apply. The transcript sink is optional; calls continue when Atlas or the engine is unavailable. Automatic transcription can arrive out of order, so a delayed fragment may join the next turn.

References: [Twilio outbound Calls](https://www.twilio.com/docs/voice/api/call-resource), [TwiML Stream parameters](https://www.twilio.com/docs/voice/twiml/stream), [Media Stream events](https://www.twilio.com/docs/voice/media-streams/websocket-messages), [Gemini Live WebSocket](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket), [Gemini VAD](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [Tailscale Funnel CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel).
