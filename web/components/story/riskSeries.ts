// Data for /dashboard (Lane E). Real source: GET /api/risk-series?scenarioId= (Lane C, Tiger Data `risk_samples`).
// Fallback: a labelled SAMPLE series computed in the browser from Lane B's deterministic mock (never hard-coded).
import type { HouseholdStatus, ScenarioConfig } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { createMockRunner } from '@/lib/mock';

export type Group = 'waiting' | 'self' | 'needs' | 'helper';
export const GROUPS: Array<{ key: Group; label: string; color: string; statuses: HouseholdStatus[] }> = [
  { key: 'waiting', label: 'Not acting yet (unaware / warned)', color: '#5e6b79', statuses: ['unaware', 'warned'] },
  { key: 'self', label: 'Leaving on their own', color: '#38bdf8', statuses: ['self_evacuating'] },
  { key: 'needs', label: 'Needs help', color: '#ff3b47', statuses: ['needs_help'] },
  { key: 'helper', label: 'Helper assigned / en route', color: '#2ee6c5', statuses: ['assigned', 'enroute'] },
];
const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => g.statuses.map((s) => [s, g.key]))) as Record<string, Group>;

export interface SeriesRow { t: number; waiting: number; self: number; needs: number; helper: number; minTtiMin: number | null }
export interface DispatchRow { minute: number; dispatches: number }
export interface Series { rows: SeriesRow[]; dispatches: DispatchRow[] | null; source: string }

type ApiPoint = { t: number; status: string; households: number; minTtiSeconds: number | null };
type ApiDispatch = { minute?: number; t?: number; dispatches?: number; count?: number };

function pivot(points: ApiPoint[]): SeriesRow[] {
  const byT = new Map<number, SeriesRow>();
  for (const p of points) {
    const row = byT.get(p.t) ?? { t: p.t, waiting: 0, self: 0, needs: 0, helper: 0, minTtiMin: null };
    const g = GROUP_OF[p.status];
    if (g) row[g] += p.households;
    if (g && p.minTtiSeconds != null) row.minTtiMin = Math.min(row.minTtiMin ?? Infinity, p.minTtiSeconds / 60);
    byT.set(p.t, row);
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

export type FetchResult = { kind: 'ok'; series: Series } | { kind: 'empty'; reason: string } | { kind: 'error'; reason: string };

export async function fetchRiskSeries(scenarioId: string, signal?: AbortSignal): Promise<FetchResult> {
  try {
    const res = await fetch(`/api/risk-series?scenarioId=${encodeURIComponent(scenarioId)}`, { signal });
    if (!res.ok) return { kind: 'error', reason: `/api/risk-series -> HTTP ${res.status}` };
    const body = (await res.json()) as { points?: ApiPoint[]; dispatches?: ApiDispatch[]; source?: string };
    const points = Array.isArray(body.points) ? body.points : [];
    if (!points.length) return { kind: 'empty', reason: body.source === 'not configured' ? 'Tiger Data is not configured on this deployment.' : `No risk samples recorded for scenario "${scenarioId}".` };
    const dispatches = Array.isArray(body.dispatches)
      ? body.dispatches.map((d) => ({ minute: Number(d.minute ?? (d.t ?? 0) / 60), dispatches: Number(d.dispatches ?? d.count ?? 0) }))
      : null;
    return { kind: 'ok', series: { rows: pivot(points), dispatches, source: body.source ?? 'Tiger Data' } };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { kind: 'error', reason: e instanceof Error ? e.message : 'request failed' };
  }
}

/** Sample series: the mock runner (Last Mile policy), sampled every 30 sim s like the engine's risk sink. */
export function sampleSeries(seed = 1): Series {
  const config: ScenarioConfig = { ...sampleInit.config, seed, helperCount: 24, policy: 'last_mile' };
  const runner = createMockRunner(`sample-dashboard-${seed}`, config);
  const rows: SeriesRow[] = [];
  const seen = new Set<string>();
  const perMinute = new Map<number, number>();
  let guard = 0;
  while (!runner.done && guard++ < 1000) {
    const f = runner.step(30);
    const row: SeriesRow = { t: f.t, waiting: 0, self: 0, needs: 0, helper: 0, minTtiMin: null };
    for (const h of f.households) {
      if (h.ttiSeconds === null) continue; // only households currently threatened, like the engine sink
      const g = GROUP_OF[h.status];
      if (!g) continue;
      row[g]++;
      row.minTtiMin = Math.min(row.minTtiMin ?? Infinity, h.ttiSeconds / 60);
    }
    rows.push(row);
    for (const a of f.assignments) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const m = Math.floor(f.t / 60);
      perMinute.set(m, (perMinute.get(m) ?? 0) + 1);
    }
  }
  const last = Math.floor((rows.at(-1)?.t ?? 0) / 60);
  const dispatches = Array.from({ length: last + 1 }, (_, m) => ({ minute: m, dispatches: perMinute.get(m) ?? 0 }));
  return { rows, dispatches, source: 'browser mock (sample)' };
}
