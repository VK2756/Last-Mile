#!/usr/bin/env node
// Refresh the real Monte Carlo numbers used in the submission (Lane E). Never edit numbers by hand.
//
//   node docs/submission/tools/numbers.mjs                     # run Rishabh's CLI locally (engine/scripts/montecarlo-cli.ts)
//   ENGINE_URL=https://api.example node docs/submission/tools/numbers.mjs   # same configs via the deployed engine (POST /montecarlo)
//   node docs/submission/tools/numbers.mjs --from docs/submission/sensitivity   # reuse saved JSON, just regenerate NUMBERS.md
//   add --fill   to replace [PLACEHOLDER] tokens in DEVPOST.md, DEV_POST.md, VIDEO.md, PITCH_QA.md, ../DEMO_SCRIPT.md
//   add --check  to fail if any of those docs quotes a headline value that no longer matches
//
// Writes docs/submission/sensitivity/<name>.json and docs/submission/NUMBERS.md.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SUB = path.resolve(here, '..');
const ROOT = path.resolve(SUB, '..', '..');
const OUT = path.join(SUB, 'sensitivity');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

/** Configs: name -> CLI flags (and the equivalent POST body overrides). Preset base = engine PRESET_BASE. */
const CONFIGS = [
  { name: 'preset', label: 'Headline preset (20 mph wind, 24 helpers)', cli: [], body: {} },
  { name: 'fresh_seeds', label: 'Preset, fresh seeds 1001–1200', cli: ['--seed-start', '1001'], body: { seedStart: 1001 } },
  { name: 'fast_fire', label: 'Faster fire (35 mph wind toward 45°)', cli: ['--wind-mph', '35', '--wind-dir', '45'], body: { wind: { speedMph: 35, dirDeg: 45 } } },
  { name: 'few_helpers', label: '6 helpers instead of 24', cli: ['--helpers', '6'], body: { helperCount: 6 } },
  { name: 'fast_fire_few_helpers', label: '35 mph wind and 6 helpers', cli: ['--wind-mph', '35', '--wind-dir', '45', '--helpers', '6'], body: { wind: { speedMph: 35, dirDeg: 45 }, helperCount: 6 } },
  { name: 'zero_helpers', label: 'Sanity: 0 helpers (50 seeds)', cli: ['--helpers', '0', '--runs', '50'], body: { helperCount: 0, runs: 50 } },
];

