'use client';
import { useCallback, useRef, useState } from 'react';
import { Play, Scale } from 'lucide-react';
import type { BaselineKnobs, MonteCarloComparison } from '@lastmile/contracts';
import { Button, Spinner } from '@/components/ui';
import { formatPct, formatPts } from '@/lib/format';
import { cn } from '@/lib/cn';
import { POLICY_COLOR } from './CiChart';
import { EngineBusyError, runConfig } from './mcClient';
import { excludesZero } from './stats';

/** Same seeds as Lane D's BASELINE_REVIEW.md, so every row can be checked against that table. */
const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

/** Knob overrides only; the values are the round numbers Lane D fixed before running the review. No outcomes here. */
const OPTIONS: { id: string; label: string; detail: string; knobs: BaselineKnobs }[] = [
  { id: 'default', label: 'Default baseline', detail: 'Neighbours never give rides; 25% of homes without a car get a family pickup.', knobs: {} },
  { id: 'rides30', label: 'Neighbours give rides 30%', detail: '30% of departing households with a car and a free seat pick up the nearest neighbour without one (about 300 m, no wheelchair).', knobs: { neighborRideProb: 0.3 } },
  { id: 'rides60', label: 'Neighbours give rides 60%', detail: 'Same, at 60%.', knobs: { neighborRideProb: 0.6 } },
  { id: 'family50', label: 'Family pickup 50%', detail: 'Half of homes without a car have a relative or friend coming, instead of a quarter.', knobs: { familyPickupProb: 0.5 } },
  {
    id: 'strong',
    label: 'Strong baseline (all together)',
    detail: 'Rides 60%, family pickup 50% and hurrying when the fire is near, cars leave twice as fast, alert at ignition.',
    knobs: { neighborRideProb: 0.6, familyPickupProb: 0.5, urgentFamilyPickup: true, prepDelayScale: 0.5, alertIssueS: 0 },
  },
];

type Row = { state: 'running' } | { state: 'done'; data: MonteCarloComparison; ms: number | null; cached: boolean } | { state: 'error'; message: string };

/** "How much does the baseline matter?": each button POSTs /montecarlo with one knob override and shows what the engine returns. */
export function BaselinePanel({ base }: { base: MonteCarloComparison['base'] }) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(
    async (id: string, knobs: BaselineKnobs) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setRunning(id);
      setRows((r) => ({ ...r, [id]: { state: 'running' } }));
      try {
        const res = await runConfig({ ...base, baseline: { ...base.baseline, ...knobs } }, SEEDS, ctrl.signal);
        if (res.placeholder) throw new Error('the engine marked this run as a placeholder, so it is not shown');
        setRows((r) => ({ ...r, [id]: { state: 'done', data: res.data, ms: res.ms, cached: res.cached } }));
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const message = e instanceof EngineBusyError ? 'The engine is busy with another batch. Try again in about 30 seconds.' : e instanceof Error ? e.message : 'request failed';
        setRows((r) => ({ ...r, [id]: { state: 'error', message } }));
      } finally {
        if (!ctrl.signal.aborted) setRunning(null);
      }
    },
    [base],
  );

  return (
    <section id="baseline" data-testid="results-baseline" aria-labelledby="baseline-h" className="scroll-mt-20 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <h2 id="baseline-h" className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Scale aria-hidden className="size-4 text-accent" /> How much does the baseline matter?
      </h2>
      <p className="max-w-3xl text-sm text-fg-muted">
        The headline above assumes neighbours never give each other rides. A real town has some informal help, and we don&apos;t know how much. Pick a stronger
        alerts-only baseline and the engine reruns both policies on it ({SEEDS.length} paired seeds, {SEEDS[0]}–{SEEDS.at(-1)}, the same seeds as Lane D&apos;s baseline
        review). Every knob applies to both policies; Last Mile only adds dispatched helpers on top.
      </p>
      <ul className="mt-4 grid gap-3">
        {OPTIONS.map((o) => {
          const row = rows[o.id];
          return (
            <li key={o.id} className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-center">
              <div>
                <Button
                  variant={row?.state === 'done' ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => void run(o.id, o.knobs)}
                  disabled={running !== null}
                  data-testid={`baseline-${o.id}`}
                  aria-describedby={`baseline-${o.id}-d`}
                >
                  {running === o.id ? <Spinner className="size-3.5" /> : <Play aria-hidden className="size-3.5" />} {o.label}
                </Button>
                <p id={`baseline-${o.id}-d`} className="mt-2 text-xs text-fg-muted">{o.detail}</p>
              </div>
              <div aria-live="polite" className="min-w-0">
                {!row && <p className="text-xs text-fg-muted">Not run yet.</p>}
                {row?.state === 'running' && <p className="text-xs text-fg-muted">Running {SEEDS.length * 2} simulations on the engine…</p>}
                {row?.state === 'error' && <p className="text-xs text-warn">{row.message}</p>}
                {row?.state === 'done' && <Result data={row.data} ms={row.ms} cached={row.cached} />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-fg-muted">
        Not modelled in any row: helpers who don&apos;t show up or break down, wrong or missing help requests, people refusing to leave, traffic beyond a flat
        congestion factor. Each would lower Last Mile&apos;s numbers.
      </p>
    </section>
  );
}

const SCALE = 0.4; // bar axis: 0 to +40 points

function Result({ data, ms, cached }: { data: MonteCarloComparison; ms: number | null; cached: boolean }) {
  const lift = data.vulnerableLift;
  const pos = (x: number) => `${Math.min(100, Math.max(0, (x / SCALE) * 100))}%`;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={cn('tabular font-mono text-2xl font-bold', lift.mean > 0 ? 'text-accent' : 'text-danger')}>{formatPts(lift.mean)}</span>
        <span className="tabular font-mono text-xs text-fg-muted">
          95% CI [{formatPts(lift.ci95[0])}, {formatPts(lift.ci95[1])}]{excludesZero(lift.ci95) ? '' : ' · includes zero'}
        </span>
        <span className="tabular font-mono text-xs">
          <span style={{ color: POLICY_COLOR.alerts_only }}>{formatPct(data.results.alerts_only.vulnerableEvacuatedRate.mean)}</span>
          <span className="text-fg-muted"> → </span>
          <span style={{ color: POLICY_COLOR.last_mile }}>{formatPct(data.results.last_mile.vulnerableEvacuatedRate.mean)}</span>
          <span className="text-fg-muted"> vulnerable evacuated</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-3" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent/70" style={{ width: pos(lift.mean) }} />
        <div className="absolute -top-1 h-4 border-x-2 border-fg/70" style={{ left: pos(lift.ci95[0]), width: `calc(${pos(lift.ci95[1])} - ${pos(lift.ci95[0])})` }} />
      </div>
      <p className="font-mono text-[0.625rem] text-fg-muted">
        {[`${data.runs} paired seeds`, cached ? 'engine cache' : 'engine run', ms ? `${(ms / 1000).toFixed(1)} s` : null, 'bar axis 0 to +40 pts'].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}
