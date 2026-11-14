'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Server, Cpu } from 'lucide-react';
import { ScenarioConfig, type MonteCarloComparison } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { AppShell, Banner, Button, SimBadge } from '@/components/ui';
import { engineUrl, runMonteCarlo } from '@/lib/engine';
import { formatPct, formatPts } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CiChart, POLICY_COLOR } from './CiChart';
import { SampleRibbon } from './SampleRibbon';
import { computeSampleComparison, type MonteCarloBase } from './sampleMonteCarlo';
import { excludesZero } from './stats';

const ENGINE_RUNS = 200;
const SAMPLE_RUNS = 60;

/** Same scenario the live demo opens with; only the seed and policy vary between runs. */
function baseConfig(): MonteCarloBase {
  const { policy: _p, seed: _s, ...rest } = ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24 });
  void _p;
  void _s;
  return rest;
}

type Source = 'engine' | 'sample';
type State =
  | { kind: 'loading'; source: Source; done: number; total: number; startedAt: number; engineError?: string }
  | { kind: 'ready'; source: Source; data: MonteCarloComparison; engineError?: string }
  | { kind: 'error'; message: string };

export function ResultsView() {
  const [state, setState] = useState<State>({ kind: 'loading', source: 'engine', done: 0, total: ENGINE_RUNS, startedAt: Date.now() });
  const [now, setNow] = useState(() => Date.now());
  const abort = useRef<AbortController | null>(null);

  const runSample = useCallback(async (engineError: string | undefined, signal: AbortSignal) => {
    setState({ kind: 'loading', source: 'sample', done: 0, total: SAMPLE_RUNS, startedAt: Date.now(), engineError });
    try {
      const data = await computeSampleComparison(
        baseConfig(),
        SAMPLE_RUNS,
        (done, total) => setState((s) => (s.kind === 'loading' ? { ...s, done, total } : s)),
        signal,
      );
      if (!signal.aborted) setState({ kind: 'ready', source: 'sample', data, engineError });
    } catch (e) {
      if (!signal.aborted) setState({ kind: 'error', message: e instanceof Error ? e.message : 'Sample computation failed' });
    }
  }, []);

  const run = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    if (!engineUrl()) return runSample(undefined, ctrl.signal);
    setState({ kind: 'loading', source: 'engine', done: 0, total: ENGINE_RUNS, startedAt: Date.now() });
    try {
      const data = await runMonteCarlo(baseConfig(), ENGINE_RUNS);
      if (!ctrl.signal.aborted) setState({ kind: 'ready', source: 'engine', data });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      await runSample(e instanceof Error ? e.message : 'Engine request failed', ctrl.signal);
    }
  }, [runSample]);

  useEffect(() => {
    void run();
    return () => abort.current?.abort();
  }, [run]);

  useEffect(() => {
    if (state.kind !== 'loading') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.kind]);

  const source: Source | null = state.kind === 'error' ? null : state.source;
  const engineError = state.kind === 'error' ? undefined : state.engineError;

  return (
    <AppShell right={<SimBadge mock={source === 'sample'} />}>
      {source === 'sample' && (
        <SampleRibbon testId="results-sample-ribbon">
          These numbers come from the in-browser mock, not the Monte Carlo evaluator. Do not quote them.
        </SampleRibbon>
      )}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fire">Counterfactual evaluation</p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Same fire. Two responses.</h1>
            <p className="mt-4 text-fg-muted">
              Every seed builds one synthetic town, one fire and one set of residents, then runs it twice:{' '}
              <span style={{ color: POLICY_COLOR.alerts_only }}>alerts only</span> and{' '}
              <span style={{ color: POLICY_COLOR.last_mile }}>Last Mile</span>. Bars are means; whiskers are 95% confidence intervals.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SourcePill source={source} />
            <Button variant="secondary" size="sm" onClick={() => void run()} disabled={state.kind === 'loading'}>
              <RefreshCw aria-hidden className="size-3.5" /> Re-run
            </Button>
          </div>
        </header>

        {engineError && (
          <Banner tone="warn" title="Engine unreachable" className="mb-6">
            POST /montecarlo failed ({engineError}). Showing labelled sample data instead.
          </Banner>
        )}

        {state.kind === 'loading' && <Loading state={state} now={now} />}
        {state.kind === 'error' && (
          <Banner tone="danger" title="Could not compute results" action={<Button size="sm" onClick={() => void run()}>Try again</Button>}>
            {state.message}
          </Banner>
        )}
        {state.kind === 'ready' && <Ready data={state.data} source={state.source} />}
      </div>
    </AppShell>
  );
}

function SourcePill({ source }: { source: Source | null }) {
  if (!source) return null;
  const engine = source === 'engine';
  const Icon = engine ? Server : Cpu;
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-md border px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]',
        engine ? 'border-ok/40 bg-ok/10 text-ok' : 'border-warn/45 bg-warn/10 text-warn',
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {engine ? 'Monte Carlo engine' : 'Browser sample'}
    </span>
  );
}

