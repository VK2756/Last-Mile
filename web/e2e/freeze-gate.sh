#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../.."

node_cmd=node
command -v "$node_cmd" >/dev/null 2>&1 || node_cmd=node.exe
gh_cmd=gh
command -v "$gh_cmd" >/dev/null 2>&1 || gh_cmd=gh.exe

"$node_cmd" web/e2e/audit.mjs
audit_status=$?

if command -v "$gh_cmd" >/dev/null 2>&1; then
  ci_json="$("$gh_cmd" run list --branch main --limit 1 --json status,conclusion,headSha 2>/dev/null)"
  if [[ "$ci_json" == *'"status":"completed"'* && "$ci_json" == *'"conclusion":"success"'* ]]; then
    echo 'PASS main CI green'
  else
    echo 'FAIL main CI green (missing, pending, or failed)'
    audit_status=1
  fi
else
  echo 'FAIL main CI green (gh unavailable)'
  audit_status=1
fi

if [[ -n "${API_URL:-}" ]] && curl --fail --silent --show-error --max-time 10 "${API_URL%/}/health" >/dev/null 2>&1; then
  echo 'PASS engine /health'
else
  echo 'FAIL engine /health (set API_URL to the public HTTPS engine origin)'
  audit_status=1
fi

exit "$audit_status"
