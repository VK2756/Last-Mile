# Lane C status — 2026-11-14

## Merged

- #110 fixed Windows line endings with `.gitattributes`; issue #4 closed. A fresh Windows clone with `core.autocrlf=true` kept all three shell scripts LF, and `bash -n` and `bash scripts/postmerge.sh` ran there.
- #113 added `pnpm deploy:engine` to match the Vultr systemd start command and documented it in the runbook; issue #7 closed. A local `/health` request returned HTTP 200.
- #117 added dispatches per minute to `/api/risk-series` from Tiger dispatch events, with tests. The dashboard already reads `dispatches`; issue #79 closed.
- #131 added Gemini Live `/call/live`, constrained ephemeral token minting, direct browser audio and transcript, triage extraction, fallback, mock WebSocket tests, and `docs/VOICE.md`. The no-key route returned 503 and the browser fallback test passed.
- #136 added the nonfatal neighbour-ride caveat warning to the audit and marked stale Monte Carlo evidence as superseded; issue #129 closed. Lane E resolved its submission warning in #135.
- #138 added `evidence --dry-run`; it reports only missing `MONGODB_URI` and `TIGER_DATABASE_URL` names and makes no connections or file writes. Four missing/present combinations passed with test-only variables.

- Phone demo: `@lastmile/phone` with Twilio outbound allowlist, one active call, 3/hour/number, signed stream token, 5-minute cap, Gemini Live audio bridge, triage/engine update, optional Atlas transcript; Vercel route and `/call/live` form, Mac Funnel scripts, and `docs/PHONE.md`. Ten no-key tests and local `/health` passed.

## Verification and remaining work

- All six PRs passed their required checks before squash merge. The fresh clone passed `pnpm verify` on the latest Lane C code; main CI passed after #138. `node web/e2e/audit.mjs` passes all five source checks with no warnings on current main.
- The freeze gate passes source audit and main CI. Its health item needs a reachable engine origin. Windows `curl.exe` received HTTP 200 from the local engine, but this checkout's `bash` is WSL and cannot reach that Windows loopback server. Public production `/health` is pending the Vultr address.
- Required `bash scripts/postmerge.sh` was run after each Lane C merge. In the original `C:\HackUmass` checkout, Next prerender fails on a React `useRef` null/path-casing issue; the clean `C:\LastMileLFCheck` clone passes the same full verification. See prior issue #21.
- Real Atlas, Tiger, Gemini key, headset, phone dial, Mac Funnel, and production deployment checks remain for Vidhaan/Anant. No secrets were read or printed. The local engine used the memory sink. `docs/VOICE.md` has the headset checklist and `docs/RUNBOOK_VULTR.md` has SSH commands.