function Loading({ state, now }: { state: Extract<State, { kind: 'loading' }>; now: number }) {
  const elapsed = Math.max(0, Math.round((now - state.startedAt) / 1000));
  const determinate = state.source === 'sample';
  const pct = determinate && state.total > 0 ? (state.done / state.total) * 100 : 0;
  return (
    <div className="rounded-lg border border-line bg-surface p-8" aria-busy="true">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {determinate
            ? `Running sample seeds in your browser: ${state.done} of ${state.total} paired runs`
            : `Running ${state.total} paired seeds on the engine…`}
        </p>
        <span className="tabular font-mono text-xs text-fg-dim">{elapsed}s elapsed</span>
      </div>
      <div
        role="progressbar"
        aria-label="Monte Carlo progress"
        aria-valuemin={0}
        aria-valuemax={determinate ? state.total : undefined}
        aria-valuenow={determinate ? state.done : undefined}
        className="relative h-2 overflow-hidden rounded-full bg-surface-3"
      >
        {determinate ? (
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        ) : (
          <div className="absolute inset-y-0 w-1/3 animate-[lm-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
        )}
      </div>
      <p className="mt-4 text-sm text-fg-muted">
        Each seed simulates the whole evacuation twice. Results are not cached or tuned; what you see is what the runs produced.
      </p>
      <style>{`@keyframes lm-indeterminate{0%{left:-33%}100%{left:100%}}`}</style>
    </div>
  );
}

function Ready({ data, source }: { data: MonteCarloComparison; source: Source }) {
  const a = data.results.alerts_only;
  const l = data.results.last_mile;
  const lift = data.vulnerableLift;
  const significant = excludesZero(lift.ci95);
  const positive = lift.mean > 0;
  return (
    <div className="grid gap-6">
      <section
        data-testid="results-lift"
        className={cn('rounded-lg border p-6 sm:p-8', significant && positive ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface')}
      >
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">
          Paired lift · vulnerable households evacuated · {data.runs} seeds
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className={cn('tabular font-mono text-5xl font-bold tracking-tight sm:text-6xl', positive ? 'text-accent' : 'text-danger')}>
            {formatPts(lift.mean)}
          </span>
          <span className="tabular font-mono text-sm text-fg-muted">
            95% CI [{formatPts(lift.ci95[0])}, {formatPts(lift.ci95[1])}]
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-fg-muted">
          {significant
            ? positive
              ? 'The interval excludes zero: across these paired runs, Last Mile evacuated more vulnerable households than alerts alone.'
              : 'The interval excludes zero in the wrong direction: in these runs Last Mile did worse than alerts alone. We report it as is.'
            : 'The interval includes zero: these runs do not show a clear difference. We report it as is.'}
          {source === 'sample' && ' (Sample data from the browser mock; not a result.)'}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="mb-1 text-sm font-semibold">Evacuated before the fire arrived</h2>
          <p className="mb-4 text-xs text-fg-dim">Share of households, mean over {data.runs} seeds, 95% CI whiskers</p>
          <CiChart data={data} />
        </section>

        <section data-testid="confidence-intervals" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">Numbers behind the chart</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">Means and 95% confidence intervals by policy</caption>
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                <th className="pb-2 font-semibold">Metric</th>
                <th className="pb-2 text-right font-semibold" style={{ color: POLICY_COLOR.alerts_only }}>Alerts</th>
                <th className="pb-2 text-right font-semibold" style={{ color: POLICY_COLOR.last_mile }}>Last Mile</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono text-xs">
              <CiRow label="All evacuated" a={a.evacuatedRate} l={l.evacuatedRate} />
              <CiRow label="Vulnerable evacuated" a={a.vulnerableEvacuatedRate} l={l.vulnerableEvacuatedRate} />
              <tr className="border-t border-line">
                <th scope="row" className="py-2 text-left font-sans text-sm font-normal text-fg-muted">Trapped (mean)</th>
                <td className="py-2 text-right">{a.trappedMean.toFixed(1)}</td>
                <td className="py-2 text-right">{l.trappedMean.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
            <dt className="text-fg-dim">Seeds (paired)</dt>
            <dd className="tabular text-right font-mono">{data.runs}</dd>
            <dt className="text-fg-dim">Town</dt>
            <dd className="text-right font-mono">{data.base.town}</dd>
            <dt className="text-fg-dim">Helpers</dt>
            <dd className="tabular text-right font-mono">{data.base.helperCount}</dd>
            <dt className="text-fg-dim">Wind</dt>
            <dd className="tabular text-right font-mono">
              {data.base.wind.speedMph} mph from {data.base.wind.dirDeg}°
            </dd>
          </dl>
        </section>
      </div>

      <section id="assumptions" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Assumptions these numbers depend on</h2>
          <SimBadge mock={source === 'sample'} />
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {data.assumptions.map((text, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="tabular mt-0.5 font-mono text-xs text-fg-dim">{String(i + 1).padStart(2, '0')}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-fg-muted">
          Everything here is a simulation with synthetic people. If an assumption changes, the result can change; that is why they are listed.{' '}
          <Link href="/live" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            Watch one seed play out live <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </section>
    </div>
  );
}

function CiRow({ label, a, l }: { label: string; a: { mean: number; ci95: [number, number] }; l: { mean: number; ci95: [number, number] } }) {
  return (
    <tr className="border-t border-line first:border-t-0">
      <th scope="row" className="py-2 text-left font-sans text-sm font-normal text-fg-muted">{label}</th>
      <td className="py-2 text-right">
        {formatPct(a.mean)}
        <div className="text-[10px] text-fg-dim">[{formatPct(a.ci95[0])}, {formatPct(a.ci95[1])}]</div>
      </td>
      <td className="py-2 text-right">
        {formatPct(l.mean)}
        <div className="text-[10px] text-fg-dim">[{formatPct(l.ci95[0])}, {formatPct(l.ci95[1])}]</div>
      </td>
    </tr>
  );
}
