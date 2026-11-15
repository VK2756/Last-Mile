import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';

let server: Server | undefined;
afterEach(async () => { if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); server = undefined; vi.unstubAllEnvs(); vi.resetModules(); });

describe('phone HTTP boundary', () => {
  it('answers health and rejects missing secret and unregistered numbers before any external API call', async () => {
    vi.stubEnv('PHONE_SHARED_SECRET', 'test-only-secret');
    vi.stubEnv('DEMO_PHONE_NUMBERS', '+15551234567');
    const { createPhoneServer } = await import('../src/server');
    server = createPhoneServer();
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Unexpected listener');
    const origin = 'http://127.0.0.1:' + address.port;
    expect((await fetch(origin + '/health')).status).toBe(200);
    const body = JSON.stringify({ to: '+15550000000' });
    expect((await fetch(origin + '/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body })).status).toBe(401);
    expect((await fetch(origin + '/call', { method: 'POST', headers: { 'content-type': 'application/json', 'x-phone-secret': 'test-only-secret' }, body })).status).toBe(403);
    const allowed = await fetch(origin + '/call', { method: 'POST', headers: { 'content-type': 'application/json', 'x-phone-secret': 'test-only-secret' }, body: JSON.stringify({ to: '+15551234567' }) });
    expect(allowed.status).toBe(503); // no Twilio/Gemini credentials supplied
  });
});
