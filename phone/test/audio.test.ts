import { describe, expect, it } from 'vitest';
import { decodeMuLaw, encodeMuLaw, muLaw8kToPcm16k, pcm24kToMuLaw8k } from '../src/audio';

describe('G.711 mu-law and sample rates', () => {
  it('round trips signed speech samples within companding precision', () => {
    for (const sample of [-30000, -10000, -1000, 0, 1000, 10000, 30000]) {
      const decoded = decodeMuLaw(encodeMuLaw(sample));
      expect(Math.sign(decoded)).toBe(Math.sign(sample));
      expect(Math.abs(decoded - sample)).toBeLessThan(Math.max(32, Math.abs(sample) * 0.08));
    }
  });
  it('upsamples 20 ms of Twilio audio to 16 kHz PCM', () => {
    const input = Buffer.alloc(160, encodeMuLaw(1000));
    const output = muLaw8kToPcm16k(input);
    expect(output).toHaveLength(640);
    expect(output.readInt16LE(0)).toBe(decodeMuLaw(input[0]!));
    expect(output.readInt16LE(2)).toBe(decodeMuLaw(input[0]!));
  });
  it('downsamples 24 kHz PCM to 8 kHz mu-law with a three-sample low-pass average', () => {
    const input = Buffer.alloc(12);
    [1000, 2000, 3000, -1000, -2000, -3000].forEach((sample, i) => input.writeInt16LE(sample, i * 2));
    const output = pcm24kToMuLaw8k(input);
    expect(output).toHaveLength(2);
    expect(decodeMuLaw(output[0]!)).toBeCloseTo(2000, -2);
    expect(decodeMuLaw(output[1]!)).toBeCloseTo(-2000, -2);
  });
});
