#!/usr/bin/env bash
# Run after EVERY merge to main (yours or anyone's), and at the start of every work session.
set -uo pipefail
cd "$(dirname "$0")/.."
git fetch origin main --quiet
CUR=$(git rev-parse --abbrev-ref HEAD)
if [ "$CUR" = "main" ]; then git pull --ff-only origin main; else echo "On branch $CUR. Rebase when ready: git rebase origin/main"; fi
pnpm install --frozen-lockfile || pnpm install
if bash scripts/verify.sh; then echo "✅ main verified locally"; else
  echo "❌ VERIFY FAILED on current tree. Open an issue:  gh issue create --label integration-bug --title '...' --body '...'"; exit 1; fi
echo "-- latest CI on main --"; gh run list --branch main --limit 3 2>/dev/null || echo "(gh not available)"
echo "-- open integration bugs --"; gh issue list --label integration-bug --state open 2>/dev/null || true
