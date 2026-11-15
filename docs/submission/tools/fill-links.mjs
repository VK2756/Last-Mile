#!/usr/bin/env node
// Fill the public links into every submission doc in one command (Lane E).
//
//   node docs/submission/tools/fill-links.mjs --demo https://lastmile.example --api https://api.lastmile.example \
//        --video https://youtu.be/xyz --post https://dev.to/team/post
//
// Tokens (one per link; write exactly these in docs/submission/**):
//   [DEMO_URL]  --demo   the web app, no trailing slash (pages: [DEMO_URL]/live, [DEMO_URL]/results ...)
//   [API_URL]   --api    the engine (health: [API_URL]/health)
//   [VIDEO_URL] --video  the demo video
//   [DEV_URL]   --post   the DEV Writing Challenge post
//   [DOMAIN]    (derived from --demo: its host name, e.g. lastmile.example)
//
// Idempotent: the values used last time are kept in docs/submission/links.json. Re-running with the same flags
// changes nothing; re-running with a new URL replaces the old value everywhere. Pass only the flags you have;
// the rest stay as tokens. --check exits 1 if any token is still unfilled (use before submitting).
// docs/submission/evidence/** (Lane C), tools/ and sensitivity/ are never touched, nor text between
// <!-- fill-links:off --> and <!-- fill-links:on --> (the token table in DEMO_RUNBOOK.md).
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(SUB, '..', '..');
const STATE = path.join(SUB, 'links.json');
const SKIP = new Set(['evidence', 'tools', 'sensitivity']);

const args = process.argv.slice(2);
const opt = (f) => {
  const i = args.indexOf(f);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`${f} needs a URL`);
  return v;
};
const url = (flag) => {
  const v = opt(flag);
  if (v === undefined) return undefined;
  let u;
  try {
    u = new URL(v);
  } catch {
    throw new Error(`${flag}: not a URL: ${v}`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`${flag}: must be http(s): ${v}`);
  return v.replace(/\/+$/, '');
};

const TOKENS = { DEMO_URL: '--demo', API_URL: '--api', VIDEO_URL: '--video', DEV_URL: '--post' };
const next = {};
for (const [token, flag] of Object.entries(TOKENS)) {
  const v = url(flag);
  if (v) next[token] = v;
}
if (next.DEMO_URL) next.DOMAIN = new URL(next.DEMO_URL).hostname;

const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return SKIP.has(name) && dir === SUB ? [] : files(p);
    return /\.(md|txt|html)$/i.test(name) ? [p] : [];
  });
}

const all = files(SUB);

/** Apply fn to the parts of a file outside <!-- fill-links:off --> ... <!-- fill-links:on --> blocks. */
const OFF = /<!-- fill-links:off -->[\s\S]*?<!-- fill-links:on -->/g;
function outside(text, fn) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(OFF)) {
    out += fn(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(text.slice(last));
}
if (args.includes('--check')) {
  const left = [];
  for (const f of all) {
    const s = readFileSync(f, 'utf8').replace(OFF, '');
    const found = [...new Set([...s.matchAll(/\[(DEMO_URL|API_URL|VIDEO_URL|DEV_URL|DOMAIN)\]/g)].map((m) => m[1]))];
    if (found.length) left.push(`${path.relative(ROOT, f)}: ${found.join(', ')}`);
  }
  if (left.length) {
    console.error(`unfilled link tokens:\n  ${left.join('\n  ')}`);
    process.exit(1);
  }
  console.error('check: every link token is filled');
  process.exit(0);
}
if (!Object.keys(next).length) {
  console.error('nothing to fill: pass at least one of --demo, --api, --video, --post (or --check)');
  process.exit(2);
}

// replacements: the token itself, plus the value used last time if it changed (longest first, so a URL that
// contains another one is replaced whole)
const pairs = [];
for (const [token, value] of Object.entries(next)) {
  pairs.push([`[${token}]`, value]);
  // a bare host name is too short to replace safely inside other text; only its token is filled
  if (prev[token] && prev[token] !== value && token !== 'DOMAIN') pairs.push([prev[token], value]);
  if (token === 'DOMAIN' && prev.DOMAIN && prev.DOMAIN !== value) console.warn(`note: [DOMAIN] was ${prev.DOMAIN}; search the docs for it by hand`);
}
pairs.sort((a, b) => b[0].length - a[0].length);

const changed = [];
for (const f of all) {
  const before = readFileSync(f, 'utf8');
  const s = outside(before, (part) => pairs.reduce((acc, [from, to]) => acc.split(from).join(to), part));
  if (s !== before) {
    writeFileSync(f, s);
    changed.push(path.relative(ROOT, f));
  }
}
const state = { ...prev, ...next };
if (JSON.stringify(state) !== JSON.stringify(prev)) writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');

console.log(changed.length ? `changed ${changed.length} file(s):\n  ${changed.join('\n  ')}` : 'no changes (already filled with these values)');
for (const [token, value] of Object.entries(next)) console.log(`  [${token}] = ${value}`);
