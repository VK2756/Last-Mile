# Live voice triage

`/call/live` offers a real-time Gemini Live conversation for **synthetic residents in a simulation**. It never serves as an emergency service. The page keeps a SIMULATION badge and a 911 notice visible. The existing `/call` browser speech and text flow remains available when Live is not configured or the connection fails.

## How it works

1. A click on **Start live call** activates audio playback and asks `POST /api/live-token` for a single-use ephemeral token. The server uses `GEMINI_API_KEY` to list available models, selects `GEMINI_LIVE_MODEL` if it is a listed Live audio model, otherwise selects the first listed Live audio model, and mints a token constrained to that model, audio replies, both transcriptions, and the fixed triage instruction. New sessions must start within one minute; messages expire after ten minutes. The long-lived key stays on the server. The installed SDK's token API documents `v1alpha`; the route tries it first and retries `v1beta` for compatibility with current Google documentation. The returned version selects the matching constrained WebSocket endpoint.
2. The browser connects directly to Gemini's constrained Live WebSocket with the ephemeral token. An AudioWorklet resamples the microphone to 16 kHz mono 16-bit PCM, sending 40 ms chunks. Gemini's automatic voice activity detection controls turns. Client microphone activity and server interruption events immediately clear queued playback. Reply PCM is scheduled in order at 24 kHz without gaps between chunks.
3. Input and output transcription appears on screen. After a user turn, the collected transcript goes to the existing `/api/triage` extractor. Its structured result updates **What we learned**. With `?scenario=<id>&household=<id>`, a completed result is posted to the engine's `/scenarios/:id/households/:hid/needs` endpoint.
4. `?debug=1` shows token state, input and output sample rates, microphone RMS level, first audio latency, and sanitized Live event JSON. Audio bytes and token values are omitted from debug output.

## Environment

- `GEMINI_API_KEY` — server-side only, in Vercel project environment for the web deployment. Never prefix it with `NEXT_PUBLIC_`.
- `GEMINI_LIVE_MODEL` — optional server-side preference. It must appear in the key's model list as a Live audio model; otherwise the first listed compatible model is selected.
- `NEXT_PUBLIC_ENGINE_URL` — HTTPS engine origin, needed to update a scenario's live map after extraction.

Microphone access requires HTTPS or localhost. Browser AudioWorklet support and speaker output are required for Live. The fallback `/call` supports typed input when browser speech APIs are absent.

## Headset test checklist

- [ ] Open `/call/live?debug=1`, start a call, speak in English, and confirm both sides of the transcript and the needs card update.
- [ ] Speak over an audio reply; playback should stop immediately and the assistant should respond to the interruption.
- [ ] Repeat in Spanish and confirm the response stays in Spanish.
- [ ] Stay silent; the assistant should not invent a resident statement or populate needs.
- [ ] Keep a session open for five minutes, then speak and confirm audio and transcription still work.
- [ ] End, restart, and confirm a fresh token and WebSocket reconnect. Force a connection failure and confirm the browser speech/text fallback appears with a clear message.
- [ ] With a real scenario and household query string, confirm the engine accepts the needs POST and the live map updates.

## Known limits

- No live key is available in this checkout, so token issuance, headset audio, and a real Gemini WebSocket have **not** been verified here. Vidhaan will run these checks with credentials on his machine.
- Sessions expire after ten minutes; reconnect starts a new call and does not preserve model audio context. A five-minute session should work without renewal.
- The browser does not authenticate the visitor before requesting a token; the endpoint applies a small per-IP rate limit. A production deployment should add user authentication if it is opened beyond the hackathon demo.
- Input transcription messages can arrive out of order. The UI collects final fragments through the model's turn-complete signal; network delays can move a late fragment into the next turn.

API references: [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [raw WebSocket protocol](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket), [Live API audio and VAD](https://ai.google.dev/gemini-api/docs/live-api/capabilities).
