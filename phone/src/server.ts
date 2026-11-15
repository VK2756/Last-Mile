import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, type Model } from '@google/genai';
import { chooseLiveModel, triage } from '@lastmile/ai';
import { recordPhoneCallTranscript } from '@lastmile/data';
import type { TriageResult } from '@lastmile/contracts';
import { bridgeCall, type Turn } from './bridge';
import { allowedNumbers, CallGuard, isE164, maskPhone, secretMatches } from './security';
import { awaitStreamStart } from './stream';

type CallBody = { to: string; scenarioId?: string; householdId?: string; language?: string };
type CallRecord = CallBody & { token: string; model: string; sid?: string; timer?: NodeJS.Timeout; done: boolean };
const calls = new Map<string, CallRecord>();
const config = {
  secret: process.env.PHONE_SHARED_SECRET ?? '',
  account: process.env.TWILIO_ACCOUNT_SID ?? '',
  auth: process.env.TWILIO_AUTH_TOKEN ?? '',
  from: process.env.TWILIO_FROM_NUMBER ?? '',
  publicUrl: process.env.PUBLIC_PHONE_URL ?? '',
  key: process.env.GEMINI_API_KEY ?? '',
  engine: process.env.ENGINE_URL ?? '',
};
const guard = new CallGuard(config.secret, allowedNumbers(process.env.DEMO_PHONE_NUMBERS ?? ''));

