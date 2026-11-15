import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { describe, expect, it, vi } from 'vitest';
import { bridgeCall } from '../src/bridge';
import { encodeMuLaw } from '../src/audio';

class MockSocket extends EventEmitter {
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  send(value: string) { this.sent.push(JSON.parse(value)); }
  close() { if (this.readyState === 1) { this.readyState = 3; this.emit('close'); } }
  receive(value: unknown) { this.emit('message', Buffer.from(JSON.stringify(value))); }
}

describe('Twilio ↔ Gemini bridge', () => {
  it('transfers both audio directions, transcripts, interruption and finished history', async () => {
    const twilio = new MockSocket(), gemini = new MockSocket();
    const resident = vi.fn(async () => {}), finished = vi.fn(async () => {}), stop = vi.fn(async () => {});
    bridgeCall(twilio as unknown as WebSocket, gemini as unknown as WebSocket, {
      streamSid: 'MZtest', model: 'models/live-test', language: 'en', onResidentTurn: resident, onFinish: finished, onStopRequested: stop,
    });
    gemini.emit('open');
    expect(gemini.sent[0]).toMatchObject({ setup: { model: 'models/live-test', inputAudioTranscription: {}, outputAudioTranscription: {} } });
    gemini.receive({ setupComplete: {} });
    expect(gemini.sent[1]).toHaveProperty('clientContent');
    const ulaw = Buffer.alloc(160, encodeMuLaw(1000));
    twilio.receive({ event: 'media', media: { payload: ulaw.toString('base64') } });
    const input = gemini.sent[2] as { realtimeInput: { audio: { data: string } } };
    expect(Buffer.from(input.realtimeInput.audio.data, 'base64')).toHaveLength(640);
    const pcm = Buffer.alloc(960); // 20 ms of 24 kHz 16-bit audio
    gemini.receive({ serverContent: { modelTurn: { parts: [{ inlineData: { data: pcm.toString('base64') } }] } } });
    const output = twilio.sent[0] as { event: string; media: { payload: string } };
    expect(output.event).toBe('media');
    expect(Buffer.from(output.media.payload, 'base64')).toHaveLength(160);
    gemini.receive({ serverContent: { interrupted: true } });
    expect(twilio.sent[1]).toMatchObject({ event: 'clear', streamSid: 'MZtest' });
    gemini.receive({ serverContent: { inputTranscription: { text: 'No car' }, outputTranscription: { text: 'Do you need a ride?' }, turnComplete: true } });
    await vi.waitFor(() => expect(resident).toHaveBeenCalledWith('No car', []));
    twilio.receive({ event: 'stop' });
    await vi.waitFor(() => expect(finished).toHaveBeenCalledWith([
      { role: 'resident', text: 'No car' }, { role: 'agent', text: 'Do you need a ride?' },
    ]));
  });
  it('waits for Twilio playback mark before ending a stop request', async () => {
    const twilio = new MockSocket(), gemini = new MockSocket();
    const stop = vi.fn(async () => {});
    bridgeCall(twilio as unknown as WebSocket, gemini as unknown as WebSocket, {
      streamSid: 'MZstop', model: 'models/live-test', language: 'en',
      onResidentTurn: async () => {}, onFinish: async () => {}, onStopRequested: stop,
    });
    gemini.emit('open'); gemini.receive({ setupComplete: {} });
    gemini.receive({ serverContent: { inputTranscription: { text: 'Please stop' }, outputTranscription: { text: 'Goodbye.' }, turnComplete: true } });
    expect(twilio.sent.at(-1)).toMatchObject({ event: 'mark', mark: { name: 'stop-goodbye' } });
    expect(stop).not.toHaveBeenCalled();
    twilio.receive({ event: 'mark', mark: { name: 'stop-goodbye' } });
    await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
  });
});
