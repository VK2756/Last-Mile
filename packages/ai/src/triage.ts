import { GoogleGenAI } from '@google/genai';
import { Need, TriageRequest, TriageResult, type TriageRequest as TriageRequestType, type TriageResult as TriageResultType } from '@lastmile/contracts';

const needs = Need.options;
const schema = {
  type: 'object',
  properties: {
    householdId: { type: 'string' },
    needs: { type: 'array', items: { type: 'string', enum: needs } },
    hasRide: { type: ['boolean', 'null'] },
    canWalkToRoad: { type: ['boolean', 'null'] },
    residents: { type: ['integer', 'null'] },
    urgency: { type: 'integer', minimum: 1, maximum: 5 },
    reply: { type: 'string' },
    summary: { type: 'string' },
    done: { type: 'boolean' },
  },
  required: ['householdId', 'needs', 'hasRide', 'canWalkToRoad', 'residents', 'urgency', 'reply', 'summary', 'done'],
};

const systemInstruction = `You are a calm emergency-needs intake assistant in a SIMULATION with synthetic residents. Use short sentences and at most one question per turn. Reply in the resident's language. Extract only the allowed Need values: ${needs.join(', ')}. Find ride availability, ability to walk to the road, resident count, and urgency 1-5. Set done=true once needs and ride availability are captured. Never promise a rescue, dispatch, arrival, or time. If anyone is in immediate danger, explicitly tell them to call 911. Ask for missing information if needed. Return JSON matching the schema.`;

export async function triage(input: TriageRequestType): Promise<TriageResultType> {
  const request = TriageRequest.parse(input);
  if (!process.env.GEMINI_API_KEY) return fallbackTriage(request);
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [...request.history.map((item) => `${item.role}: ${item.text}`), `resident: ${request.utterance}`].join('\n'),
      config: { systemInstruction, responseMimeType: 'application/json', responseJsonSchema: schema },
    });
    const result = TriageResult.parse(JSON.parse(response.text || '{}'));
    if (result.householdId !== request.householdId) throw new Error('Gemini returned a mismatched householdId');
    if (isImmediateDanger(request.utterance) && !mentionsEmergencyNumber(result.reply)) {
      return { ...result, reply: `${result.reply} ${emergencyInstruction(request.language)}` };
    }
    return result;
  } catch (error) {
    console.error('[ai] Gemini triage failed; using deterministic fallback', error);
    return fallbackTriage(request);
  }
}

function isImmediateDanger(text: string): boolean {
  return /\b(fire (is )?(here|at|in)|flames? (are )?(here|inside|near)|smoke (is )?(inside|filling)|trapped|can't breathe|cannot breathe|immediate danger|fuego (aqui|aquí|dentro)|atrapad[oa]|inc[eê]ndio|pres[oa])\b/i.test(text);
}
function mentionsEmergencyNumber(text: string): boolean { return /\b911\b/.test(text); }
function emergencyInstruction(language: string): string {
  return language.startsWith('es') ? 'Si está en peligro inmediato, llame al 911.' : 'If you are in immediate danger, call 911.';
}

export function fallbackTriage(input: TriageRequestType): TriageResultType {
  const request = TriageRequest.parse(input);
  const text = [...request.history.filter((item) => item.role === 'resident').map((item) => item.text), request.utterance].join(' ').toLowerCase();
  const extracted = new Set<typeof Need._type>();
  const patterns: [typeof Need._type, RegExp][] = [
    ['no_vehicle', /\b(no (car|vehicle|ride|transport)|don't have a (car|ride)|need a ride|no tengo (coche|auto|transporte)|sin (coche|auto|transporte)|sem (carro|transporte))\b|没有车/i],
    ['wheelchair', /\b(wheelchair|silla de ruedas|cadeira de rodas)\b|轮椅/i],
    ['oxygen', /\b(oxygen|ox[ií]geno|oxig[eê]nio)\b|氧气/i],
    ['dementia', /\b(dementia|demencia|失智|痴呆)\b/i],
    ['vision_impaired', /\b(blind|low vision|ciego|cega|盲人)\b/i],
    ['hearing_impaired', /\b(deaf|hard of hearing|sordo|surdo|聋)\b/i],
    ['medical_device', /\b(medical device|ventilator|dialysis|dispositivo m[eé]dico|呼吸机)\b/i],
    ['young_children', /\b(baby|infant|young child|beb[eé]|niñ[oa] pequeñ|婴儿)\b/i],
    ['pets', /\b(pet|dog|cat|mascota|cachorro|gato|宠物)\b/i],
    ['limited_english', /\b(no english|limited english|no hablo ingl[eé]s|não falo inglês|不会英语)\b/i],
    ['no_cell_signal', /\b(no (cell|phone) (service|signal)|sin señal|sem sinal|没有信号)\b/i],
  ];
  for (const [need, pattern] of patterns) if (pattern.test(text)) extracted.add(need);
  const hasRide = /\b(no ride|no car|need a ride|can't drive|cannot drive|no tengo (coche|auto|transporte)|sin (coche|auto|transporte)|sem (carro|transporte))\b|没有车/i.test(text) ? false
    : /\b(have a ride|have a car|can drive|tengo (coche|auto|transporte)|tenho carro)\b|有车/i.test(text) ? true : null;
  const canWalkToRoad = /\b(can walk|able to walk|puedo caminar|consigo andar|能走)\b/i.test(text) ? true
    : /\b(can't walk|cannot walk|unable to walk|no puedo caminar|não consigo andar|不能走)\b/i.test(text) ? false : null;
  const count = text.match(/\b([1-9]|1[0-2])\s+(people|persons|residents|personas|pessoas|人)\b/i);
  const residents = count ? Number(count[1]) : null;
  const danger = isImmediateDanger(text);
  const done = extracted.size > 0 && hasRide !== null;
  const spanish = request.language.startsWith('es');
  const reply = danger ? emergencyInstruction(request.language) : done
    ? spanish ? 'Gracias. He anotado sus necesidades. Si está en peligro inmediato, llame al 911.' : 'Thank you. I have recorded your needs. If you are in immediate danger, call 911.'
    : spanish ? '¿Tiene transporte para salir?' : 'Do you have a ride to leave?';
  return TriageResult.parse({ householdId: request.householdId, needs: [...extracted], hasRide, canWalkToRoad,
    residents, urgency: danger ? 5 : extracted.has('oxygen') || extracted.has('medical_device') ? 4 : extracted.size ? 3 : 2,
    reply, summary: spanish ? 'Necesidades registradas de forma simulada.' : 'Needs recorded in simulation.', done });
}
