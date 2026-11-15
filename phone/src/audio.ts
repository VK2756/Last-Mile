/** Twilio uses 8 kHz G.711 mu-law; Gemini Live accepts 16 kHz PCM and emits 24 kHz PCM. */
export function decodeMuLaw(byte: number): number {
  const value = (~byte) & 0xff;
  const magnitude = (((value & 0x0f) << 3) + 0x84) << ((value >> 4) & 0x07);
  return (value & 0x80 ? 0x84 - magnitude : magnitude - 0x84);
}

export function encodeMuLaw(sample: number): number {
  const negative = sample < 0;
  let magnitude = Math.min(32635, Math.abs(Math.round(sample))) + 0x84;
  let exponent = 7;
  for (let mask = 0x4000; exponent > 0 && !(magnitude & mask); mask >>= 1) exponent--;
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return (~((negative ? 0x80 : 0) | (exponent << 4) | mantissa)) & 0xff;
}

/** Linear 2x interpolation, little-endian signed PCM. */
export function muLaw8kToPcm16k(bytes: Uint8Array): Buffer {
  const out = Buffer.alloc(bytes.length * 4);
  for (let i = 0; i < bytes.length; i++) {
    const a = decodeMuLaw(bytes[i]!);
    const b = i + 1 < bytes.length ? decodeMuLaw(bytes[i + 1]!) : a;
    out.writeInt16LE(a, i * 4);
    out.writeInt16LE(Math.round((a + b) / 2), i * 4 + 2);
  }
  return out;
}

/** Box-filter 3x decimation; callers retain any trailing partial frame. */
export function pcm24kToMuLaw8k(pcm: Buffer): Buffer {
  const frames = Math.floor(pcm.length / 6);
  const out = Buffer.alloc(frames);
  for (let i = 0; i < frames; i++) {
    const at = i * 6;
    const mean = (pcm.readInt16LE(at) + pcm.readInt16LE(at + 2) + pcm.readInt16LE(at + 4)) / 3;
    out[i] = encodeMuLaw(mean);
  }
  return out;
}
