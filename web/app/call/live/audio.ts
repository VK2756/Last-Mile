const INPUT_RATE = 16_000;
const OUTPUT_RATE = 24_000;

const workletSource = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.pending = []; this.readAt = 0; this.levelAt = 0; }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    let energy = 0;
    for (let i = 0; i < channel.length; i++) energy += channel[i] * channel[i];
    this.levelAt += channel.length;
    if (this.levelAt >= sampleRate / 10) {
      this.port.postMessage({ level: Math.sqrt(energy / channel.length) });
      this.levelAt = 0;
    }
    const ratio = sampleRate / 16000;
    let at = this.readAt;
    for (; at < channel.length; at += ratio) {
      const low = Math.floor(at);
      const frac = at - low;
      const value = channel[low] * (1 - frac) + channel[Math.min(low + 1, channel.length - 1)] * frac;
      this.pending.push(Math.max(-1, Math.min(1, value)));
    }
    this.readAt = at - channel.length;
    while (this.pending.length >= 640) {
      const out = new Int16Array(640);
      for (let i = 0; i < out.length; i++) out[i] = Math.round(this.pending[i] * 32767);
      this.pending.splice(0, 640);
      this.port.postMessage({ pcm: out.buffer }, [out.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

function base64Pcm(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export class MicrophoneCapture {
  readonly inputRate = INPUT_RATE;
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private moduleUrl: string | null = null;

  async start(onPcm: (data: string) => void, onLevel: (level: number) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    this.context = new AudioContext();
    this.moduleUrl = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }));
    await this.context.audioWorklet.addModule(this.moduleUrl);
    this.node = new AudioWorkletNode(this.context, 'pcm-capture');
    this.node.port.onmessage = (event: MessageEvent<{ pcm?: ArrayBuffer; level?: number }>) => {
      if (event.data.pcm) onPcm(base64Pcm(event.data.pcm));
      if (event.data.level !== undefined) onLevel(event.data.level);
    };
    const source = this.context.createMediaStreamSource(this.stream);
    source.connect(this.node);
    // Keep the processor active while avoiding audible microphone loopback.
    const silent = this.context.createGain();
    silent.gain.value = 0;
    this.node.connect(silent).connect(this.context.destination);
    await this.context.resume();
  }

  async stop(): Promise<void> {
    this.node?.disconnect();
    this.node = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context) await this.context.close();
    this.context = null;
    if (this.moduleUrl) URL.revokeObjectURL(this.moduleUrl);
    this.moduleUrl = null;
  }
}

export class PcmPlayback {
  readonly outputRate = OUTPUT_RATE;
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;

  async ready(): Promise<void> {
    this.context ??= new AudioContext();
    await this.context.resume();
    this.nextStart = this.context.currentTime;
  }

  enqueue(base64: string): void {
    if (!this.context) return;
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const count = Math.floor(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    const buffer = this.context.createBuffer(1, count, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => this.sources.delete(source);
    const start = Math.max(this.context.currentTime, this.nextStart);
    source.start(start);
    this.nextStart = start + buffer.duration;
    this.sources.add(source);
  }

  interrupt(): void {
    for (const source of this.sources) { try { source.stop(); } catch { /* already ended */ } }
    this.sources.clear();
    this.nextStart = this.context?.currentTime ?? 0;
  }

  get playing(): boolean { return this.sources.size > 0; }
  async close(): Promise<void> { this.interrupt(); if (this.context) await this.context.close(); this.context = null; }
}
