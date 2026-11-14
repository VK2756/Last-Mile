// LOCAL MOCK RESPONDER for /call (Lane E). Used ONLY when POST /api/triage is missing (404) or failing,
// so the call screen always works on stage. The UI labels it "Local mock responder (Gemini not connected)".
// It is a keyword matcher, not Gemini. It never promises rescue and always repeats the 911 line.
import { TriageResult, type Need, type TriageRequest } from '@lastmile/contracts';

const PATTERNS: Array<[Need, RegExp]> = [
  ['no_vehicle', /\b(no (car|vehicle|ride)|don'?t have a (car|ride)|need a ride|can'?t drive|no tengo (coche|carro|auto|transporte)|sin (coche|carro|auto)|sem carro)\b/i],
  ['wheelchair', /\b(wheel ?chair|silla de ruedas|cadeira de rodas)\b|轮椅/i],
  ['oxygen', /\b(oxygen|ox[ií]geno|oxig[eê]nio)\b|氧气/i],
  ['dementia', /\b(dementia|alzheimer'?s?|demencia)\b/i],
  ['vision_impaired', /\b(blind|low vision|can'?t see|ciego|cega)\b/i],
  ['hearing_impaired', /\b(deaf|hard of hearing|sordo|surdo)\b/i],
  ['medical_device', /\b(ventilator|dialysis|medical device|cpap)\b/i],
  ['young_children', /\b(baby|babies|infant|toddler|young (kids|children)|beb[eé]s?)\b/i],
  ['pets', /\b(dogs?|cats?|pets?|mascotas?|perros?)\b/i],
  ['limited_english', /\b(no english|little english|no hablo ingl[eé]s)\b/i],
];
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 };

export const OPENING_LINE: Record<string, string> = {
  en: "Hello, this is the Last Mile evacuation assistant calling about the fire near you. This is a simulation. If you are in immediate danger, hang up and call 911. How many people are with you, and do you have a way to leave?",
  es: 'Hola, le llama el asistente de evacuación de Last Mile por el incendio cerca de usted. Esto es una simulación. Si está en peligro inmediato, cuelgue y llame al 911. ¿Cuántas personas están con usted y tiene cómo salir?',
};
export const openingLine = (lang: string) => OPENING_LINE[lang.slice(0, 2)] ?? OPENING_LINE.en!;

export function mockTriage(req: TriageRequest): TriageResult {
  const text = [...req.history.filter((h) => h.role === 'resident').map((h) => h.text), req.utterance].join(' . ');
  const needs = PATTERNS.filter(([, re]) => re.test(text)).map(([n]) => n);
  const hasRide = needs.includes('no_vehicle')
    ? false
    : /\b(i have a (car|ride)|we have a (car|ride)|can drive|tengo (coche|carro|auto))\b/i.test(text)
      ? true
      : null;
  const canWalkToRoad = /\b(can'?t walk|cannot walk|unable to walk|bedridden|no puedo caminar)\b/i.test(text)
    ? false
    : /\b(can walk|able to walk|puedo caminar)\b/i.test(text)
      ? true
      : needs.includes('wheelchair')
        ? false
        : null;
  // Latest answer wins: scan resident turns newest-first.
  const segments = [req.utterance, ...req.history.filter((h) => h.role === 'resident').map((h) => h.text).reverse()].map((t) => t.toLowerCase());
  let residentsRaw: number | null = null;
  for (const seg of segments) {
    const digit = seg.match(/\b(\d{1,2})\s*(people|persons|of us|personas|adults|residents)\b/);
    const word = seg.match(/\b(one|two|three|four|five|six|uno|una|dos|tres|cuatro|cinco)\s+(people|persons|of us|personas|adults)\b/);
    const alone = /\b(alone|by myself|just me|sol[oa])\b/.test(seg);
    residentsRaw = digit ? Number(digit[1]) : word ? NUMBER_WORDS[word[1]!]! : alone ? 1 : null;
    if (residentsRaw !== null) break;
  }
  const residents = residentsRaw === null ? null : Math.min(12, Math.max(1, residentsRaw));
  const danger = /\b(trapped|fire is here|flames|smoke inside|can'?t breathe|atrapad[oa])\b/i.test(text);
  const urgency = danger ? 5 : needs.some((n) => n === 'oxygen' || n === 'medical_device') ? 4 : needs.length ? 3 : 2;
  const done = hasRide !== null && (needs.length > 0 || hasRide === true) && residents !== null;
  const es = req.language.startsWith('es');
  const n911 = es ? 'Si está en peligro inmediato, llame al 911.' : 'If you are in immediate danger, call 911.';
  let reply: string;
  if (danger) reply = es ? 'Llame al 911 ahora.' : 'Please call 911 now.';
  else if (hasRide === null) reply = es ? '¿Tiene un auto o alguien que pueda llevarle?' : 'Do you have a car or someone who can drive you?';
  else if (residents === null) reply = es ? '¿Cuántas personas están con usted?' : 'How many people are with you?';
  else if (!done) reply = es ? '¿Alguien usa silla de ruedas, oxígeno u otro equipo médico?' : 'Does anyone use a wheelchair, oxygen, or other medical equipment?';
  else reply = es ? 'Gracias. He anotado sus necesidades para el equipo de evacuación. No puedo prometer una hora de llegada.' : 'Thank you. I have passed your needs to the evacuation team. I cannot promise an arrival time.';
  return TriageResult.parse({
    householdId: req.householdId,
    needs,
    hasRide,
    canWalkToRoad,
    residents,
    urgency,
    reply: `${reply} ${n911}`,
    summary: `Mock responder: ${needs.length ? needs.join(', ') : 'no specific needs'}; ride ${hasRide === null ? 'unknown' : hasRide ? 'yes' : 'no'}; ${residents ?? '?'} resident(s).`,
    done,
  });
}
