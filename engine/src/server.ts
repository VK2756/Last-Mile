// OWNER: Lane A. HTTP + SSE surface (see ENGINE_ROUTES in @lastmile/contracts).
import type { ServerResponse } from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { ScenarioConfig, TriageResult, type DataSink } from '@lastmile/contracts';
import { Registry, type RunnerFactory } from './sim/registry';
import { createSim } from './sim/engine';
import { loadSink } from './sim/sink';
import { PRESETS } from './sim/presets';
import { registerMonteCarlo } from './montecarlo';

const Control = z.object({ action: z.enum(['pause', 'resume', 'speed']), value: z.number().optional() });
const Id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export interface ServerOpts { factory?: RunnerFactory; corsOrigin?: string; ttlMs?: number; sink?: DataSink; ratePerMin?: number }

/** `*` or a comma-separated allow-list. Returns the value for Access-Control-Allow-Origin for a request origin, or null. */
export function allowedOrigin(config: string, reqOrigin: string | undefined): string | null {
  const list = config.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes('*')) return '*';
  return reqOrigin && list.includes(reqOrigin) ? reqOrigin : null;
}

export async function buildServer(opts: ServerOpts = {}): Promise<FastifyInstance & { registry: Registry }> {
  const app = Fastify({
    bodyLimit: 64 * 1024,
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization', 'req.headers.cookie'] },
  });
  const corsConfig = opts.corsOrigin ?? process.env.ENGINE_CORS_ORIGIN ?? '*';
  await app.register(cors, { origin: (o, cb) => cb(null, allowedOrigin(corsConfig, o ?? undefined) !== null) });
  const sink = opts.sink ?? (await loadSink());
  const registry = new Registry(opts.factory ?? ((id, config) => createSim(config, id, { sink })), opts.ttlMs);
  app.decorate('registry', registry);
  const streams = new Set<ServerResponse>();
  app.addHook('onClose', async () => { registry.close(); for (const r of streams) { try { r.end(); } catch { /* already closed */ } } streams.clear(); });

  // tiny fixed-window rate limit on POST /scenarios (per client IP)
  const limit = opts.ratePerMin ?? Number(process.env.ENGINE_RATE_LIMIT_PER_MIN ?? 60);
  const hits = new Map<string, { n: number; reset: number }>();
  const rateLimited = (ip: string) => {
    const now = Date.now(); const h = hits.get(ip);
    if (!h || now > h.reset) { hits.set(ip, { n: 1, reset: now + 60_000 }); if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k); return false; }
    return ++h.n > limit;
  };

  app.get('/health', async () => ({ ok: true, service: 'lastmile-engine', scenarios: registry.size, uptimeS: Math.round(process.uptime()) }));
  app.get('/presets', async () => PRESETS);

  app.post('/scenarios', async (req, reply) => {
    if (rateLimited(req.ip)) return reply.code(429).header('Retry-After', '60').send({ error: 'too many scenarios; slow down' });
    const parsed = ScenarioConfig.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid ScenarioConfig', issues: parsed.error.issues });
    try {
      const s = registry.create(parsed.data);
      req.log.info({ scenarioId: s.id, policy: parsed.data.policy, seed: parsed.data.seed }, 'scenario created');
      return { scenarioId: s.id };
    } catch (e) {
      if (e instanceof Error && e.message === Registry.FULL) return reply.code(503).header('Retry-After', '30').send({ error: 'engine is at capacity' });
      throw e;
    }
  });

  app.get<{ Params: { id: string } }>('/scenarios/:id/stream', (req, reply) => {
    const s = Id.safeParse(req.params.id).success ? registry.get(req.params.id) : undefined;
    if (!s) return reply.code(404).send({ error: 'unknown scenario' });
    reply.hijack();
    const res = reply.raw; streams.add(res);
    const allow = allowedOrigin(corsConfig, req.headers.origin);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
      ...(allow ? { 'Access-Control-Allow-Origin': allow, Vary: 'Origin' } : {}),
    });
    req.log.info({ scenarioId: s.id }, 'stream opened');
    const hb = setInterval(() => { if (!res.writableEnded) res.write(': hb\n\n'); }, 15_000);
    let unsub = () => {};
    const cleanup = () => { clearInterval(hb); unsub(); streams.delete(res); };
    unsub = s.subscribe((ev) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
      if (ev.type === 'end') { cleanup(); res.end(); req.log.info({ scenarioId: s.id }, 'stream ended'); }
    });
    req.raw.on('close', () => { cleanup(); });
  });

  app.post<{ Params: { id: string } }>('/scenarios/:id/control', async (req, reply) => {
    const s = Id.safeParse(req.params.id).success ? registry.get(req.params.id) : undefined;
    if (!s) return reply.code(404).send({ error: 'unknown scenario' });
    const c = Control.safeParse(req.body);
    if (!c.success) return reply.code(400).send({ error: 'invalid control', issues: c.error.issues });
    if (c.data.action === 'speed' && c.data.value === undefined) return reply.code(400).send({ error: 'speed needs value' });
    s.control(c.data.action, c.data.value);
    return { ok: true, paused: s.paused, speed: s.speed };
  });

  app.post<{ Params: { id: string; hid: string } }>('/scenarios/:id/households/:hid/needs', async (req, reply) => {
    const s = Id.safeParse(req.params.id).success ? registry.get(req.params.id) : undefined;
    if (!s) return reply.code(404).send({ error: 'unknown scenario' });
    const parsed = TriageResult.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid TriageResult', issues: parsed.error.issues });
    if (parsed.data.householdId !== req.params.hid) return reply.code(400).send({ error: 'householdId does not match URL' });
    if (!s.runner.applyTriage) return reply.code(501).send({ error: 'runner does not support triage' });
    s.lastTouched = Date.now();
    const out = s.runner.applyTriage(parsed.data);
    if (!out.ok) return reply.code(out.code === 'unknown_household' ? 404 : 409).send(out);
    return out;
  });

  const mcWorkers = process.env.ENGINE_MC_WORKERS ? Number(process.env.ENGINE_MC_WORKERS) : undefined;
  registerMonteCarlo(app, { warmPreset: process.env.NODE_ENV !== 'test', ...(mcWorkers !== undefined ? { workers: mcWorkers } : {}) });

  return app as unknown as FastifyInstance & { registry: Registry };
}

process.on('unhandledRejection', (e) => console.error(JSON.stringify({ level: 'error', msg: 'unhandledRejection', err: String(e) })));

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? process.env.ENGINE_PORT ?? 8080);
  buildServer().then(async (app) => {
    const stop = (sig: string) => { app.log.info({ sig }, 'shutting down'); app.close().then(() => process.exit(0), () => process.exit(1)); setTimeout(() => process.exit(0), 5000).unref(); };
    process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));
    await app.listen({ port, host: '0.0.0.0' });
  }).catch((e) => { console.error(e); process.exit(1); });
}
