import { expect, test } from '@playwright/test';
import { LiveSession, type LiveCallbacks, type LiveTokenResponse, type SocketLike } from '../app/call/live/session';

class MockSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onerror: SocketLike['onerror'] = null;
  onclose: SocketLike['onclose'] = null;
  send(value: string) { this.sent.push(value); }
  close() { this.readyState = 3; this.onclose?.({} as CloseEvent); }
  open() { this.readyState = 1; this.onopen?.({} as Event); }
  receive(value: object) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent); }
}

test('Live WebSocket sends locked setup and PCM and handles transcription, audio, interruption', () => {
  const socket = new MockSocket();
  const seen: string[] = [];
  const token: LiveTokenResponse = { token: 'ephemeral-test-only', model: 'models/test-live', apiVersion: 'v1beta', expiresAt: '2099-01-01T00:00:00Z' };
  const callbacks: LiveCallbacks = {
    opened: () => seen.push('opened'), closed: () => seen.push('closed'), error: () => seen.push('error'),
    input: (value, interim) => seen.push(`${interim ? 'interim' : 'input'}:${value}`),
    output: (value) => seen.push(`output:${value}`), audio: (data) => seen.push(`audio:${data}`),
    interrupted: () => seen.push('interrupted'), turnComplete: () => seen.push('turnComplete'), raw: () => seen.push('raw'),
  };
  let url = '';
  const session = new LiveSession(token, callbacks, (next) => { url = next; return socket as unknown as SocketLike; });
  expect(url).toContain('BidiGenerateContentConstrained?access_token=ephemeral-test-only');
  socket.open();
  expect(JSON.parse(socket.sent[0]!)).toMatchObject({ setup: { model: 'models/test-live', inputAudioTranscription: {}, outputAudioTranscription: {} } });
  socket.receive({ setupComplete: {} });
  expect(seen).toContain('opened');
  session.sendAudio('AAE=');
  expect(JSON.parse(socket.sent[1]!)).toEqual({ realtimeInput: { audio: { data: 'AAE=', mimeType: 'audio/pcm;rate=16000' } } });
  socket.receive({ serverContent: { interimInputTranscription: { text: 'necesito' }, inputTranscription: { text: 'Necesito ayuda' }, outputTranscription: { text: '¿Puede caminar?' }, modelTurn: { parts: [{ inlineData: { data: 'AAE=' } }] }, interrupted: true, turnComplete: true } });
  expect(seen).toContain('interim:necesito');
  expect(seen).toContain('input:Necesito ayuda');
  expect(seen).toContain('output:¿Puede caminar?');
  expect(seen).toContain('audio:AAE=');
  expect(seen).toContain('interrupted');
  expect(seen).toContain('turnComplete');
  session.endAudio();
  expect(JSON.parse(socket.sent.at(-1)!)).toEqual({ realtimeInput: { audioStreamEnd: true } });
  session.close();
  expect(seen).toContain('closed');
});
