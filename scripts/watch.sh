#!/usr/bin/env bash
# Leave running in a spare terminal pane. Verifies every new commit on origin/main in an isolated worktree
# and shouts (macOS notification + terminal bell) when main breaks.
set -uo pipefail
cd "$(dirname "$0")/.."
WT=.verify-worktree
git fetch origin main --quiet
[ -d "$WT" ] || git worktree add --detach "$WT" origin/main >/dev/null
LAST=""
while true; do
  git fetch origin main --quiet
  SHA=$(git rev-parse origin/main)
  if [ "$SHA" != "$LAST" ]; then
    echo "[$(date +%T)] new main: ${SHA:0:7} — verifying…"
    ( cd "$WT" && git checkout --detach "$SHA" --quiet && pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1; bash scripts/verify.sh ) > /tmp/lastmile-watch.log 2>&1
    if [ $? -eq 0 ]; then echo "[$(date +%T)] ✅ ${SHA:0:7} green"; else
      echo -e "\a[$(date +%T)] ❌ ${SHA:0:7} BROKE MAIN — see /tmp/lastmile-watch.log"; tail -n 25 /tmp/lastmile-watch.log
      command -v osascript >/dev/null && osascript -e 'display notification "main is red" with title "Last Mile"'
    fi
    LAST="$SHA"
  fi
  sleep 45
done
