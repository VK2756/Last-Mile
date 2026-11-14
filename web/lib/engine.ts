// Thin HTTP client for the engine (routes: ENGINE_ROUTES in @lastmile/contracts).
import { MonteCarloComparison, type ScenarioConfig } from '@lastmile/contracts';

export type ControlAction = 'pause' | 'resume' | 'speed';

/** Engine base URL without trailing slash, or '' when not configured. */
export function engineUrl(): string {
  return (process.env.NEXT_PUBLIC_ENGINE_URL ?? '').replace(/\/+$/, '');
}

async function post(path: string, body: unknown, timeoutMs = 8000): Promise<unknown> {
  const base = engineUrl();
  if (!base) throw new Error('NEXT_PUBLIC_ENGINE_URL is not set');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function createScenario(config: ScenarioConfig): Promise<string> {
  const r = (await post('/scenarios', config)) as { scenarioId?: unknown };
  if (typeof r.scenarioId !== 'string') throw new Error('engine returned no scenarioId');
  return r.scenarioId;
}

export async function sendControl(scenarioId: string, action: ControlAction, value?: number): Promise<void> {
  await post(`/scenarios/${encodeURIComponent(scenarioId)}/control`, value === undefined ? { action } : { action, value });
}

export async function runMonteCarlo(base: Omit<ScenarioConfig, 'policy' | 'seed'>, runs: number): Promise<MonteCarloComparison> {
  return MonteCarloComparison.parse(await post('/montecarlo', { base, runs }, 120_000));
}

export async function engineHealthy(timeoutMs = 3000): Promise<boolean> {
  const base = engineUrl();
  if (!base) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
