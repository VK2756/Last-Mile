import { GoogleGenAI, Modality, type Model } from '@google/genai';

export const LIVE_SYSTEM_INSTRUCTION = `You are a calm needs-intake agent in a wildfire evacuation SIMULATION with synthetic people. Speak in short, clear sentences and ask one question at a time. Ask about mobility, vehicle access, medical needs, and the number of people. Support English and Spanish and answer in the caller's language. Never promise rescue, dispatch, arrival, or a pickup time. If the caller is in immediate danger, tell them to call 911. This is a simulation, not an emergency service.`;

export type LiveToken = { token: string; model: string; apiVersion: 'v1alpha' | 'v1beta'; expiresAt: string };

export function isLiveAudioModel(model: Model): boolean {
  const name = model.name ?? '';
  return /(?:live|native-audio)/i.test(name) && !/(?:transcrib|translat|tts)/i.test(name)
    && (!model.supportedActions?.length || model.supportedActions.some((action) => /bidi|live/i.test(action)));
}

export function chooseLiveModel(models: Model[], preferred?: string): string | null {
  const available = models.filter(isLiveAudioModel);
  const choice = preferred ? available.find((model) => model.name === preferred || model.name === `models/${preferred}`) : undefined;
  if (choice) return choice.name ?? null;
  // Deterministic ranking: native-audio models first, a "-latest" alias next; ties keep the API's order.
  const score = (m: Model) => (/native-audio/i.test(m.name ?? '') ? 2 : 0) + (/-latest$/i.test(m.name ?? '') ? 1 : 0);
  return [...available].sort((a, b) => score(b) - score(a))[0]?.name ?? null;
}

export async function createLiveToken(apiKey = process.env.GEMINI_API_KEY): Promise<LiveToken | null> {
  if (!apiKey) return null;
  const discovery = new GoogleGenAI({ apiKey });
  const models: Model[] = [];
  for await (const model of await discovery.models.list({ config: { pageSize: 100 } })) models.push(model);
  const model = chooseLiveModel(models, process.env.GEMINI_LIVE_MODEL);
  if (!model) throw new Error('No Live audio model is available for this key');
  const now = Date.now();
  const expiresAt = new Date(now + 10 * 60_000).toISOString();
  const newSessionExpireTime = new Date(now + 60_000).toISOString();
  const config = {
    uses: 1,
    expireTime: expiresAt,
    newSessionExpireTime,
    liveConnectConstraints: {
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: LIVE_SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    },
  };
  // The installed SDK documents v1alpha; current Google docs use v1beta. Try both without exposing the key.
  for (const apiVersion of ['v1alpha', 'v1beta'] as const) {
    try {
      const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion } });
      const result = await ai.authTokens.create({ config });
      if (!result.name) throw new Error('Token response was empty');
      return { token: result.name, model, apiVersion, expiresAt };
    } catch (error) {
      if (apiVersion === 'v1beta') throw error;
    }
  }
  throw new Error('Could not mint a Live token');
}
