// OWNER: Lane A. HTTP + SSE surface (see ENGINE_ROUTES in @lastmile/contracts).
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { ScenarioConfig } from '@lastmile/contracts';
import { Registry, type RunnerFactory } from './sim/registry';
import { createSyntheticRunner } from './sim/synthetic';

const Control = z.object({ action: z.enum(['pause', 'resume', 'speed']), value: z.number().optional() });

export interface ServerOpts { factory?: RunnerFactory; corsOrigin?: string; ttlMs?: number }

export async function buildServer(opts: ServerOpts = {}): Promise<FastifyInstance & { registry: Registry }> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const origin = opts.corsOrigin ?? process.env.ENGINE_CORS_ORIGIN ?? '*';
  await app.register(cors, { origin: origin === '*' ? true : origin.split(',').map((s) => s.trim()) });
  const registry = new Registry(opts.factory ?? createSyntheticRunner, opts.ttlMs);
  app.decorate('registry', registry);
  app.addHook('onClose', async () => registry.close());

  app.get('/health', async () => ({ ok: true, service: 'lastmile-engine', scenarios: registry.size, uptimeS: Math.round(process.uptime()) }));

  app.post('/scenarios', async (req, reply) => {
    const parsed = ScenarioConfig.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid ScenarioConfig', issues: parsed.error.issues });
    const s = registry.create(parsed.data);
    return { scenarioId: s.id };
  });

  app.get<{ Params: { id: string } }>('/scenarios/:id/stream', (req, reply) => {
    const s = registry.get(req.params.id);
    if (!s) return reply.code(404).send({ error: 'unknown scenario' });
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': typeof req.headers.origin === 'string' && (origin === '*' || origin.split(',').map((x) => x.trim()).includes(req.headers.origin)) ? req.headers.origin : origin === '*' ? '*' : origin.split(',')[0]!,
    });
    const hb = setInterval(() => { if (!res.writableEnded) res.write(': hb\n\n'); }, 15_000);
    let unsub = () => {};
    const close = () => { clearInterval(hb); unsub(); if (!res.writableEnded) res.end(); };
    unsub = s.subscribe((ev) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
      if (ev.type === 'end') close();
    });
    req.raw.on('close', () => { clearInterval(hb); unsub(); });
  });

  app.post<{ Params: { id: string } }>('/scenarios/:id/control', async (req, reply) => {
    const s = registry.get(req.params.id);
    if (!s) return reply.code(404).send({ error: 'unknown scenario' });
    const c = Control.safeParse(req.body);
    if (!c.success) return reply.code(400).send({ error: 'invalid control', issues: c.error.issues });
    if (c.data.action === 'speed' && c.data.value === undefined) return reply.code(400).send({ error: 'speed needs value' });
    s.control(c.data.action, c.data.value);
    return { ok: true, paused: s.paused, speed: s.speed };
  });

  return app as unknown as FastifyInstance & { registry: Registry };
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? process.env.ENGINE_PORT ?? 8080);
  buildServer().then((app) => app.listen({ port, host: '0.0.0.0' })).catch((e) => { console.error(e); process.exit(1); });
}
