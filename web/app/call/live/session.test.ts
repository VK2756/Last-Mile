import { describe, expect, it } from 'vitest';
import { liveFrameText } from './session';

describe('liveFrameText', () => {
  it('decodes string, Blob (browsers) and ArrayBuffer frames', async () => {
    const json = '{"setupComplete":{}}';
    expect(await liveFrameText(json)).toBe(json);
    expect(await liveFrameText(new Blob([json]))).toBe(json);
    expect(await liveFrameText(new TextEncoder().encode(json).buffer)).toBe(json);
  });
});
