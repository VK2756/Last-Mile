# Human setup (assumes you know nothing). Full step-by-step is in the manager chat; this is the reference copy.

People: **Vidhaan** = Lane A (Claude Code), **Shrish** = Lane B (Claude Code), **Anant** = Lane C (Codex).
Everyone does Steps 1-4 on their own laptop. Vidhaan (repo owner, GitHub `VK2756`) does Step 0 first.

## 0. Vidhaan: GitHub repo, once
- Repo: https://github.com/VK2756/Last-Mile. Settings, Collaborators, Add people: Shrish's and Anant's GitHub usernames (they accept by email).
- Labels, once (after the repo has the pack):
  ```
  gh label create integration-bug --color D93F0B; gh label create contract-change --color 5319E7; gh label create blocked --color B60205
  for l in a b c; do gh label create lane:$l --color 0E8A16; done
  ```

## 1. Install the tools (each person)
1. Git: macOS `xcode-select --install` (or `brew install git`). Windows: install Git for Windows (the Claude desktop Code tab needs it).
2. Node 22+: https://nodejs.org (LTS). Check: `node -v`.
3. pnpm: `corepack enable && corepack prepare pnpm@9.15.0 --activate`. Check: `pnpm -v`.
4. GitHub CLI: macOS `brew install gh`; Windows `winget install GitHub.cli`. Then log in: `gh auth login` (choose GitHub.com, HTTPS, "Login with a web browser"), then `gh auth setup-git`. This is what lets the agent push and open PRs.
5. Tell git who you are: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.

## 2. Clone the repo (each person), then check it
```
cd ~/Projects            # or any folder you like
git clone https://github.com/VK2756/Last-Mile.git
cd Last-Mile
pnpm install && pnpm verify      # must end with: verify passed
```
(Vidhaan already has the folder if the manager chat pushed it for you: just `git pull`.)

## 3. Claude Code in the Claude desktop app (Vidhaan and Shrish)
1. Open the Claude desktop app, sign in with a paid plan, click the **Code** tab.
2. Under the prompt box choose **Local**, then the project-folder control, **Select folder / Open folder**, and pick the `Last-Mile` folder.
3. Permission mode: choose **Auto accept edits** (it still asks before risky commands; the repo's `.claude/settings.json` pre-approves pnpm, git and gh). Do not use bypass-everything modes on a laptop that holds your logins.
4. Paste your kickoff prompt from `docs/KICKOFF_PROMPTS.md`, press Enter.
5. If the Code tab only offers "connect GitHub repo" and no folder picker, update the app; if it still does, tell the manager chat.

## 4. Codex in the ChatGPT desktop app (Anant)
1. Install or update the ChatGPT desktop app, sign in, switch to the **Codex** view.
2. Add a project and select the `Last-Mile` folder.
3. Network: Codex's default sandbox has network OFF, which breaks `git push`, `gh`, `pnpm install` and `curl`. Either approve the prompts when it asks to go outside the sandbox, or add this to `~/.codex/config.toml` and restart the app:
   ```
   [sandbox_workspace_write]
   network_access = true
   ```
4. Paste Anant's kickoff prompt from `docs/KICKOFF_PROMPTS.md`.

## 5. Accounts and who creates them
| Account | Person | Hand over (privately, NEVER in git) |
|---|---|---|
| Vercel (import the GitHub repo) | Shrish | Root Directory `web`; turn ON "Include source files outside of the Root Directory"; env var `NEXT_PUBLIC_ENGINE_URL` (the `https://` engine URL, set after the engine is deployed) |
| Vultr (claim MLH credit) | Anant | Ubuntu 24.04 VM, 2 vCPU / 4 GB, US East; the VM IP |
| MongoDB Atlas (free M0) | Anant | `MONGODB_URI`; Network Access: allow 0.0.0.0/0 for the weekend |
| Tiger Data / Tiger Cloud (free) | Anant | `TIGER_DATABASE_URL` |
| Google AI Studio | Anant | `GEMINI_API_KEY` |
| GoDaddy Registry `.tech` via tech.study | Anant | domain; `@`/`www` to Vercel, `api` A-record to the Vultr IP |
| Devpost | everyone | one project, all teammates added |
Secrets go in: Vercel env vars (web), `engine/.env` on the Vultr box and your own laptop, `web/.env.local` locally. Names are in `.env.example`. The agents can't read `.env*` files.

## 6. Manager chat
Every 60-90 minutes paste me `docs/status/lane-a.md`, `lane-b.md`, `lane-c.md`, plus any red CI output or open `integration-bug` issues. Optional: `pnpm watch` in a spare terminal alerts you when main goes red.

## 7. Ground rules
Never merge with red CI. Never commit `.env*`. Don't edit a lane you don't own: tell that lane's agent. Rehearse the full demo once at M3 and once after the freeze.
