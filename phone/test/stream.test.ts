import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { describe, expect, it, vi } from 'vitest';
import { awaitStreamStart } from '../src/stream';
import { allowedNumbers, CallGuard } from '../src/security';

class MockSocket extends EventEmitter {
  closes = 0;
  close() { this.closes++; this.emit('close'); }
  receive(value: unknown) { this.emit('message', Buffer.from(JSON.stringify(value))); }
}

describe('Twilio stream authentication', () => {
  it('ignores connected, verifies signed start and rejects token reuse', () => {
    const guard = new CallGuard('test-secret', allowedNumbers('+15551234567'));
    const token = guard.issue('+15551234567'); guard.bind(token, 'CA123');
    const first = new MockSocket(), ready = vi.fn();
    awaitStreamStart(first as unknown as WebSocket, ({ token, callSid }) => guard.consume(token, callSid) !== null, ready);
    first.receive({ event: 'connected' });
    expect(ready).not.toHaveBeenCalled();
    first.receive({ event: 'start', start: { streamSid: 'MZ1', callSid: 'CA123', customParameters: { token } } });
    expect(ready).toHaveBeenCalledWith({ streamSid: 'MZ1', callSid: 'CA123', token });
    const replay = new MockSocket();
    awaitStreamStart(replay as unknown as WebSocket, ({ token, callSid }) => guard.consume(token, callSid) !== null, vi.fn());
    replay.receive({ event: 'start', start: { streamSid: 'MZ2', callSid: 'CA123', customParameters: { token } } });
    expect(replay.closes).toBe(1);
  });
});
