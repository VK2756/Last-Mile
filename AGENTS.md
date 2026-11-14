# Agent instructions (Codex and other agents)

All rules live in **CLAUDE.md**. Read it completely now and follow it exactly: lanes, directory ownership, contract rule,
git workflow, the verification protocol (`bash scripts/postmerge.sh` after every merge), status files and honesty rules.
Then read your lane brief in `docs/lanes/`. If CLAUDE.md and this file ever disagree, CLAUDE.md wins.

## Codex notes
- You are Lane C (DATA / VOICE / DEPLOY / QA / SUBMIT; Anant) unless your prompt says otherwise. Your lane brief: `docs/lanes/LANE_C_DATA_QA.md`.
- There are 4 lanes (A sim+server, B web, C data/voice/deploy/QA, D routing/dispatch/Monte Carlo); the table in CLAUDE.md is authoritative.
- If git/gh/pnpm fail with network errors, tell the human to enable network access for your sandbox (see `docs/HUMAN_SETUP.md` section 2). Do not work around it.
