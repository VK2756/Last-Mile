export type LiveTokenResponse = { token: string; model: string; apiVersion: 'v1alpha' | 'v1beta'; expiresAt: string };

export type LiveEvent = {
  setupComplete?: object;
  serverContent?: {
    inputTranscription?: { text?: string };
    interimInputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
};

export type LiveCallbacks = {
  opened(): void;
  closed(): void;
  error(): void;
  input(text: string, interim: boolean): void;
  output(text: string): void;
  audio(data: string): void;
  interrupted(): void;
  turnComplete(): void;
  raw(event: LiveEvent): void;
};

export type SocketLike = Pick<WebSocket, 'readyState' | 'send' | 'close' | 'onopen' | 'onmessage' | 'onerror' | 'onclose'>;

export function liveSocketUrl(token: LiveTokenResponse): string {
  const method = `${token.apiVersion}.GenerativeService.BidiGenerateContentConstrained`;
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${method}?access_token=${encodeURIComponent(token.token)}`;
}

export class LiveSession {
  private socket: SocketLike;
  constructor(token: LiveTokenResponse, callbacks: LiveCallbacks, connect: (url: string) => SocketLike = (url) => new WebSocket(url)) {
    this.socket = connect(liveSocketUrl(token));
    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ setup: {
        model: token.model,
        generationConfig: { responseModalities: ['AUDIO'] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      } }));
    };
    this.socket.onmessage = (message) => {
      let event: LiveEvent;
      try { event = JSON.parse(String(message.data)) as LiveEvent; }
      catch { return; }
      callbacks.raw(event);
      if (event.setupComplete) callbacks.opened();
      const content = event.serverContent;
      if (!content) return;
      if (content.interrupted) callbacks.interrupted();
      if (content.interimInputTranscription?.text) callbacks.input(content.interimInputTranscription.text, true);
      if (content.inputTranscription?.text) callbacks.input(content.inputTranscription.text, false);
      if (content.outputTranscription?.text) callbacks.output(content.outputTranscription.text);
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) callbacks.audio(part.inlineData.data);
      }
      if (content.turnComplete) callbacks.turnComplete();
    };
    this.socket.onerror = () => callbacks.error();
    this.socket.onclose = () => callbacks.closed();
  }

  sendAudio(base64: string): void {
    if (this.socket.readyState !== 1) return;
    this.socket.send(JSON.stringify({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } }));
  }

  endAudio(): void {
    if (this.socket.readyState === 1) this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  close(): void { this.socket.close(); }
}
