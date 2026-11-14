import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { StreamEvent } from '@lastmile/contracts';
import { buildServer } from '../src/server';
import { createSyntheticRunner } from '../src/sim/synthetic';

let app: Awaited<ReturnType<typeof buildServer>>; let base = '';
beforeAll(async () => { process.env.NODE_ENV = 'test'; app = await buildServer({ factory: (id, c) => createSyntheticRunner(id, c, 120) }); await app.listen({ port: 0, host: '127.0.0.1' }); base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`; });
afterAll(async () => { await app.close(); });

const cfg = { seed: 1, wind: { speedMph: 20, dirDeg: 90 }, ignition: { lat: 42.3732, lng: -72.5199 }, policy: 'last_mile', speedMultiplier: 60 };

describe('server', () => {
  it('health', async () => { const r = await fetch(`${base}/health`); expect((await r.json()).ok).toBe(true); });
  it('rejects bad config', async () => { const r = await fetch(`${base}/scenarios`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); expect(r.status).toBe(400); });
  it('streams init, frames, end; every event parses', async () => {
    const { scenarioId } = await (await fetch(`${base}/scenarios`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg) })).json();
    const r = await fetch(`${base}/scenarios/${scenarioId}/stream`);
    const text = await r.text();
    const evs = text.split('\n\n').filter((b) => b.startsWith('data: ')).map((b) => StreamEvent.parse(JSON.parse(b.slice(6))));
    expect(evs[0]!.type).toBe('init');
    expect(evs.at(-1)!.type).toBe('end');
    expect(evs.filter((e) => e.type === 'frame').length).toBeGreaterThan(3);
  }, 20_000);
  it('404 + control', async () => {
    expect((await fetch(`${base}/scenarios/nope/stream`)).status).toBe(404);
    const { scenarioId } = await (await fetch(`${base}/scenarios`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg) })).json();
    const r = await fetch(`${base}/scenarios/${scenarioId}/control`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pause' }) });
    expect((await r.json()).paused).toBe(true);
  });
});
