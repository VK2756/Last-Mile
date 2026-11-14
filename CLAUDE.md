# Last Mile: read this fully before doing anything

**One-liner:** Live evacuation dispatch for people who can't drive out of a wildfire or flood. A simulator predicts every household's time-to-impact, a dispatch engine matches each at-risk household to the nearest capable helper and re-plans routes as the fire moves, and a Gemini voice agent phones households to learn their needs. We prove it with a counterfactual: the same fire run under "alerts only" vs "Last Mile", over hundreds of seeded runs with confidence intervals.

**Event:** HackUMass XIV. **Devpost deadline: Sun 15 Nov 2026, 10:00am EST. No exceptions; feature freeze is earlier (see docs/SCHEDULE.md).**
**Judging:** Innovation, Functionality, Practicality, Presentation. Judges are CS teaching faculty with a public-interest data-science focus. Demo reliability beats feature count.
**Prize targets:** Grand Prize, `[HACKUMASS] Best Software Hack`, MLH Gemini, MongoDB Atlas, MLH Tiger Data, MLH Vultr, GoDaddy Registry domain, DEV Writing Challenge. (SpaceXSI needs Cursor + Grok Bot; we are not targeting it.)

## Architecture
```
 Browser (Vercel, Next.js)  <--SSE/HTTPS-->  Engine (Vultr VM, Node/TS, Caddy TLS)
   /live split-screen map                      fire sim + routing + dispatch + Monte Carlo
   /results Monte Carlo                           |               |
   /call Gemini voice call                        v               v
   web/app/api/triage --> Gemini         MongoDB Atlas      Tiger Data (Timescale)
                                         households/helpers  risk_samples, dispatch_events,
                                         $geoNear matching   continuous aggregates
```
Everything is TypeScript, pnpm workspaces. Shared types live in `packages/contracts` (zod). **Nothing talks across lanes except through contracts.**

## Lanes and directory ownership (you may only edit your own lane's files)
| Lane | Name | Person / Agent | Owns |
|---|---|---|---|
| **A** | SIM + SERVER | Vidhaan, Claude Code | `engine/src/server*`, `engine/src/sim/**`, `engine/src/world/population*`, `engine/src/policy/**` |
| **B** | WEB | Shrish, Claude Code | `web/**` EXCEPT Lane C's paths below (so `/`, `/live`, `/results`, `web/components/ui/**`, `web/lib/**`) |
| **C** | DATA / VOICE / DEPLOY / QA / SUBMIT | Anant, Codex | `packages/data/**`, `packages/ai/**`, `web/app/call/**`, `web/app/api/**`, `web/e2e/**`, `web/playwright.config.ts`, `deploy/vultr/**`, `docs/submission/**` |
| **D** | ROUTING / DISPATCH / MONTE CARLO | Rishabh, Claude Code | `engine/src/routing/**`, `engine/src/dispatch/**`, `engine/src/world/town*`, `engine/src/montecarlo/**`, `engine/scripts/**`, `engine/data/**` |
| Shared | Manager (the humans + the manager chat) | | `packages/contracts/**`, `CLAUDE.md`, `AGENTS.md`, `scripts/**`, `.github/**`, `docs/*.md`, `docs/lanes/**` |

Lanes A and D share the `engine/` package but edit only their own directories; they meet only through `packages/contracts/src/engine.ts` (FireModel, Router, Dispatcher, WorldSnapshot, HeadlessRunner). Branch prefix = your lane letter (`a/…`, `b/…`, `c/…`, `d/…`). Labels: `lane:a`, `lane:b`, `lane:c`, `lane:d`. Your lane brief: `docs/lanes/LANE_A_ENGINE.md` (Lane D uses it too: items 5, 6, 11, 13), `LANE_B_WEB.md` or `LANE_C_DATA_QA.md`. Read it right after this file. Status file: `docs/status/lane-<letter>.md`.

## STUB rule
Some files start as stubs so lanes can build in parallel. Every stub is marked with a `STUB:` comment. The owner replaces it with the real thing. Lane C greps for `STUB:` before the freeze and **main must contain zero STUB markers at freeze**.

