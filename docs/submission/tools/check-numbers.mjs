#!/usr/bin/env node
// Number checker (Lane E): every percentage or "points" claim in the submission docs and the web copy must match
// a value in the evaluator's outputs. Fails (exit 1) on any figure with no source.
//
//   node docs/submission/tools/check-numbers.mjs            # check, print problems
//   node docs/submission/tools/check-numbers.mjs --verbose  # also list every claim and where it was matched
//
// Sources (what a claim may quote):
//   docs/submission/NUMBERS.md          generated from real Monte Carlo runs (numbers.mjs)
//   docs/submission/BASELINE_REVIEW.md  Lane D's baseline stress test
//   docs/submission/sensitivity/**      raw evaluator outputs (JSON) and Lane A's sensitivity report
// A claim matches when some source value, rounded to the claim's own precision, equals it: "+29 points" matches
// 29.4, "+12.3 pts" must match 12.3 exactly. Model parameters (25% family pickup, 30% of neighbours...) are in the
// sources' prose, so they match too. Real-world statistics (NIST, CDC) are not percentages in our copy; if one is
// ever added, it belongs in SOURCES.md and in ALLOW below with its row number.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(SUB, '..', '..');
const verbose = process.argv.includes('--verbose');

function walk(dir, ok) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' || n.startsWith('.') ? [] : walk(p, ok);
    return ok(p) ? [p] : [];
  });
}

// ---------- source values ----------
const values = new Set(); // stored as numbers (percent / points scale, e.g. 29.4)
const addNum = (s) => {
  const x = Number(String(s).replace('−', '-').replace('+', ''));
  if (Number.isFinite(x)) values.add(Math.abs(x));
};
function harvestText(text) {
  // value followed by %, pts/points, or a CI bracket; both ends of every [a, b]; signed lifts like +12.3
  for (const m of text.matchAll(/([+−-]?\d+(?:\.\d+)?)\s?(?:%|pts\b|points\b|\[)/g)) addNum(m[1]);
  for (const m of text.matchAll(/\[\s*([+−-]?\d+(?:\.\d+)?)\s*(?:%|pts)?\s*,\s*([+−-]?\d+(?:\.\d+)?)\s*(?:%|pts)?\s*\]/g)) {
    addNum(m[1]);
    addNum(m[2]);
  }
  for (const m of text.matchAll(/(?:^|[\s(|])\+(\d+(?:\.\d+)?)\b/gm)) addNum(m[1]);
}
function harvestJson(node) {
  if (typeof node === 'number') {
    if (node > 0 && node <= 1) values.add(node * 100); // rates and lifts are fractions in the JSON
    return;
  }
  if (Array.isArray(node)) node.forEach(harvestJson);
  else if (node && typeof node === 'object') Object.values(node).forEach(harvestJson);
}
const SOURCES = [path.join(SUB, 'NUMBERS.md'), path.join(SUB, 'BASELINE_REVIEW.md'), ...walk(path.join(SUB, 'sensitivity'), (p) => /\.(md|json)$/.test(p))];
for (const f of SOURCES) {
  const t = readFileSync(f, 'utf8');
  if (f.endsWith('.json')) harvestJson(JSON.parse(t));
  else harvestText(t);
}

// ---------- what is not an outcome claim ----------
/** Patterns on the text right around a figure that make it a non-claim (method, layout, zoom). Keep this list short. */
const ALLOW = [
  [/\b95%\s*(?:CI|confidence|interval|bootstrap|intervals)/i, 'confidence level'],
  [/\b100% zoom/i, 'browser zoom'],
];

// ---------- targets ----------
const DOCS = walk(SUB, (p) => p.endsWith('.md') && !p.includes(`${path.sep}evidence${path.sep}`) && !p.includes(`${path.sep}sensitivity${path.sep}`))
  .filter((p) => !SOURCES.includes(p))
  .concat([path.join(ROOT, 'docs', 'DEMO_SCRIPT.md')]);
const WEB = [
  ...walk(path.join(ROOT, 'web', 'app'), (p) => /\.(tsx|ts|mdx)$/.test(p)),
  ...walk(path.join(ROOT, 'web', 'components'), (p) => /\.tsx$/.test(p)),
];

/** In code, only look inside JSX text and string literals that read like prose (skip CSS and class names). */
function proseSpans(line) {
  const spans = [];
  for (const m of line.matchAll(/>([^<>{}]*\d[^<>{}]*)</g)) spans.push(m[1]);
  for (const m of line.matchAll(/(['"`])((?:(?!\1).)*\d(?:(?!\1).)*)\1/g)) {
    const s = m[2];
    if (/[a-z]{3,}\s+[a-z]{2,}/i.test(s) && !/(?:^|\s)[\w-]+:\S|\bcalc\(|translate|color-mix|oklab|rgba?\(|w-\[|h-\[|\d%_/.test(s)) spans.push(s);
  }
  const t = line.trim();
  if (!/[<>{}=;()]/.test(t) && /[a-z]{3,}\s+[a-z]{2,}/i.test(t)) spans.push(t); // JSX text on its own line
  return spans;
}

const CLAIM = /(?<![\w.])([+−-]?\d+(?:\.\d+)?)\s?(%|pts\b|points\b|percentage points\b)/g;
const RANGE = /(?<![\w.])\+?(\d+(?:\.\d+)?)\s*(?:to|–|-|and)\s*\+?(\d+(?:\.\d+)?)\s*(?:percentage\s+)?points\b/g;

const decimals = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
function matches(raw) {
  const v = Math.abs(Number(raw.replace('−', '-').replace('+', '')));
  const d = decimals(raw);
  for (const s of values) if (Math.abs(Number(s.toFixed(d)) - v) < 1e-9) return true;
  return false;
}

const problems = [];
let claims = 0;
function check(file, text, isCode) {
  text.split('\n').forEach((line, i) => {
    const spans = isCode ? proseSpans(line) : [line];
    for (const span of spans) {
      const found = [];
      for (const m of span.matchAll(CLAIM)) found.push({ raw: m[1], at: m.index, unit: m[2] });
      for (const m of span.matchAll(RANGE)) found.push({ raw: m[1], at: m.index, unit: 'points (range)' });
      for (const f of found) {
        const ctx = span.slice(Math.max(0, f.at - 20), f.at + 30);
        if (ALLOW.some(([re]) => re.test(ctx))) continue;
        claims++;
        const ok = matches(f.raw);
        const where = `${path.relative(ROOT, file)}:${i + 1}`;
        if (verbose) console.log(`${ok ? 'ok  ' : 'MISS'} ${where}  ${f.raw} ${f.unit}`);
        if (!ok) problems.push(`${where}: "${f.raw} ${f.unit}" has no matching value in NUMBERS.md, BASELINE_REVIEW.md or sensitivity/  ->  ${span.trim().slice(0, 140)}`);
      }
    }
  });
}
for (const f of DOCS) check(f, readFileSync(f, 'utf8'), false);
for (const f of WEB) check(f, readFileSync(f, 'utf8'), true);

if (problems.length) {
  console.error(`check-numbers: ${problems.length} figure(s) with no source (of ${claims} checked):\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.error(`check-numbers: all ${claims} percentage/points figures in ${DOCS.length} docs and ${WEB.length} web files match a source value`);