async function viaEngine(url, c, preset) {
  const runs = c.body.runs ?? 200;
  const start = c.body.seedStart ?? 1;
  const seeds = Array.from({ length: runs }, (_, i) => start + i);
  const { seedStart: _s, runs: _r, ...over } = c.body;
  const base = { ...preset.base, ...over, wind: { ...preset.base.wind, ...(over.wind ?? {}) } };
  const t0 = Date.now();
  const res = await fetch(`${url}/montecarlo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base, seeds }) });
  if (!res.ok) throw new Error(`${c.name}: POST /montecarlo -> HTTP ${res.status} ${await res.text()}`);
  return { seconds: (Date.now() - t0) / 1000, seeds: [seeds[0], seeds.at(-1)], source: url, ...(await res.json()) };
}

function viaCli(c) {
  const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/montecarlo-cli.ts', '--json', ...c.cli], { cwd: path.join(ROOT, 'engine'), encoding: 'utf8', maxBuffer: 1 << 26 });
  return { ...JSON.parse(out), source: 'engine/scripts/montecarlo-cli.ts' };
}

const commit = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();

async function collect() {
  const from = opt('--from');
  if (from) return Object.fromEntries(CONFIGS.map((c) => [c.name, JSON.parse(readFileSync(path.join(ROOT, from, `${c.name}.json`), 'utf8'))]));
  mkdirSync(OUT, { recursive: true });
  const url = (process.env.ENGINE_URL ?? '').replace(/\/+$/, '');
  const preset = url ? await (await fetch(`${url}/montecarlo/preset`)).json() : null;
  const results = {};
  for (const c of CONFIGS) {
    process.stderr.write(`running ${c.name}...\n`);
    const r = url ? await viaEngine(url, c, preset) : viaCli(c);
    r.commit = commit;
    r.generatedAt = new Date().toISOString();
    writeFileSync(path.join(OUT, `${c.name}.json`), JSON.stringify(r, null, 2) + '\n');
    results[c.name] = r;
  }
  return results;
}

const p1 = (x) => `${(x * 100).toFixed(1)}%`;
const pts = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)} pts`;
const ci = (c) => `[${(c[0] * 100).toFixed(1)}, ${(c[1] * 100).toFixed(1)}]`;

function values(r) {
  const P = r.preset;
  return {
    RUNS: String(P.runs),
    BASE_VUL: p1(P.results.alerts_only.vulnerableEvacuatedRate.mean),
    LM_VUL: p1(P.results.last_mile.vulnerableEvacuatedRate.mean),
    BASE_ALL: p1(P.results.alerts_only.evacuatedRate.mean),
    LM_ALL: p1(P.results.last_mile.evacuatedRate.mean),
    LIFT: pts(P.vulnerableLift.mean),
    LIFT_CI: ci(P.vulnerableLift.ci95),
    FRESH_LIFT: `${pts(r.fresh_seeds.vulnerableLift.mean)} ${ci(r.fresh_seeds.vulnerableLift.ci95)}`,
    LIFT_FAST: `${pts(r.fast_fire.vulnerableLift.mean)} ${ci(r.fast_fire.vulnerableLift.ci95)}`,
    LIFT_6: `${pts(r.few_helpers.vulnerableLift.mean)} ${ci(r.few_helpers.vulnerableLift.ci95)}`,
    HARSH_LIFT: `${pts(r.fast_fire_few_helpers.vulnerableLift.mean)} ${ci(r.fast_fire_few_helpers.vulnerableLift.ci95)}`,
    ZERO_LIFT: pts(r.zero_helpers.vulnerableLift.mean),
  };
}

function numbersMd(r, v, b) {
  const src = r.preset.source ?? 'engine';
  const rows = CONFIGS.map((c) => {
    const x = r[c.name];
    return `| ${c.label} | ${x.seeds?.[0] ?? 1}–${x.seeds?.[1] ?? x.runs} | ${ci2(x.results.alerts_only.vulnerableEvacuatedRate)} | ${ci2(x.results.last_mile.vulnerableEvacuatedRate)} | ${pts(x.vulnerableLift.mean)} ${ci(x.vulnerableLift.ci95)} | ${p1(x.results.alerts_only.evacuatedRate.mean)} → ${p1(x.results.last_mile.evacuatedRate.mean)} | ${x.results.alerts_only.trappedMean.toFixed(1)} → ${x.results.last_mile.trappedMean.toFixed(1)} |`;
  });
  const keys = Object.entries(v).map(([k, val]) => `| \`[${k}]\` | ${val} |`);
  return `# Numbers used in the submission

**Simulation with synthetic people.** Every number here comes from the real Monte Carlo evaluator (Lane D,
\`engine/src/montecarlo\`) running the real engine headless on real Amherst, MA roads, with paired seeds. Nothing is typed
by hand: this file is generated by \`docs/submission/tools/numbers.mjs\`. Raw outputs: \`docs/submission/sensitivity/*.json\`.

- Generated: ${r.preset.generatedAt ?? 'see JSON'} · main @ \`${r.preset.commit ?? commit}\` · source: ${src}
- Intervals: percentile bootstrap 95% CI over runs (2,000 resamples). Lift = paired difference (Last Mile − alerts only) in the
  vulnerable evacuated rate. "Vulnerable" = no vehicle, or wheelchair, oxygen, dementia, medical device or vision impaired.
- Rates count only households the fire reaches within 2 hours. "Trapped" is a simulation outcome, not a casualty estimate.

## Refresh (one command)

\`\`\`bash
# from the repo root, against the deployed engine (preferred on submission day):
ENGINE_URL=[API_URL] node docs/submission/tools/numbers.mjs
# or locally with Rishabh's CLI (no server needed, ~1-2 min on a laptop):
node docs/submission/tools/numbers.mjs
# then confirm every doc quotes the new values:
node docs/submission/tools/numbers.mjs --from docs/submission/sensitivity --check
\`\`\`

Single headline run by hand: \`curl -s [API_URL]/montecarlo/preset | jq '.vulnerableLift'\` or
\`cd engine && pnpm exec tsx scripts/montecarlo-cli.ts\`.

## Headline (preset, ${v.RUNS} paired seeds)

| | alerts only | Last Mile |
|---|---|---|
| vulnerable households evacuated | ${v.BASE_VUL} | ${v.LM_VUL} |
| all at-risk households evacuated | ${v.BASE_ALL} | ${v.LM_ALL} |
| **paired lift, vulnerable** | | **${v.LIFT} ${v.LIFT_CI}** |

**The headline depends on the baseline.** These ${v.RUNS} runs assume neighbours never give each other rides. Lane D's
baseline review ([\`BASELINE_REVIEW.md\`](BASELINE_REVIEW.md), ${b.CONFIGS} configs, 100 paired seeds each) turns the
baseline up:

| baseline (alerts only) | alerts only: vulnerable | Last Mile: vulnerable | lift |
|---|---|---|---|
${b.rows}

Last Mile wins in all ${b.CONFIGS} configs, but the honest headline is a range: **about ${v.LIFT_LOW} to ${v.LIFT_HIGH} points,
about ${v.LIFT_RIDES30_SHORT} if a third of neighbours with a car give rides.**

**Say it like this:** "In our simulation of Amherst's real roads, coordinated dispatch raised the share of vulnerable
households that got out before the fire by about ${v.LIFT_RANGE}, depending on how much informal help the town already has.
With no neighbour rides it goes from ${v.BASE_VUL} to ${v.LM_VUL} (${v.LIFT}, 95% CI ${v.LIFT_CI}, ${v.RUNS} paired runs); if a third of
neighbours with a car pick someone up, the gain is ${v.LIFT_RIDES30_SHORT} points; with neighbours, families and early alerts all
working well, it is about ${v.LIFT_LOW}. It matters most where informal help is thin. It is a simulation with synthetic people."

## All configurations

| configuration | seeds | alerts only: vulnerable | Last Mile: vulnerable | lift | all homes (AO → LM) | trapped per run (AO → LM) |
|---|---|---|---|---|---|---|
${rows.join('\n')}

Harsher assumptions that are not public engine knobs (help-request delay, helper start position) are in
[\`SENSITIVITY.md\`](SENSITIVITY.md) (Lane A's \`engine/src/sim/sensitivityReport.ts\`), and the baseline stress test in
[\`BASELINE_REVIEW.md\`](BASELINE_REVIEW.md) (Lane D).

## Placeholder values (used by \`--fill\` / \`--check\`)

| token | value |
|---|---|
${keys.join('\n')}
`;
}
const ci2 = (m) => `${p1(m.mean)} ${ci(m.ci95)}`;

const DOCS = ['DEVPOST.md', 'DEV_POST.md', 'VIDEO.md', 'PITCH_QA.md', 'DEMO_RUNBOOK.md', 'SENSITIVITY.md', '../DEMO_SCRIPT.md'].map((f) => path.join(SUB, f));

const results = await collect();
const v = values(results);
// extra tokens that come from SENSITIVITY.md (Lane A's report), if present
const sens = existsSync(path.join(SUB, 'SENSITIVITY.md')) ? readFileSync(path.join(SUB, 'SENSITIVITY.md'), 'utf8') : '';
const grab = (re) => { const m = re.exec(sens); return m ? `${m[1]} ${m[2]}` : undefined; };
const slow = grab(/help requests known 5–10 min[^|]*\|[^|]*\|[^|]*\|[^|]*\| ([+−-][\d.]+ pts) (\[[^\]]+\])/);
const far = grab(/helpers start far from the fire[^|]*\|[^|]*\|[^|]*\|[^|]*\| ([+−-][\d.]+ pts) (\[[^\]]+\])/);
if (slow) v.LIFT_SLOW = slow;
if (far) v.LIFT_FAR = far;
v.REPO_URL = 'https://github.com/VK2756/Last-Mile';