## Dependencies and the lockfile (the #1 source of merge pain)
Heavy deps are pre-declared in each package. If you need another: `pnpm add <pkg> --filter <package>`, then commit `package.json` + `pnpm-lock.yaml` in a small dedicated PR titled `deps: ...` and merge it immediately. On a lockfile conflict: `git checkout origin/main -- pnpm-lock.yaml && pnpm install` and commit the result. Never hand-edit the lockfile.

## Contract rule
- Never change `packages/contracts` casually. Additive changes (new optional field, new enum value at the end) are allowed via a PR titled `contract: ...` with label `contract-change`; announce it in your status file; the other lanes must `scripts/postmerge.sh` right away.
- Breaking changes need the manager's OK (the human will relay). If blocked on a contract question, build against the fixtures in `packages/contracts/src/fixtures.ts` and keep going.

## Git workflow (trunk-based, small and fast)
1. `git checkout main && git pull --ff-only` then branch: `a/<topic>`, `b/<topic>`, `c/<topic>` or `d/<topic>` (prefix = your lane letter).
2. Commit small and often. Open a PR early: `gh pr create --fill`. Keep PRs under about 300 lines when possible.
3. **Before merging: `pnpm verify` must pass locally AND CI must be green** (`gh pr checks --watch`).
4. Merge yourself: `gh pr merge --squash --delete-branch`. Do not wait for review; the verification protocol is the review.
5. Never force-push `main`. Never commit secrets. Never edit another lane's files (open an issue instead, see below).

## Verification protocol (every agent runs this; it is how we avoid a broken demo)
**After EVERY merge to main (yours or anyone else's) and at the start of every work session:**
```
bash scripts/postmerge.sh
```
It pulls main, installs, runs `pnpm verify` (typecheck, lint, test, build), shows the last CI runs and open `integration-bug` issues.
- If main is red and **your** change likely caused it: fix forward within 15 minutes or `git revert` your merge commit and push. Main must never stay red.
- If it's **another lane's** breakage: do NOT edit their files. Open an issue with a minimal repro:
  `gh issue create --label integration-bug --label lane:<their-letter> --title "<what broke>" --body "<repro + error>"`
- Every 20-30 minutes, or whenever you finish a task, run `gh issue list --label "lane:<yours>" --state open` and fix what's assigned to you first.
- Humans keep `pnpm watch` running in a spare pane; it verifies every new commit on `origin/main` in an isolated worktree and alerts if main goes red.
- Before you call anything "done": run it for real (start the server / open the page / hit the endpoint), not just the tests. Paste the evidence (command + output) in your status file.

## Status files (how the manager sees progress)
Update `docs/status/lane-<x>.md` (your own file only) every time you merge: what's done, what's next, blockers, anything other lanes must know. Keep it under 30 lines. The human pastes these to the manager chat.

## Honesty rules (we will be judged on credibility)
- Everything involving residents, helpers and fires is a **simulation with synthetic people**. The UI shows a persistent "SIMULATION" badge and the assumptions list. The pitch says "simulation" out loud.
- Outcome numbers come only from the Monte Carlo evaluator. Never hard-code or "tune for demo" the headline numbers. If Last Mile does not beat the baseline, we say so and show the assumptions that drive it.
- The voice agent never promises rescue and always says: if you are in immediate danger, call 911.
- Real-world facts used in the pitch must come from `docs/submission/SOURCES.md`.

## Engineering standards
TypeScript strict, no `any` without a comment. Deterministic by seed (the engine must be reproducible: same seed gives same result). Fail loudly in dev, degrade gracefully in demo (e.g. no `GEMINI_API_KEY` leads to the deterministic fallback parser, not a crash). No secrets in git; env var names live in `.env.example`.

## When to ask the human vs. just do it
Just do routine work. Ask the human ONLY for: secrets/API keys, paid or new accounts, contract-breaking decisions, scope cuts that change the demo.

## Definition of done (for the whole project)
1. `https://<domain>/live` shows the split-screen simulation, driven by the real engine on Vultr, with no console errors.
2. `/results` shows the Monte Carlo comparison with CIs.
3. `/call` completes a Gemini voice triage that updates the live map.
4. Atlas and Tiger Data are demonstrably used (collections/hypertables populated by real runs).
5. Devpost submitted with video, DEV post published, all sponsor prizes opted in.
