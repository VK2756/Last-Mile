import { afterEach, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), versions: [] as string[] }));
vi.mock('@google/genai', () => ({
  Modality: { AUDIO: 'AUDIO' },
  GoogleGenAI: class {
    constructor(options: { httpOptions?: { apiVersion?: string } }) { calls.versions.push(options.httpOptions?.apiVersion ?? 'default'); }
    models = { list: calls.list };
    authTokens = { create: calls.create };
  },
}));

import { chooseLiveModel, createLiveToken, LIVE_SYSTEM_INSTRUCTION } from '../src/live-token';

const original = process.env.GEMINI_LIVE_MODEL;
afterEach(() => {
  if (original === undefined) delete process.env.GEMINI_LIVE_MODEL;
  else process.env.GEMINI_LIVE_MODEL = original;
  calls.list.mockReset();
  calls.create.mockReset();
  calls.versions.length = 0;
});

it('selects an available Live audio model and skips transcription-only models', () => {
  const models = [
    { name: 'models/transcribe-live', supportedActions: ['bidiGenerateContent'] },
    { name: 'models/working-live', supportedActions: ['bidiGenerateContent'] },
    { name: 'models/other-live', supportedActions: ['bidiGenerateContent'] },
  ];
  expect(chooseLiveModel(models, 'other-live')).toBe('models/other-live');
  expect(chooseLiveModel(models, 'missing-live')).toBe('models/working-live');
});

it('mints a single-use constrained token without returning the long-lived key', async () => {
  calls.list.mockResolvedValue((async function* () { yield { name: 'models/working-live', supportedActions: ['bidiGenerateContent'] }; })());
  calls.create.mockResolvedValue({ name: 'ephemeral-test-only' });
  const result = await createLiveToken('server-test-only');
  expect(result).toMatchObject({ token: 'ephemeral-test-only', model: 'models/working-live', apiVersion: 'v1alpha' });
  expect(JSON.stringify(result)).not.toContain('server-test-only');
  expect(calls.create).toHaveBeenCalledWith({ config: expect.objectContaining({
    uses: 1,
    liveConnectConstraints: { model: 'models/working-live', config: {
      responseModalities: ['AUDIO'], systemInstruction: LIVE_SYSTEM_INSTRUCTION,
      inputAudioTranscription: {}, outputAudioTranscription: {},
    } },
  }) });
});

it('requires no key for a graceful unavailable result', async () => {
  expect(await createLiveToken('')).toBeNull();
  expect(calls.list).not.toHaveBeenCalled();
});

it('retries token minting on v1beta when v1alpha is unavailable', async () => {
  calls.list.mockResolvedValue((async function* () { yield { name: 'models/working-live', supportedActions: ['bidiGenerateContent'] }; })());
  calls.create.mockRejectedValueOnce(new Error('unsupported version')).mockResolvedValueOnce({ name: 'ephemeral-test-only' });
  expect(await createLiveToken('server-test-only')).toMatchObject({ apiVersion: 'v1beta' });
  expect(calls.versions).toEqual(['default', 'v1alpha', 'v1beta']);
});
