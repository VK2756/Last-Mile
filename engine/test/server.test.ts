import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { StreamEvent, type ScenarioConfig } from '@lastmile/contracts';
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
  it('GET /presets returns 3 valid configs', async () => {
    const app = await buildServer({ factory: fake }); const r = await app.inject({ method: 'GET', url: '/presets' });
    const body = r.json(); expect(body).toHaveLength(3); body.forEach((p: { config: unknown }) => SC.parse(p.config)); await app.close();
    expect(PRESETS).toHaveLength(3);
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