// baseline-strength rows from Lane D's BASELINE_REVIEW.md (100 paired seeds each); never typed by hand here
const review = readFileSync(path.join(SUB, 'BASELINE_REVIEW.md'), 'utf8');
const reviewRows = review.split('\n').filter((l) => /^\| .*\| \d+-\d+ \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/\*\*/g, '')));
const row = (group, config) => {
  const r = reviewRows.find((c) => c[0].startsWith(group) && c[1] === config);
  if (!r) throw new Error(`BASELINE_REVIEW.md: no row "${group}" / "${config}"`);
  const m = /^([\d.]+) (\[[^\]]+\])$/.exec(r[5]);
  if (!m) throw new Error(`BASELINE_REVIEW.md: cannot read lift "${r[5]}"`);
  return { ao: r[3], lm: r[4], lift: `+${m[1]} pts ${m[2]}`, short: `+${Math.round(Number(m[1]))}` };
};
const B = [
  ['no neighbour rides, 25% family pickup (headline default)', row('reference', 'preset (wind 20 mph E, 24 helpers)')],
  ['family pickup 50% instead of 25%', row('self-evac', 'familyPickupProb 0.5 (default 0.25)')],
  ['30% of neighbours with a car give a ride', row('neighbours give rides', 'neighborRideProb 0.3')],
  ['60% of neighbours give a ride', row('neighbours give rides', 'neighborRideProb 0.6')],
  ['every neighbour with a free seat gives a ride', row('neighbours give rides', 'neighborRideProb 1 (every car with a free seat)')],
  ['strong baseline: rides 60%, family 50%, faster prep, alert at ignition', row('strong baseline', 'rides 0.6, family 0.5, urgent pickup, prep 0.5, alert at ignition')],
];
const strong = B[5][1], rides30 = B[2][1];
v.LIFT_RIDES30 = rides30.lift;
v.LIFT_RIDES30_SHORT = rides30.short;
v.LIFT_STRONG = strong.lift;
v.LIFT_LOW = strong.short;
v.LIFT_HIGH = `+${Math.round(Number(v.LIFT.replace(/[^\d.]/g, '')))}`;
v.LIFT_RANGE = `${v.LIFT_LOW.slice(1)} to ${v.LIFT_HIGH.slice(1)} points`;
const configsMatch = /on (\d+) configs/.exec(review) ?? /these (\d+) configs/.exec(review);
const b = { CONFIGS: configsMatch ? configsMatch[1] : String(reviewRows.length), rows: B.map(([label, x]) => `| ${label} | ${x.ao} | ${x.lm} | ${x.lift} |`).join('\n') };
// links already filled by fill-links.mjs stay filled when NUMBERS.md is regenerated
const links = existsSync(path.join(SUB, 'links.json')) ? JSON.parse(readFileSync(path.join(SUB, 'links.json'), 'utf8')) : {};
let md = numbersMd(results, v, b);
for (const [token, value] of Object.entries(links)) md = md.split(`[${token}]`).join(value);
writeFileSync(path.join(SUB, 'NUMBERS.md'), md);
process.stderr.write('wrote docs/submission/NUMBERS.md\n');

