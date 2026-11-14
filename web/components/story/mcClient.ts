// Monte Carlo HTTP client for /results (Lane E). Routes are mounted by Lane A from Lane D's
// engine/src/montecarlo (GET /montecarlo/preset, POST /montecarlo).
import { MonteCarloComparison, ScenarioConfig, StreamEvent } from '@lastmile/contracts';
import { createScenario, engineUrl, sendControl } from '@/lib/engine';

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

/** A response is a placeholder if it carries a `warning` field or a placeholder/stub assumption. */
function isPlaceholder(raw: unknown, data: MonteCarloComparison): boolean {
  const warning = typeof raw === 'object' && raw !== null && 'warning' in raw && Boolean((raw as { warning?: unknown }).warning);
  return warning || data.assumptions.some((a) => /\b(placeholder|stub|fake|not real)\b/i.test(a));
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
 * The model assumptions (population, fire, routing, baseline behaviour, Last Mile help requests) live in SimInit, not in the
 * Monte Carlo response yet. Read them once from a scenario's `init` event for the same base config; cached per session.
 * Returns [] on any failure: the page then shows only what the Monte Carlo response says.
 */
export async function fetchModelAssumptions(base: MonteCarloComparison['base'], timeoutMs = 8000): Promise<string[]> {
  const url = engineUrl();
  if (!url || typeof EventSource === 'undefined') return [];
  const key = `lm-model-assumptions:${JSON.stringify(base)}`;
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return JSON.parse(hit) as string[];
  } catch {
    /* storage unavailable */
  }
  try {
    const id = await createScenario(ScenarioConfig.parse({ ...base, seed: 1, policy: 'last_mile' }));
    const list = await new Promise<string[]>((resolve) => {
      const es = new EventSource(`${url}/scenarios/${encodeURIComponent(id)}/stream`);
      const done = (v: string[]) => {
        es.close();
        clearTimeout(timer);
        resolve(v);
      };
      const timer = setTimeout(() => done([]), timeoutMs);
      es.onmessage = (ev) => {
        try {
          const parsed = StreamEvent.safeParse(JSON.parse(ev.data as string));
          if (parsed.success && parsed.data.type === 'init') done(parsed.data.init.assumptions);
        } catch {
          /* ignore malformed lines */
        }
      };
      es.onerror = () => done([]);
    });
    // stop the throwaway scenario; ignore failures
    void sendControl(id, 'pause').catch(() => undefined);
    try {
      if (list.length) sessionStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* storage unavailable */
    }
    return list;
  } catch {
    return [];
  }
}

/** Fresh seeds that the preset never used, so a full run is an independent replication. */
export const FRESH_SEEDS = Array.from({ length: 200 }, (_, i) => 1001 + i);
