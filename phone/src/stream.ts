import type WebSocket from 'ws';

export type StreamStart = { streamSid: string; callSid: string; token: string };
/** Twilio sends connected before start; authenticate start before any audio bridge is opened. */
export function awaitStreamStart(socket: WebSocket, authorize: (value: StreamStart) => boolean, ready: (value: StreamStart) => void): void {
  const timer = setTimeout(() => socket.close(1008, 'Stream authorization timeout'), 5000);
  timer.unref();
  const receive = (raw: WebSocket.RawData) => {
    let event: { event?: string; start?: { streamSid?: string; callSid?: string; customParameters?: { token?: string } } };
    try { event = JSON.parse(raw.toString()); } catch { socket.close(1008); return; }
    if (event.event === 'connected') return;
    socket.off('message', receive);
    clearTimeout(timer);
    const value = { streamSid: event.start?.streamSid, callSid: event.start?.callSid, token: event.start?.customParameters?.token };
    if (event.event !== 'start' || !value.streamSid || !value.callSid || !value.token || !authorize(value as StreamStart)) { socket.close(1008); return; }
    ready(value as StreamStart);
  };
  socket.on('message', receive);
  socket.once('close', () => clearTimeout(timer));
}
