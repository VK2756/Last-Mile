import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { StreamEvent, createMemorySink, type ScenarioConfig } from '@lastmile/contracts';
import { sampleFrame, sampleInit } from '@lastmile/contracts/fixtures';
import { buildServer } from '../src/server';
import type { ScenarioRunner } from '../src/sim/registry';

// A tiny fake runner so the "end" path can be tested in about a second.
const fake = (id: string, config: ScenarioConfig): ScenarioRunner => {
  let t = 0;
  return { init: { ...sampleInit, scenarioId: id, config }, get done() { return t >= 120; }, step(dt) { t = Math.min(120, t + dt); return { ...sampleFrame, scenarioId: id, policy: config.policy, t }; }, finalMetrics: () => sampleFrame.metrics };
};

const cfg = { seed: 1, wind: { speedMph: 20, dirDeg: 90 }, ignition: { lat: 42.3732, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 60 };
const post = (base: string, path: string, body: unknown) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('server (fake runner)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>; let base = '';
  beforeAll(async () => { process.env.NODE_ENV = 'test'; app = await buildServer({ factory: fake }); await app.listen({ port: 0, host: '127.0.0.1' }); base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`; });
  afterAll(async () => { await app.close(); });

  it('health', async () => { expect((await (await fetch(`${base}/health`)).json()).ok).toBe(true); });
  it('rejects bad config', async () => { expect((await post(base, '/scenarios', {})).status).toBe(400); });
  it('streams init, frames, end; every event parses', async () => {
    const { scenarioId } = await (await post(base, '/scenarios', cfg)).json();
    const text = await (await fetch(`${base}/scenarios/${scenarioId}/stream`)).text();
    const evs = text.split('\n\n').filter((b) => b.startsWith('data: ')).map((b) => StreamEvent.parse(JSON.parse(b.slice(6))));
    expect(evs[0]!.type).toBe('init'); expect(evs.at(-1)!.type).toBe('end');
    expect(evs.filter((e) => e.type === 'frame').length).toBeGreaterThan(3);
  }, 20_000);
  it('404 + control', async () => {
    expect((await fetch(`${base}/scenarios/nope/stream`)).status).toBe(404);
    const { scenarioId } = await (await post(base, '/scenarios', cfg)).json();
    expect((await (await post(base, `/scenarios/${scenarioId}/control`, { action: 'pause' })).json()).paused).toBe(true);
    expect((await post(base, `/scenarios/${scenarioId}/control`, { action: 'speed' })).status).toBe(400);
  });
});

describe('server (real engine)', () => {
  it('streams a parseable init and real frames', async () => {
    process.env.NODE_ENV = 'test';
    const app = await buildServer(); await app.listen({ port: 0, host: '127.0.0.1' });
    const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    try {
      const { scenarioId } = await (await post(base, '/scenarios', cfg)).json();
      const ac = new AbortController();
      const r = await fetch(`${base}/scenarios/${scenarioId}/stream`, { signal: ac.signal });
      const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = ''; const evs: StreamEvent[] = [];
      while (evs.length < 4) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value); const parts = buf.split('\n\n'); buf = parts.pop()!;
        for (const b of parts) if (b.startsWith('data: ')) evs.push(StreamEvent.parse(JSON.parse(b.slice(6))));
      }
      ac.abort();
      expect(evs[0]!.type).toBe('init');
      const init = evs[0] as Extract<StreamEvent, { type: 'init' }>;
      expect(init.init.households.length).toBe(600); expect(init.init.assumptions.length).toBeGreaterThan(5);
      const frames = evs.filter((e) => e.type === 'frame') as Extract<StreamEvent, { type: 'frame' }>[];
      const hid = init.init.households[0]!.id;
      const triage = { householdId: hid, needs: ['oxygen'], hasRide: false, canWalkToRoad: false, residents: 2, urgency: 5, reply: 'x', summary: 'y', done: true };
      const ok = await post(base, `/scenarios/${scenarioId}/households/${hid}/needs`, triage);
      expect(ok.status).toBe(200);
      expect((await post(base, `/scenarios/${scenarioId}/households/nope/needs`, { ...triage, householdId: 'nope' })).status).toBe(404);
      expect((await post(base, `/scenarios/${scenarioId}/households/${hid}/needs`, { bad: 1 })).status).toBe(400);
      expect(frames.length).toBeGreaterThanOrEqual(2); expect(frames[1]!.frame.t).toBeGreaterThan(frames[0]!.frame.t);
    } finally { await app.close(); }
  }, 20_000);
});

import { allowedOrigin } from '../src/server';
import { PRESETS } from '../src/sim/presets';
import { ScenarioConfig as SC } from '@lastmile/contracts';
import { createSim } from '../src/sim/engine';

describe('hardening', () => {
  it('CORS accepts * and comma lists', () => {
    expect(allowedOrigin('*', 'https://x.app')).toBe('*');
    expect(allowedOrigin('https://a.app, https://b.app', 'https://b.app')).toBe('https://b.app');
    expect(allowedOrigin('https://a.app', 'https://evil.app')).toBeNull();
    expect(allowedOrigin('https://a.app', undefined)).toBeNull();
  });
  it('GET /presets returns valid configs (3 originals first, then the 3 real-road stories)', async () => {
    const app = await buildServer({ factory: fake }); const r = await app.inject({ method: 'GET', url: '/presets' });
    const body = r.json(); expect(body).toHaveLength(6); expect(body.slice(0, 3).map((p: { id: string }) => p.id)).toEqual(['wind-driven-run', 'crosswind-flank', 'slow-burn-few-helpers']); body.forEach((p: { config: unknown }) => SC.parse(p.config)); await app.close();
    expect(PRESETS).toHaveLength(6);
  });
  it('rate limits POST /scenarios and rejects odd ids', async () => {
    const app = await buildServer({ factory: fake, ratePerMin: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await app.inject({ method: 'POST', url: '/scenarios', payload: cfg })).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect((await app.inject({ method: 'GET', url: '/scenarios/..%2Fetc/stream' })).statusCode).toBe(404);
    await app.close();
  });
  it('a streamed frame is under 100 KB', () => {
    const sim = createSim({ ...PRESETS[0]!.config }, 'sz'); sim.advance(900);
    expect(JSON.stringify({ type: 'frame', frame: sim.frame() }).length).toBeLessThan(100_000);
  });
});

import { envFlagsInUse, gitCommit } from '../src/server';
describe('production readiness', () => {
  it('health reports commit, env and uptime', async () => {
    const app = await buildServer({ factory: fake }); const h = (await app.inject({ method: 'GET', url: '/health' })).json();
    expect(h).toMatchObject({ ok: true, service: 'lastmile-engine' }); expect(typeof h.commit).toBe('string'); expect(typeof h.uptimeS).toBe('number'); await app.close();
  });
  it('env flag log lists names only, never values', () => {
    const flags = envFlagsInUse({ DATA_SINK: 'real', MONGODB_URI: 'mongodb://secret', FOO: 'x' } as NodeJS.ProcessEnv);
    expect(flags).toEqual(['DATA_SINK', 'MONGODB_URI']); expect(JSON.stringify(flags)).not.toContain('secret');
    expect(gitCommit().length).toBeGreaterThan(0);
  });
  it('persists a successful triage through the sink hook and survives a failing hook', async () => {
    const calls: unknown[][] = [];
    const sink = { ...createMemorySink(), onTriage: async (...a: unknown[]) => { calls.push(a); } } as unknown as import('../src/sim/engine').EngineSink;
    const app = await buildServer({ sink }); const { scenarioId } = (await app.inject({ method: 'POST', url: '/scenarios', payload: cfg })).json();
    const hid = 'h1'; const body = { householdId: hid, needs: ['oxygen'], hasRide: false, canWalkToRoad: false, residents: 2, urgency: 5, reply: 'x', summary: 'y', done: true };
    expect((await app.inject({ method: 'POST', url: `/scenarios/${scenarioId}/households/${hid}/needs`, payload: body })).statusCode).toBe(200);
    expect(calls).toHaveLength(1); expect(calls[0]![0]).toBe(scenarioId); expect(calls[0]![1]).toMatchObject({ householdId: hid });
    (sink as { onTriage: unknown }).onTriage = async () => { throw new Error('atlas down'); };
    const r = await app.inject({ method: 'POST', url: `/scenarios/${scenarioId}/households/h2/needs`, payload: { ...body, householdId: 'h2' } });
    expect([200, 409]).toContain(r.statusCode); await app.close();
  });
});

import { defaultMcWorkers, MC_MAX_RUNS } from '../src/server';
import { Registry } from '../src/sim/registry';
describe('public-server safety', () => {
  const origin = 'https://last-mile-seven.vercel.app';
  it('ENGINE_CORS_ORIGIN is used exactly; the default is permissive', async () => {
    const strict = await buildServer({ factory: fake, corsOrigin: `${origin}/, https://example.org` });
    const ok = await strict.inject({ method: 'GET', url: '/health', headers: { origin } });
    expect(ok.headers['access-control-allow-origin']).toBe(origin);
    const bad = await strict.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.app' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    await strict.close();
    const open = await buildServer({ factory: fake });
    const any = await open.inject({ method: 'GET', url: '/health', headers: { origin: 'https://anything.app' } });
    expect(any.headers['access-control-allow-origin']).toBeTruthy();
    await open.close();
  });
  it('rejects oversized bodies and Monte Carlo requests above the cap', async () => {
    const app = await buildServer({ factory: fake });
    expect((await app.inject({ method: 'POST', url: '/scenarios', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ pad: 'x'.repeat(70_000) }) })).statusCode).toBe(413);
    const tooMany = await app.inject({ method: 'POST', url: '/montecarlo', payload: { runs: MC_MAX_RUNS + 1 } });
    expect(tooMany.statusCode).toBe(400);
    const tooManySeeds = await app.inject({ method: 'POST', url: '/montecarlo', payload: { seeds: Array.from({ length: MC_MAX_RUNS + 1 }, (_, i) => i) } });
    expect(tooManySeeds.statusCode).toBe(400);
    await app.close();
  });
  it('caps live scenarios and only evicts scenarios that have sat idle', () => {
    const reg = new Registry((id, config) => fake(id, config), 15 * 60_000);
    reg.maxScenarios = 3;
    for (let i = 0; i < 3; i++) reg.create(cfg as ScenarioConfig);
    expect(() => reg.create(cfg as ScenarioConfig)).toThrow(Registry.FULL); // all fresh: nothing evicted
    reg.close();
  });
  it('removes idle scenarios after the TTL', () => {
    const reg = new Registry((id, config) => fake(id, config), 15 * 60_000);
    const s = reg.create(cfg as ScenarioConfig);
    reg.sweep(Date.now() + 14 * 60_000); expect(reg.get(s.id)).toBeDefined();
    reg.sweep(Date.now() + 16 * 60_000); expect(reg.get(s.id)).toBeUndefined();
    reg.close();
  });
  it('Monte Carlo workers default to min(4, cores-1) and honour ENGINE_MC_WORKERS', () => {
    expect(defaultMcWorkers({}, 12)).toBe(4); expect(defaultMcWorkers({}, 2)).toBe(1); expect(defaultMcWorkers({}, 1)).toBe(1);
    expect(defaultMcWorkers({ ENGINE_MC_WORKERS: '2' } as NodeJS.ProcessEnv, 12)).toBe(2);
  });
});
