'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Cpu, Play, RefreshCw, Server, ShieldAlert } from 'lucide-react';
import { ScenarioConfig, type MonteCarloComparison } from '@lastmile/contracts';
import { sampleInit } from '@lastmile/contracts/fixtures';
import { AppShell, Banner, Button, SimBadge } from '@/components/ui';
import { engineUrl } from '@/lib/engine';
import { formatPct, formatPts } from '@/lib/format';
import { cn } from '@/lib/cn';
import { CiChart, POLICY_COLOR } from './CiChart';
import { SampleRibbon } from './SampleRibbon';
import { computeSampleComparison, type MonteCarloBase } from './sampleMonteCarlo';
import { EngineBusyError, FRESH_SEEDS, fetchModelAssumptions, fetchPreset, runSeeds } from './mcClient';
import { excludesZero } from './stats';

const SAMPLE_RUNS = 60;

/** Same scenario the engine preset uses (sampleInit + default helper count); only for the browser sample. */
function sampleBase(): MonteCarloBase {
  const { policy: _p, seed: _s, ...rest } = ScenarioConfig.parse({ ...sampleInit.config, helperCount: 24 });
  void _p;
  void _s;
  return rest;
}

type Kind = 'preset' | 'fresh' | 'sample';
type Shown = { kind: Kind; data: MonteCarloComparison; seeds: string; note?: string };
type Job = { label: string; startedAt: number; done?: number; total?: number; expectS?: number } | null;

const SOURCE: Record<Kind, { label: string; icon: typeof Server; tone: string }> = {
  preset: { label: 'Engine · cached preset', icon: Server, tone: 'border-ok/40 bg-ok/10 text-ok' },
  fresh: { label: 'Engine · fresh run', icon: Server, tone: 'border-ok/40 bg-ok/10 text-ok' },
  sample: { label: 'Browser sample', icon: Cpu, tone: 'border-warn/45 bg-warn/10 text-warn' },
};

