# Devpost prize checklist

Deadline: **Sun 15 Nov 2026, 10:00am EST.** Submit a complete draft by 8:00am; edit after, never start late.

## Opt-ins on the Devpost form

Tick exactly these. Tick a sponsor prize only if its evidence row in [`SPONSORS.md`](SPONSORS.md) is filled.

- [ ] **Grand Prize** (automatic for all submissions; confirm it is selected)
- [ ] **`[HACKUMASS] Best Software Hack`**: the ONE and only `[HACKUMASS]` tag we choose
- [ ] **MLH: Best Use of Gemini API** (evidence: Gemini transcript)
- [ ] **MLH: Best Use of MongoDB Atlas** (evidence: Atlas counts + `$geoNear` output)
- [ ] **MLH: Best Use of Tiger Data** (evidence: hypertable counts, continuous aggregate, compression)
- [ ] **MLH: Best Use of Vultr** (evidence: public `/health`)
- [ ] **MLH: Best Domain Name from GoDaddy Registry** (evidence: site live on the domain)
- [ ] **DEV Writing Challenge** (evidence: published DEV post URL in the submission)

**Do NOT select:** any second `[HACKUMASS]` tag; SpaceXSI (needs Cursor + Grok Bot, not used).

## Form fields

- [ ] Title: Last Mile · Tagline from [`DEVPOST.md`](DEVPOST.md)
- [ ] Story sections pasted from `DEVPOST.md` (Inspiration ... What's next) with numbers from [`NUMBERS.md`](NUMBERS.md)
- [ ] "Built with" tags: copy the list under "Built with" in `DEVPOST.md`
- [ ] Try-it link: production `/` and `/live` (not localhost); `?mock=1` mentioned as offline fallback
- [ ] GitHub repo link (public before submitting)
- [ ] Video link (YouTube/Vimeo, under the length limit, public or unlisted), see [`VIDEO.md`](VIDEO.md)
- [ ] Gallery: hero screenshot, `/live` split screen, `/results` with CIs, `/call`, `architecture.svg` (exported to PNG)
- [ ] All team members added to the Devpost project

## Honesty gate (all must be true)

- [ ] Every page with results shows the SIMULATION badge; the pitch and video say "simulation" out loud
- [ ] Every outcome number matches `NUMBERS.md` (refreshed from the deployed engine on submission day):
      `node docs/submission/tools/check-numbers.mjs` passes
- [ ] The headline is the range (about 4 to 29 points) with the neighbour-ride caveat, never 45% to 74% on its own
- [ ] Every link filled: `node docs/submission/tools/fill-links.mjs --check` passes
- [ ] Each prize paragraph in `DEVPOST.md` says "pending live run" until its evidence exists; no opt-in without evidence
- [ ] Every real-world fact appears in `SOURCES.md` with a working URL
- [ ] Voice agent copy never promises rescue; 911 line visible on `/call`
- [ ] No `STUB:` markers on main; `pnpm verify` green; CI green
