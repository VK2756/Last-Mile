# Lane C status

Branch: `c/data-foundation`. Baseline `pnpm verify` passed on 2026-11-14. `scripts/postmerge.sh` has CRLF line endings in this Windows checkout, so direct Bash invocation fails; shared-file fix needed.

## Task list
- [x] Data sink: memory fallback, buffered Atlas/Tiger writes, query helpers, tests (local tests pass)
- [x] Tiger migration and Atlas seed code (live credentials pending)
- [x] Vultr setup/deploy/Caddy scripts and exact SSH commands (live VM pending)
- [ ] Gemini triage, API route, `/call`
- [ ] Playwright e2e and integration QA
- [ ] Submission package and sponsor evidence

Next: merge data/deploy PR, then Gemini triage. Blockers: no database credentials, domain, or Vultr host yet. Main CI green. No production hostname yet. Shared script CRLF issue: #4.