/** Which assumptions move the result most; picked from the response's own list so nothing is invented. */
const DRIVER_PATTERNS = [/help request/i, /^Helpers \(|start at random road nodes/i, /relative or friend|family pickup/i, /official alert|alert is issued/i, /No-wind spread|Fire spread is/i, /self-evacuate|leaves on its own/i];
function drivers(assumptions: string[]): string[] {
  const picked: string[] = [];
  for (const re of DRIVER_PATTERNS) {
    const a = assumptions.find((x) => re.test(x) && !picked.includes(x));
    if (a) picked.push(a);
  }
  return picked.length >= 3 ? picked.slice(0, 5) : assumptions.slice(0, 5);
}

export function ResultsView({ sensitivity }: { sensitivity: ReactNode | null }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [job, setJob] = useState<Job>({ label: 'Loading the cached 200-seed comparison…', startedAt: Date.now() });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const abort = useRef<AbortController | null>(null);
  const hasEngine = Boolean(engineUrl());
  const [model, setModel] = useState<string[]>([]);

  const fallbackToSample = useCallback(async (why: string | undefined, signal: AbortSignal) => {
    setJob({ label: 'Engine not connected: computing labelled sample data in your browser', startedAt: Date.now(), done: 0, total: SAMPLE_RUNS });
    try {
      const data = await computeSampleComparison(sampleBase(), SAMPLE_RUNS, (done, total) => setJob((j) => (j ? { ...j, done, total } : j)), signal);
      if (signal.aborted) return;
      setShown({ kind: 'sample', data, seeds: `seeds 1–${SAMPLE_RUNS} (browser mock)`, note: why });
      setJob(null);
    } catch (e) {
      if (!signal.aborted) {
        setError(e instanceof Error ? e.message : 'Sample computation failed');
        setJob(null);
      }
    }
  }, []);

  const loadPreset = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setNotice(null);
    if (!engineUrl()) return fallbackToSample(undefined, ctrl.signal);
    setJob({ label: 'Loading the cached 200-seed comparison…', startedAt: Date.now() });
    try {
      const r = await fetchPreset(ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r.placeholder) return fallbackToSample('The engine marked its Monte Carlo response as a placeholder.', ctrl.signal);
      setShown({ kind: 'preset', data: r.data, seeds: `seeds 1–${r.data.runs}` });
      setJob(null);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      if (e instanceof EngineBusyError) {
        setError(e.message);
        setJob(null);
        return;
      }
      await fallbackToSample(e instanceof Error ? e.message : 'request failed', ctrl.signal);
    }
  }, [fallbackToSample]);

  const runFull = useCallback(async () => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setNotice(null);
    setJob({ label: `Running a fresh paired comparison on seeds ${FRESH_SEEDS[0]}–${FRESH_SEEDS.at(-1)} (400 simulations)…`, startedAt: Date.now(), expectS: 45 });
    try {
      const r = await runSeeds(FRESH_SEEDS, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r.placeholder) return fallbackToSample('The engine marked its Monte Carlo response as a placeholder.', ctrl.signal);
      setShown({ kind: 'fresh', data: r.data, seeds: `seeds ${FRESH_SEEDS[0]}–${FRESH_SEEDS.at(-1)}` });
      setNotice(r.ms ? `Finished in ${(r.ms / 1000).toFixed(1)} s${r.cached ? ' (served from the engine cache)' : ''}.` : r.cached ? 'Served from the engine cache.' : null);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? `Full run failed: ${e.message}. Still showing the previous result.` : 'Full run failed.');
    } finally {
      if (!ctrl.signal.aborted) setJob(null);
    }
  }, [fallbackToSample]);

  useEffect(() => {
    void loadPreset();
    return () => abort.current?.abort();
  }, [loadPreset]);

  // model assumptions (from the scenario init) once we show engine numbers
  const engineBase = shown && shown.kind !== 'sample' ? JSON.stringify(shown.data.base) : null;
  useEffect(() => {
    if (!engineBase) return;
    let alive = true;
    void fetchModelAssumptions(JSON.parse(engineBase) as MonteCarloComparison['base']).then((list) => alive && setModel(list));
    return () => {
      alive = false;
    };
  }, [engineBase]);

  useEffect(() => {
    if (!job) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [job]);

  const sample = shown?.kind === 'sample';

  return (
    <AppShell right={<SimBadge mock={sample} />}>
      {sample && (
        <SampleRibbon testId="results-sample-ribbon">
          {shown?.note ? `${shown.note} ` : ''}These numbers come from the in-browser mock, not the Monte Carlo evaluator. Do not quote them.
        </SampleRibbon>
      )}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fire">Counterfactual evaluation</p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">Same fire. Two responses.</h1>
            <p className="mt-4 text-fg-muted">
              Every seed builds one synthetic town, one fire and one set of residents, then runs it twice:{' '}
              <span style={{ color: POLICY_COLOR.alerts_only }}>alerts only</span> and <span style={{ color: POLICY_COLOR.last_mile }}>Last Mile</span>. Bars are
              means; whiskers are 95% confidence intervals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {shown && <SourcePill kind={shown.kind} />}
            {hasEngine && (
              <Button variant="primary" size="md" onClick={() => void runFull()} disabled={Boolean(job)} data-testid="results-run-full">
                <Play aria-hidden className="size-4" /> Run full 200-seed comparison
              </Button>
            )}
            {!hasEngine && (
              <Button variant="secondary" size="sm" onClick={() => void loadPreset()} disabled={Boolean(job)}>
                <RefreshCw aria-hidden className="size-3.5" /> Re-run sample
              </Button>
            )}
          </div>
        </header>

        {error && (
          <Banner tone="warn" title="Heads up" className="mb-6" action={!shown ? <Button size="sm" onClick={() => void loadPreset()}>Try again</Button> : undefined}>
            {error}
          </Banner>
        )}
        {notice && !job && <p className="mb-4 font-mono text-xs text-fg-dim" role="status">{notice}</p>}
        {job && <Progress job={job} now={now} compact={Boolean(shown)} />}
        {shown && <Ready shown={shown} sensitivity={sensitivity} model={shown.kind === 'sample' ? [] : model} />}
      </div>
    </AppShell>
  );
}

function SourcePill({ kind }: { kind: Kind }) {
  const s = SOURCE[kind];
  return (
    <span className={cn('inline-flex h-8 items-center gap-2 rounded-md border px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em]', s.tone)}>
      <s.icon aria-hidden className="size-3.5" />
      {s.label}
    </span>
  );
}

function Progress({ job, now, compact }: { job: NonNullable<Job>; now: number; compact: boolean }) {
  const elapsed = Math.max(0, Math.round((now - job.startedAt) / 1000));
  const determinate = job.total !== undefined && job.total > 0;
  const pct = determinate ? ((job.done ?? 0) / job.total!) * 100 : 0;
  return (
    <div className={cn('rounded-lg border border-line bg-surface', compact ? 'mb-6 p-4' : 'p-8')} aria-busy="true">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn('font-semibold', compact && 'text-sm')}>
          {job.label}
          {determinate && ` ${job.done ?? 0} of ${job.total} paired runs`}
        </p>
        <span className="tabular font-mono text-xs text-fg-dim">
          {elapsed}s elapsed{job.expectS ? ` · usually ~${job.expectS}s` : ''}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Monte Carlo progress"
        aria-valuemin={0}
        aria-valuemax={determinate ? job.total : undefined}
        aria-valuenow={determinate ? job.done : undefined}
        className="relative h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        {determinate ? (
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        ) : (
          <div className="absolute inset-y-0 w-1/3 animate-[lm-indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
        )}
      </div>
      {!compact && (
        <p className="mt-4 text-sm text-fg-muted">Results are not tuned or hand-picked: what you see is what the runs produced.</p>
      )}
      <style>{`@keyframes lm-indeterminate{0%{left:-33%}100%{left:100%}}`}</style>
    </div>
  );
}

