#!/usr/bin/env bash
# The single gate. Run before every PR and after every merge. Exit non-zero = do NOT merge.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== typecheck =="; pnpm -r --if-present run typecheck
echo "== lint ==";      pnpm -r --if-present run lint
echo "== test ==";      pnpm -r --if-present run test
echo "== build ==";     pnpm -r --if-present run build
echo "✅ verify passed"
