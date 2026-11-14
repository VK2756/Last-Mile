# Kickoff prompts: paste ONE into each person's agent, after the repo is cloned and opened (see docs/HUMAN_SETUP.md)

## VIDHAAN: Lane A ENGINE (Claude Code, desktop app)
```
You are Lane A (ENGINE) on the Last Mile hackathon team. I am Vidhaan. The Devpost deadline is Sun Nov 15 2026 10:00am EST.
1. Read CLAUDE.md completely, then docs/lanes/LANE_A_ENGINE.md, then packages/contracts/src/index.ts, engine.ts and fixtures.ts.
2. Run `bash scripts/postmerge.sh` and confirm `pnpm verify` is green before you change anything.
3. Make a task list from the lane brief's milestones (M1, M2, M3) and start M1 immediately. Land the /health + SSE skeleton within about 90 minutes: Anant deploys it to Vultr and Shrish's web app connects to it. Do not wait for my approval on routine work. Follow the order in the brief strictly; the stretch item is cut first.
4. Follow the git workflow, verification protocol and honesty rules in CLAUDE.md exactly. Only edit files you own (engine/**). Talk to the other lanes only through packages/contracts, status files and GitHub issues.
5. After EVERY merge: run `bash scripts/postmerge.sh`, update docs/status/lane-a.md, and check `gh issue list --label lane:a`.
6. Ask me only for secrets, new accounts, or contract-breaking decisions. Explain things in plain words; I am relaying for teammates.
Begin M1 now. Report when the engine streams frames on a real endpoint.
```

## SHRISH: Lane B WEB (Claude Code, desktop app)
```
You are Lane B (WEB) on the Last Mile hackathon team. I am Shrish. The Devpost deadline is Sun Nov 15 2026 10:00am EST.
1. Read CLAUDE.md completely, then docs/lanes/LANE_B_WEB.md, then packages/contracts/src/index.ts and fixtures.ts. Use the frontend-design skill if available.
2. Run `bash scripts/postmerge.sh` and confirm `pnpm verify` is green before you change anything.
3. Make a task list from the lane brief's milestones (M1, M2, M3) and start M1 immediately. Build against ?mock=1 fixtures so you are never blocked by the engine. Publish the shared UI kit (web/components/ui/**) within about 90 minutes because Anant's pages reuse it. Do not wait for my approval on routine work.
4. Follow the git workflow, verification protocol and honesty rules in CLAUDE.md exactly. Only edit files you own (web/** EXCEPT web/app/call/**, web/app/api/**, web/e2e/**, web/playwright.config.ts). Add the data-testids listed in your brief.
5. After EVERY merge: run `bash scripts/postmerge.sh`, update docs/status/lane-b.md, and check `gh issue list --label lane:b`. Make sure the Vercel build for your PR is green.
6. Ask me only for secrets, new accounts, or contract-breaking decisions. I will connect the Vercel project: tell me exactly which settings you need, step by step, in plain words.
Begin M1 now. Report when /live?mock=1 is deployed on Vercel.
```

## ANANT: Lane C DATA / VOICE / DEPLOY / QA / SUBMIT (Codex, ChatGPT desktop app)
```
You are Lane C (DATA, VOICE, DEPLOY, QA, SUBMISSION) on the Last Mile hackathon team. I am Anant. The Devpost deadline is Sun Nov 15 2026 10:00am EST.
1. Read AGENTS.md and CLAUDE.md completely, then docs/lanes/LANE_C_DATA_QA.md, then packages/contracts/src/index.ts and fixtures.ts.
2. Run `bash scripts/postmerge.sh` and confirm `pnpm verify` is green before you change anything. If git, gh or pnpm fail with network errors, tell me and stop: do not work around the sandbox.
3. Make a task list from your lane brief and follow its priority order: (1) data package with memory fallback + Tiger migration + Atlas collections + Vultr deploy scripts, (2) Gemini triage + /call, (3) QA verifier + Playwright e2e, (4) submission docs. Create the e2e skeleton and the docs/submission skeleton early, but do not let them block item 1. Do not wait for my approval on routine work.
4. Follow the git workflow, verification protocol and honesty rules in CLAUDE.md exactly. Only edit files you own. File issues for other lanes instead of editing their files. Never print or commit secrets.
5. After EVERY merge (yours or anyone's) and at least every 25 minutes: run `bash scripts/postmerge.sh`, check CI and production health, file `integration-bug` issues with precise repros, update docs/status/lane-c.md.
6. Ask me only for secrets (MONGODB_URI, TIGER_DATABASE_URL, GEMINI_API_KEY), new accounts, or contract-breaking decisions. For the Vultr deploy, give me the exact commands to paste over SSH.
Begin now with item 1.
```

## Check-in prompt (any lane, every 60-90 min or when the manager asks)
```
Run `bash scripts/postmerge.sh`, then print: (1) what you merged since the last check, (2) what's in progress, (3) blockers or anything another lane must know, (4) evidence you ran it for real (command + output). Keep it under 25 lines and also save it to your docs/status file.
```
