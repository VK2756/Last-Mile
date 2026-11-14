'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Database, Cpu } from 'lucide-react';
import { AppShell, Button, SimBadge } from '@/components/ui';
import { formatSimClock } from '@/lib/format';
import { cn } from '@/lib/cn';
import { SampleRibbon } from './SampleRibbon';
import { GROUPS, fetchRiskSeries, sampleSeries, type Series } from './riskSeries';

const AXIS = { fill: '#5e6b79', fontSize: 11, fontFamily: 'var(--font-mono)' } as const;
const GRID = '#1f2935';
const mins = (t: number) => `${Math.round(t / 60)}m`;

type View = { series: Series; sample: boolean; note?: string } | null;

export function DashboardView() {
  const [scenario, setScenario] = useState('');
  const [draft, setDraft] = useState('');
  const [view, setView] = useState<View>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    setLoading(true);
    if (!id) {
      setView({ series: sampleSeries(1), sample: true, note: 'No scenario ID given.' });
      setLoading(false);
      return;
    }
    const r = await fetchRiskSeries(id, signal);
    if (signal?.aborted) return;
    if (r.kind === 'ok') setView({ series: r.series, sample: false });
    else setView({ series: sampleSeries(1), sample: true, note: r.reason });
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('scenario') ?? '';
    setScenario(id);
    setDraft(id);
    const ctrl = new AbortController();
    void load(id, ctrl.signal).catch(() => undefined);
    return () => ctrl.abort();
  }, [load]);

  const apply = (id: string) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('scenario', id);
    else url.searchParams.delete('scenario');
    window.history.replaceState(null, '', url);
    setScenario(id);
    void load(id);
  };

  const sample = view?.sample ?? false;
  const rows = view?.series.rows ?? [];
  const dispatches = view?.series.dispatches ?? null;

  return (
    <AppShell right={<SimBadge mock={sample} />}>
      {sample && (
        <SampleRibbon testId="dashboard-sample-ribbon">
          {view?.note ? `${view.note} ` : ''}Showing a sample series from the in-browser mock, not recorded engine data.
        </SampleRibbon>
      )}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fire">Operations dashboard</p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">One scenario, over time.</h1>
            <p className="mt-3 text-fg-muted">
              What the dispatcher sees as the fire grows: who is still at risk and in what state, how close the fire is to the most
              threatened home, and how many helpers are sent each minute. Recorded every 30 simulated seconds in Tiger Data.
            </p>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply(draft.trim());
            }}
          >
            <label className="grid gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">Scenario ID</span>
              <input
                aria-label="Scenario ID"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="from /live"
                className="h-10 w-48 rounded-md border border-line-strong bg-surface px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
            <Button type="submit" variant="secondary">Load</Button>
          </form>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3 text-xs">
          <span
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-md border px-3 font-mono font-semibold uppercase tracking-[0.12em]',
              sample ? 'border-warn/45 bg-warn/10 text-warn' : 'border-ok/40 bg-ok/10 text-ok',
            )}
          >
            {sample ? <Cpu aria-hidden className="size-3.5" /> : <Database aria-hidden className="size-3.5" />}
            {loading ? 'Loading…' : view?.series.source}
          </span>
          {scenario && <span className="font-mono text-fg-dim">scenario {scenario}</span>}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            className="lg:col-span-2"
            title="Households still at risk, by status"
            sub="Unresolved households the fire is projected to reach, stacked"
            testId="dashboard-status"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="t" tickFormatter={mins} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={32} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip content={<StatusTip />} cursor={{ stroke: '#2d3a4a' }} />
                {GROUPS.map((g) => (
                  <Area key={g.key} type="monotone" dataKey={g.key} name={g.label} stackId="1" stroke={g.color} fill={g.color} fillOpacity={0.35} isAnimationActive={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
              {GROUPS.map((g) => (
                <li key={g.key} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm" style={{ background: g.color }} /> {g.label}
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard title="Closest the fire is to any waiting home" sub="Minimum time to impact, minutes" testId="dashboard-min-tti">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="t" tickFormatter={mins} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={32} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: '#121821', border: '1px solid #2d3a4a', borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(t) => formatSimClock(Number(t))}
                  formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)} min` : '—', 'Min time to impact']}
                />
                <Line type="monotone" dataKey="minTtiMin" stroke="#ff5a1f" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Dispatches per minute" sub="New helper assignments each simulated minute" testId="dashboard-dispatches">
            {dispatches ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dispatches} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="minute" tickFormatter={(m: number) => `${m}m`} tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#121821', border: '1px solid #2d3a4a', borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(m) => `Minute ${m}`}
                    formatter={(v) => [v, 'Dispatches']}
                    cursor={{ fill: 'rgb(255 255 255 / 0.03)' }}
                  />
                  <Bar dataKey="dispatches" fill="#2ee6c5" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center px-6 text-center text-sm text-fg-dim">
                The risk-series API does not return dispatch counts yet (Tiger&apos;s <code className="mx-1 font-mono">dispatch_1m</code> aggregate exists).
              </p>
            )}
          </ChartCard>
        </div>

        <p className="mt-8 text-sm text-fg-muted">
          Everything here is a simulation with synthetic people.{' '}
          <Link href="/results#assumptions" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            Assumptions <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, sub, children, className, testId }: { title: string; sub: string; children: React.ReactNode; className?: string; testId: string }) {
  return (
    <section data-testid={testId} className={cn('rounded-lg border border-line bg-surface p-4 sm:p-6', className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-fg-dim">{sub}</p>
      <div className="h-64">{children}</div>
    </section>
  );
}

function StatusTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono font-semibold">{formatSimClock(Number(label))}</div>
      {[...payload].reverse().map((p) => (
        <div key={p.name} className="flex justify-between gap-4 font-mono">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{p.value}</span>
        </div>
      ))}
    </div>
  );
}
