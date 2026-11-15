// Monte Carlo HTTP client for /results (Lane E). Routes are mounted by Lane A from Lane D's
// engine/src/montecarlo (GET /montecarlo/preset, POST /montecarlo).
import { MonteCarloComparison } from '@lastmile/contracts';
import { engineUrl } from '@/lib/engine';

export class EngineBusyError extends Error {
  constructor() {
    super('The engine is already running another Monte Carlo batch. Try again in about 30 seconds.');
  }
}

export interface McResponse {
  data: MonteCarloComparison;
  /** true when the engine itself says the numbers are placeholders (then the UI shows the SAMPLE ribbon) */
  placeholder: boolean;
  cached: boolean;
  ms: number | null;
}

/** A response is a placeholder if it carries a `warning` field, a WARNING line, or a placeholder/stub assumption. */
function isPlaceholder(raw: unknown, data: MonteCarloComparison): boolean {
  const warning = typeof raw === 'object' && raw !== null && 'warning' in raw && Boolean((raw as { warning?: unknown }).warning);
  // the engine's own marker is a "WARNING: ... placeholder" line; model lines like "not real people" must not match
  return warning || data.assumptions.some((a) => /^WARNING\b/.test(a) || /\b(placeholder|stub)\b/i.test(a));
}

async function call(path: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<McResponse> {
  const base = engineUrl();
  if (!base) throw new Error('NEXT_PUBLIC_ENGINE_URL is not set');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timed out after ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(`${base}${path}`, { ...init, signal: ctrl.signal });
    if (res.status === 429) throw new EngineBusyError();
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    const raw: unknown = await res.json();
    const data = MonteCarloComparison.parse(raw);
    const ms = Number(res.headers.get('x-montecarlo-ms'));
    return { data, placeholder: isPlaceholder(raw, data), cached: res.headers.get('x-montecarlo-cache') === 'hit', ms: Number.isFinite(ms) && ms > 0 ? ms : null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** The cached 200-seed preset (seeds 1..200). Instant when warm; waits for the boot-time warm-up otherwise. */
export const fetchPreset = (signal?: AbortSignal) => call('/montecarlo/preset', { method: 'GET' }, 120_000, signal);

/** A full paired run on an explicit seed block, using the engine's preset scenario (body without `base`). */
export const runSeeds = (seeds: number[], signal?: AbortSignal) =>
  call('/montecarlo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seeds }) }, 240_000, signal);

/**
 * A paired run with an explicit base config (e.g. a baseline knob override). The engine caches by base + seeds, so a
 * repeated click is instant. Since #92 the response's assumptions include the simulator's own model assumptions.
 */
export const runConfig = (base: MonteCarloComparison['base'], seeds: number[], signal?: AbortSignal) =>
  call('/montecarlo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base, seeds }) }, 240_000, signal);

/** Fresh seeds that the preset never used, so a full run is an independent replication. */
export const FRESH_SEEDS = Array.from({ length: 200 }, (_, i) => 1001 + i);