function Ready({ shown, sensitivity, model }: { shown: Shown; sensitivity: ReactNode | null; model: string[] }) {
  const { data, kind } = shown;
  const a = data.results.alerts_only;
  const l = data.results.last_mile;
  const lift = data.vulnerableLift;
  const significant = excludesZero(lift.ci95);
  const positive = lift.mean > 0;
  const all = [...data.assumptions, ...model.filter((m) => !data.assumptions.includes(m))];
  const keyDrivers = drivers(model.length ? model : data.assumptions);
  return (
    <div className="grid gap-6">
      <section
        data-testid="results-lift"
        className={cn('rounded-lg border p-6 sm:p-8', significant && positive && kind !== 'sample' ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface')}
      >
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">
          Paired lift · vulnerable households evacuated · {data.runs} seeds ({shown.seeds})
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className={cn('tabular font-mono text-5xl font-bold tracking-tight sm:text-6xl', positive ? 'text-accent' : 'text-danger')}>{formatPts(lift.mean)}</span>
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
          {kind === 'sample' && ' (Sample data from the browser mock; not a result.)'}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 className="mb-1 text-sm font-semibold">Evacuated before the fire arrived</h2>
          <p className="mb-4 text-xs text-fg-dim">Share of at-risk households, mean over {data.runs} seeds, 95% CI whiskers</p>
          <CiChart data={data} />
          <table data-testid="confidence-intervals" className="mt-6 w-full text-sm">
            <caption className="sr-only">Means and 95% confidence intervals by policy</caption>
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">
                <th className="pb-2 font-semibold">Metric</th>
                <th className="pb-2 text-right font-semibold" style={{ color: POLICY_COLOR.alerts_only }}>Alerts only</th>
                <th className="pb-2 text-right font-semibold" style={{ color: POLICY_COLOR.last_mile }}>Last Mile</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono text-xs">
              <CiRow label="All evacuated" a={a.evacuatedRate} l={l.evacuatedRate} />
              <CiRow label="Vulnerable evacuated" a={a.vulnerableEvacuatedRate} l={l.vulnerableEvacuatedRate} />
              <tr className="border-t border-line">
                <th scope="row" className="py-2 text-left font-sans text-sm font-normal text-fg-muted">Trapped per run (mean)</th>
                <td className="py-2 text-right">{a.trappedMean.toFixed(1)}</td>
                <td className="py-2 text-right">{l.trappedMean.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <aside aria-labelledby="drivers-h" className="flex flex-col gap-6">
          <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="drivers-h" className="text-sm font-semibold">What drives this result</h2>
              <SimBadge mock={kind === 'sample'} />
            </div>
            <ol className="space-y-3">
              {keyDrivers.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="tabular mt-0.5 font-mono text-xs text-fg-dim">{String(i + 1).padStart(2, '0')}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <a href="#assumptions" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              All {all.length} assumptions <ArrowRight aria-hidden className="size-3.5" />
            </a>
            <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4 text-xs">
              <dt className="text-fg-dim">Seeds (paired)</dt>
              <dd className="tabular text-right font-mono">{data.runs}</dd>
              <dt className="text-fg-dim">Town</dt>
              <dd className="text-right font-mono">{data.base.town}</dd>
              <dt className="text-fg-dim">Helpers</dt>
              <dd className="tabular text-right font-mono">{data.base.helperCount}</dd>
              <dt className="text-fg-dim">Wind</dt>
              <dd className="tabular text-right font-mono">
                {data.base.wind.speedMph} mph toward {data.base.wind.dirDeg}°
              </dd>
            </dl>
          </section>

          <section data-testid="results-sensitivity" className="rounded-lg border border-warn/40 bg-warn/5 p-4 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert aria-hidden className="size-4 text-warn" /> Under harsher assumptions
            </h2>
            {sensitivity ?? <p className="text-sm text-fg-muted">Sensitivity runs are not written up yet.</p>}
            <p className="mt-3 font-mono text-[10px] text-fg-dim">Source: docs/submission/SENSITIVITY.md</p>
          </section>
        </aside>
      </div>

      <section id="assumptions" className="scroll-mt-20 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Every assumption behind these numbers</h2>
          <SimBadge mock={kind === 'sample'} />
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {all.map((text, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="tabular mt-0.5 font-mono text-xs text-fg-dim">{String(i + 1).padStart(2, '0')}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-fg-muted">
          Everything here is a simulation with synthetic people. Change an assumption and the result can change; that is why they are listed.{' '}
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
