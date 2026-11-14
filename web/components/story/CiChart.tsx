'use client';
import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonteCarloComparison } from '@lastmile/contracts';
import { formatPct } from '@/lib/format';

// Mirrors the Lane B theme tokens (SVG presentation attributes can't read CSS vars reliably).
export const POLICY_COLOR = { alerts_only: '#c9a227', last_mile: '#2ee6c5' } as const;
const AXIS = '#5e6b79';
const GRID = '#1f2935';

type Row = {
  metric: string;
  alerts: number;
  alertsErr: [number, number];
  alertsCi: [number, number];
  lastMile: number;
  lastMileErr: [number, number];
  lastMileCi: [number, number];
};

const err = (mean: number, ci: [number, number]): [number, number] => [Math.max(0, mean - ci[0]), Math.max(0, ci[1] - mean)];

function rows(c: MonteCarloComparison): Row[] {
  const a = c.results.alerts_only;
  const l = c.results.last_mile;
  return [
    {
      metric: 'All households',
      alerts: a.evacuatedRate.mean,
      alertsErr: err(a.evacuatedRate.mean, a.evacuatedRate.ci95),
      alertsCi: a.evacuatedRate.ci95,
      lastMile: l.evacuatedRate.mean,
      lastMileErr: err(l.evacuatedRate.mean, l.evacuatedRate.ci95),
      lastMileCi: l.evacuatedRate.ci95,
    },
    {
      metric: 'Vulnerable households',
      alerts: a.vulnerableEvacuatedRate.mean,
      alertsErr: err(a.vulnerableEvacuatedRate.mean, a.vulnerableEvacuatedRate.ci95),
      alertsCi: a.vulnerableEvacuatedRate.ci95,
      lastMile: l.vulnerableEvacuatedRate.mean,
      lastMileErr: err(l.vulnerableEvacuatedRate.mean, l.vulnerableEvacuatedRate.ci95),
      lastMileCi: l.vulnerableEvacuatedRate.ci95,
    },
  ];
}

function TooltipBody({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: Row }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0]!.payload;
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-fg">{label}</div>
      <div className="tabular font-mono text-[#c9a227]">
        Alerts only {formatPct(r.alerts)} <span className="text-fg-dim">[{formatPct(r.alertsCi[0])}, {formatPct(r.alertsCi[1])}]</span>
      </div>
      <div className="tabular font-mono text-accent">
        Last Mile {formatPct(r.lastMile)} <span className="text-fg-dim">[{formatPct(r.lastMileCi[0])}, {formatPct(r.lastMileCi[1])}]</span>
      </div>
    </div>
  );
}

/** Grouped bars, one pair per metric, with 95% CI whiskers. */
export function CiChart({ data }: { data: MonteCarloComparison }) {
  return (
    <div data-testid="results-chart" className="h-80 w-full" role="img" aria-label="Evacuated rate by policy with 95% confidence intervals">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows(data)} margin={{ top: 16, right: 8, bottom: 4, left: 0 }} barCategoryGap="28%" barGap={6}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="metric" tick={{ fill: '#93a1b0', fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fill: AXIS, fontSize: 11, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip cursor={{ fill: 'rgb(255 255 255 / 0.03)' }} content={<TooltipBody />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#93a1b0' }} iconType="square" />
          <Bar dataKey="alerts" name="Alerts only" fill={POLICY_COLOR.alerts_only} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            <ErrorBar dataKey="alertsErr" width={10} strokeWidth={2} stroke="#e8edf3" direction="y" />
          </Bar>
          <Bar dataKey="lastMile" name="Last Mile" fill={POLICY_COLOR.last_mile} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            <ErrorBar dataKey="lastMileErr" width={10} strokeWidth={2} stroke="#e8edf3" direction="y" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