function respond(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
function validId(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 128; }
function publicStreamUrl(): string | null {
  try { const url = new URL(config.publicUrl); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' ? 'wss://' + url.host + '/media' : null; }
  catch { return null; }
}
export function streamTwiml(url: string, token: string): string {
  // URL and token contain only URL-safe characters; token is a signed base64url value.
  return '<Response><Connect><Stream url="' + url + '"><Parameter name="token" value="' + token + '"/></Stream></Connect></Response>';
}
export async function placeTwilioCall(to: string, twiml: string, fetcher: typeof fetch = fetch): Promise<{ sid: string; status: string }> {
  const form = new URLSearchParams({ To: to, From: config.from, Twiml: twiml, TimeLimit: '300' });
  const response = await fetcher('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(config.account) + '/Calls.json', {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(config.account + ':' + config.auth).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
  });
  if (!response.ok) throw new Error('Twilio rejected the call (HTTP ' + response.status + ')');
  const data = await response.json() as { sid?: unknown; status?: unknown };
  if (typeof data.sid !== 'string' || !/^CA[0-9a-f]{32}$/i.test(data.sid)) throw new Error('Twilio returned no call SID');
  return { sid: data.sid, status: typeof data.status === 'string' ? data.status : 'queued' };
}
async function endTwilioCall(sid: string): Promise<void> {
  try {
    await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(config.account) + '/Calls/' + encodeURIComponent(sid) + '.json', {
      method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(config.account + ':' + config.auth).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ Status: 'completed' }),
    });
  } catch { console.error('[phone] Could not end call at Twilio'); }
}
let modelCache: { name: string; until: number } | null = null;
async function liveModel(): Promise<string> {
  if (modelCache && modelCache.until > Date.now()) return modelCache.name;
  const ai = new GoogleGenAI({ apiKey: config.key });
  const models: Model[] = [];
  for await (const model of await ai.models.list({ config: { pageSize: 100 } })) models.push(model);
  const name = chooseLiveModel(models, process.env.GEMINI_LIVE_MODEL);
  if (!name) throw new Error('No Live audio model available');
  modelCache = { name, until: Date.now() + 300_000 };
  return name;
}
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); if (body.length > 8192) { reject(new Error('Request too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
async function extract(record: CallRecord, text: string, history: Turn[]): Promise<void> {
  const result: TriageResult = await triage({ householdId: record.householdId ?? 'phone-demo', language: record.language ?? 'en', utterance: text, history });
  if (!record.scenarioId || !record.householdId || !config.engine) return;
  try {
    const response = await fetch(config.engine.replace(/\/$/, '') + '/scenarios/' + encodeURIComponent(record.scenarioId) + '/households/' + encodeURIComponent(record.householdId) + '/needs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error('[phone] Engine needs update failed (HTTP ' + response.status + ')');
  } catch { console.error('[phone] Engine needs update unavailable'); }
}
function finish(record: CallRecord, history: Turn[]): void {
  if (record.done) return;
  record.done = true;
  if (record.timer) clearTimeout(record.timer);
  guard.release(record.to);
  calls.delete(record.token);
  if (history.length) void recordPhoneCallTranscript({ scenarioId: record.scenarioId, householdId: record.householdId,
    callSid: record.sid, maskedPhone: maskPhone(record.to), transcript: history }).catch(() => console.error('[phone] Transcript sink unavailable'));
  console.log('[phone] call finished ' + maskPhone(record.to));
}

export function createPhoneServer() {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'GET' && pathname === '/health') return respond(res, 200, { ok: true, service: 'lastmile-phone' });
    if (req.method !== 'POST' || pathname !== '/call') return respond(res, 404, { error: 'Not found' });
    if (!secretMatches(typeof req.headers['x-phone-secret'] === 'string' ? req.headers['x-phone-secret'] : undefined, config.secret)) return respond(res, 401, { error: 'Unauthorized' });
    let body: unknown;
    try { body = await readBody(req); } catch { return respond(res, 400, { error: 'Invalid request' }); }
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const to = value.to;
    if (typeof to !== 'string' || !isE164(to)) return respond(res, 403, { error: 'Number is not registered for this demo' });
    const state = guard.reserve(to);
    if (state !== 'allowed') return respond(res, state === 'forbidden' ? 403 : 429, { error: state === 'forbidden' ? 'Number is not registered for this demo' : 'Call limit reached or call already active' });
    if (value.scenarioId !== undefined && !validId(value.scenarioId) || value.householdId !== undefined && !validId(value.householdId) || value.language !== undefined && value.language !== 'en' && value.language !== 'es') {
      guard.failed(to); return respond(res, 400, { error: 'Invalid call details' });
    }
    const streamUrl = publicStreamUrl();
    if (!config.account || !config.auth || !isE164(config.from) || !config.key || !streamUrl || !config.secret) {
      guard.failed(to); return respond(res, 503, { error: 'Phone demo is not configured' });
    }
    try {
      const model = await liveModel();
      const token = guard.issue(to);
      const record: CallRecord = { to, scenarioId: value.scenarioId as string | undefined, householdId: value.householdId as string | undefined,
        language: value.language as string | undefined, token, model, done: false };
      calls.set(token, record);
      try {
        const { sid, status } = await placeTwilioCall(to, streamTwiml(streamUrl, token));
        record.sid = sid; guard.bind(token, sid);
        record.timer = setTimeout(() => { void endTwilioCall(sid); finish(record, []); }, 300_000);
        record.timer.unref();
        console.log('[phone] call queued ' + maskPhone(to));
        return respond(res, 202, { sid, status });
      } catch (error) { calls.delete(token); throw error; }
    } catch {
      guard.failed(to); return respond(res, 502, { error: 'Could not start demo call' });
    }
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/media') { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (twilio) => {
      awaitStreamStart(twilio, ({ token, callSid }) => {
        const record = calls.get(token);
        return Boolean(record && !record.done && guard.consume(token, callSid) === record.to);
      }, ({ token, callSid, streamSid }) => {
        const record = calls.get(token);
        if (!record) { twilio.close(1008); return; }
        const gemini = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(config.key));
        bridgeCall(twilio, gemini, { streamSid, model: record.model, language: record.language ?? 'en',
          onResidentTurn: (text, history) => extract(record, text, history),
          onFinish: (history) => { finish(record, history); return Promise.resolve(); },
          onStopRequested: () => endTwilioCall(callSid),
        });
      });
    });
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PHONE_PORT ?? 8443);
  createPhoneServer().listen(port, '127.0.0.1', () => console.log('[phone] listening on 127.0.0.1:' + port));
}
