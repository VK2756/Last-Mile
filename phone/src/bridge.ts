import type WebSocket from 'ws';
import { LIVE_SYSTEM_INSTRUCTION } from '@lastmile/ai';
import { muLaw8kToPcm16k, pcm24kToMuLaw8k } from './audio';

export type Turn = { role: 'agent' | 'resident'; text: string };
export type BridgeOptions = {
  streamSid: string;
  model: string;
  language: string;
  onResidentTurn: (text: string, history: Turn[]) => Promise<void>;
  onFinish: (history: Turn[]) => Promise<void>;
  onStopRequested: () => Promise<void>;
};

function parseMessage(raw: WebSocket.RawData): Record<string, unknown> | null {
  try { const value: unknown = JSON.parse(raw.toString()); return value && typeof value === 'object' ? value as Record<string, unknown> : null; }
  catch { return null; }
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function send(socket: WebSocket, value: unknown): void {
  if (socket.readyState === 1) socket.send(JSON.stringify(value));
}

/** One verified Twilio stream paired with one server-side Gemini Live socket. */
export function bridgeCall(twilio: WebSocket, gemini: WebSocket, options: BridgeOptions): () => void {
  const history: Turn[] = [];
  let input = '', output = '', pcmRemainder = Buffer.alloc(0), ready = false, finished = false;
  let goodbyeTimer: NodeJS.Timeout | undefined;
  let stopPending = false;
  const requestStop = () => {
    if (!stopPending || finished) return;
    stopPending = false;
    if (goodbyeTimer) clearTimeout(goodbyeTimer);
    void options.onStopRequested().finally(finish);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    if (goodbyeTimer) clearTimeout(goodbyeTimer);
    if (input.trim()) history.push({ role: 'resident', text: input.trim() });
    if (output.trim()) history.push({ role: 'agent', text: output.trim() });
    void options.onFinish([...history]).catch(() => {});
    try { gemini.close(); } catch { /* already closed */ }
    try { twilio.close(); } catch { /* already closed */ }
  };
  gemini.on('open', () => send(gemini, { setup: {
    model: options.model,
    generationConfig: { responseModalities: ['AUDIO'] },
    systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION + ' At the start, say this is an automated AI call from a wildfire evacuation simulation using synthetic data. In a real emergency, call 911. Never promise rescue. If asked to stop, say goodbye politely and end the call.' + (options.language === 'es' ? ' Respond in Spanish.' : '') }] },
    inputAudioTranscription: {}, outputAudioTranscription: {},
    realtimeInputConfig: { automaticActivityDetection: {} },
  } }));
  gemini.on('message', (raw) => {
    const event = parseMessage(raw);
    if (!event) return;
    if (event.setupComplete) {
      ready = true;
      send(gemini, { clientContent: { turns: [{ role: 'user', parts: [{ text: 'Start the automated simulation call now with the required disclosure and first needs question.' }] }], turnComplete: true } });
    }
    const content = object(event.serverContent);
    if (content.interrupted) {
      pcmRemainder = Buffer.alloc(0);
      send(twilio, { event: 'clear', streamSid: options.streamSid });
    }
    const inText = object(content.inputTranscription).text;
    const outText = object(content.outputTranscription).text;
    if (typeof inText === 'string' && inText.trim()) input += inText.trim() + ' ';
    if (typeof outText === 'string' && outText.trim()) output += outText.trim() + ' ';
    for (const part of (object(content.modelTurn).parts as unknown[] | undefined) ?? []) {
      const data = object(object(part).inlineData).data;
      if (typeof data !== 'string') continue;
      const bytes = Buffer.concat([pcmRemainder, Buffer.from(data, 'base64')]);
      const length = Math.floor(bytes.length / 6) * 6;
      pcmRemainder = bytes.subarray(length);
      if (!length) continue;
      const payload = pcm24kToMuLaw8k(bytes.subarray(0, length)).toString('base64');
      send(twilio, { event: 'media', streamSid: options.streamSid, media: { payload } });
    }
    if (content.turnComplete) {
      const utterance = input.trim(), answer = output.trim();
      input = ''; output = '';
      const prior = [...history];
      if (utterance) history.push({ role: 'resident', text: utterance });
      if (answer) history.push({ role: 'agent', text: answer });
      if (utterance) {
        void options.onResidentTurn(utterance, prior).catch(() => {});
        if (!stopPending && /\b(stop|hang up|end (the )?call|do not call|no me llame|termina (la )?llamada|cuelga)\b/i.test(utterance)) {
          stopPending = true;
          send(twilio, { event: 'mark', streamSid: options.streamSid, mark: { name: 'stop-goodbye' } });
          goodbyeTimer = setTimeout(requestStop, 5000);
          goodbyeTimer.unref();
        }
      }
    }
  });
  twilio.on('message', (raw) => {
    const event = parseMessage(raw);
    if (!event) return;
    if (event.event === 'stop') { finish(); return; }
    if (event.event === 'mark' && object(event.mark).name === 'stop-goodbye') {
      requestStop(); return;
    }
    if (event.event !== 'media' || !ready) return;
    const payload = object(event.media).payload;
    if (typeof payload !== 'string') return;
    const audio = muLaw8kToPcm16k(Buffer.from(payload, 'base64'));
    send(gemini, { realtimeInput: { audio: { data: audio.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } });
  });
  twilio.on('close', finish);
  gemini.on('close', finish);
  gemini.on('error', finish);
  return finish;
}
