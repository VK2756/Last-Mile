#!/usr/bin/env bash
# Runs the Last Mile engine on this Mac: keeps the Mac awake, restarts the engine if it crashes, prints /health every 60 s.
# Usage: bash scripts/mac-host.sh      (stop with Ctrl+C)
set -u
cd "$(dirname "$0")/.."
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# optional env files (never printed)
for f in .env engine/.env; do [ -f "$f" ] && { set -a; . "./$f"; set +a; }; done

export NODE_ENV=production PORT=8080
export ENGINE_CORS_ORIGIN="${ENGINE_CORS_ORIGIN:-https://last-mile-iamvk.vercel.app,https://last-mile-seven.vercel.app,http://localhost:3000}"
if [ -n "${MONGODB_URI:-}" ] && [ -n "${TIGER_DATABASE_URL:-}" ]; then export DATA_SINK=real; else export DATA_SINK=memory; fi
echo "[mac-host] DATA_SINK=$DATA_SINK PORT=$PORT CORS=$ENGINE_CORS_ORIGIN"

caffeinate -dimsu -w $$ &   # no sleep while this script runs

ENGINE_PID=""
cleanup() { [ -n "$ENGINE_PID" ] && kill "$ENGINE_PID" 2>/dev/null; kill $(jobs -p) 2>/dev/null; exit 0; }
trap cleanup INT TERM

( while true; do sleep 60; echo "[mac-host] $(date '+%H:%M:%S') health: $(curl -s -m 5 http://127.0.0.1:8080/health || echo UNREACHABLE)"; done ) &

while true; do
  echo "[mac-host] $(date '+%H:%M:%S') starting engine"
  pnpm --filter @lastmile/engine start &
  ENGINE_PID=$!
  wait "$ENGINE_PID"
  echo "[mac-host] $(date '+%H:%M:%S') engine exited (code $?); restarting in 3 s"
  sleep 3
done
