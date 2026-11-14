import { afterEach, describe, expect, it } from 'vitest';
import { TriageResult } from '@lastmile/contracts';
import { fallbackTriage, triage } from '../src/triage';

const savedKey = process.env.GEMINI_API_KEY;
afterEach(() => { process.env.GEMINI_API_KEY = savedKey; });

describe('deterministic triage', () => {
  const cases = [
    { text: 'I need a ride. My mother uses a wheelchair. We are 2 people.', language: 'en', needs: ['no_vehicle', 'wheelchair'], ride: false, residents: 2 },
    { text: 'No tengo auto. Necesito oxígeno. Somos 3 personas.', language: 'es', needs: ['no_vehicle', 'oxygen'], ride: false, residents: 3 },
    { text: 'Sem carro. Minha mãe usa cadeira de rodas.', language: 'pt', needs: ['no_vehicle', 'wheelchair'], ride: false, residents: null },
    { text: '我没有车，使用轮椅。', language: 'zh', needs: ['no_vehicle', 'wheelchair'], ride: false, residents: null },
    { text: 'The fire is here. I cannot breathe. I have no car.', language: 'en', needs: ['no_vehicle'], ride: false, residents: null },
  ];
  for (const [index, item] of cases.entries()) it(`parses golden utterance ${index + 1}`, () => {
    const result = fallbackTriage({ householdId: 'h1', utterance: item.text, language: item.language, history: [] });
    expect(TriageResult.safeParse(result).success).toBe(true);
    expect(result.needs).toEqual(expect.arrayContaining(item.needs));
    expect(result.hasRide).toBe(item.ride);
    expect(result.residents).toBe(item.residents);
    if (index === 4) { expect(result.urgency).toBe(5); expect(result.reply).toContain('911'); }
  });
  it('uses the fallback without an API key', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await triage({ householdId: 'h1', utterance: 'No car. I use oxygen.', language: 'en', history: [] });
    expect(result.needs).toContain('oxygen');
    expect(result.reply).not.toMatch(/rescue (is|will)|arriv(e|al) in/i);
  });
});
