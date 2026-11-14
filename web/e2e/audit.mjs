import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
let failures = 0;
function report(label, pass, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
}
function read(path) {
  const full = resolve(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}
function git(args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 }); }
  catch (error) { return error.stdout?.toString() ?? ''; }
}

const stubMarker = `ST${'UB:'}`;
const stubs = git(['grep', '-n', stubMarker, '--', 'engine', 'packages', 'web']);
report('no stub markers', !stubs.trim(), stubs.trim() ? `${stubs.trim().split('\n').length} found` : '');

const live = read('web/components/live/LiveView.tsx');
const results = read('web/components/story/ResultsView.tsx');
const call = read('web/components/story/CallView.tsx');
report('SIMULATION badge on live, results, and call',
  /SimBadge|SIMULATION/.test(live) && /SimBadge|SIMULATION/.test(results) && /SimBadge|SIMULATION/.test(call));

const dashboard = read('web/app/dashboard/page.tsx');
const outcomeLiteral = /(?:evacuat(?:ed|ion)|lift|saved|trapped|outcome)[^\n]{0,100}\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*%[^\n]{0,100}(?:evacuat(?:ed|ion)|lift|saved|trapped|outcome)/i;
const hardCodedOutcome = [results, dashboard].some((source) => source.split('\n').some((line) =>
  !/95%\s*(?:confidence|CI)/i.test(line) && outcomeLiteral.test(line),
));
report('no hard-coded outcome percentages on results/dashboard', !hardCodedOutcome);

const triage = read('packages/ai/src/triage.ts');
const promise = /(?:we will|we can|guarantee|help is on the way)[^\n.]{0,80}(?:rescue|dispatch|arriv|pick you up)/i;
report('voice agent never promises rescue', /Never promise/.test(triage) && !promise.test(triage));

const history = git(['log', '--all', '-p', '--format=', '--', 'engine', 'packages', 'web', 'deploy', 'docs']);
const literalCredential = /(?:mongodb(?:\+srv)?:\/\/[^\s<>]{5,}@|postgres(?:ql)?:\/\/[^\s<>]{5,}@|AIza[0-9A-Za-z_-]{20,})/i;
const trackedEnv = git(['ls-files', '--', '.env', 'engine/.env', 'web/.env', 'packages/data/.env']);
report('secrets scan clean (tracked env files and credential patterns)', !trackedEnv.trim() && !literalCredential.test(history));

process.exitCode = failures ? 1 : 0;