if (flag('--fill')) {
  for (const f of DOCS) {
    if (!existsSync(f)) continue;
    let s = readFileSync(f, 'utf8');
    const before = s;
    for (const [k, val] of Object.entries(v)) s = s.split(`[${k}]`).join(val);
    if (s !== before) { writeFileSync(f, s); process.stderr.write(`filled ${path.relative(ROOT, f)}\n`); }
  }
}
if (flag('--check')) {
  let bad = 0;
  for (const f of DOCS) {
    if (!existsSync(f)) continue;
    const s = readFileSync(f, 'utf8');
    const left = [...s.matchAll(/\[(RUNS|BASE_VUL|LM_VUL|LIFT|LIFT_CI|FRESH_LIFT|HARSH_LIFT|LIFT_6|LIFT_FAST|LIFT_SLOW|LIFT_FAR)\]/g)].map((m) => m[1]);
    if (left.length) { bad++; console.error(`${path.relative(ROOT, f)}: unfilled ${[...new Set(left)].join(', ')}`); }
    if (s.includes('pts') && !s.includes(v.LIFT)) { bad++; console.error(`${path.relative(ROOT, f)}: does not quote the current headline lift ${v.LIFT}`); }
  }
  if (bad) process.exit(1);
  console.error('check: all docs quote the current numbers');
}
