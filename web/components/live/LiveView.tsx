'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Keyboard, Pause, Play, RotateCcw } from 'lucide-react';
import type { LatLng, Policy } from '@lastmile/contracts';
import { AppShell, Banner, Button, Kbd, Panel, Segmented, SimBadge } from '@/components/ui';
import { engineHealthy, engineUrl } from '@/lib/engine';
import { engineRetryDelay } from '@/lib/fallback';
import { formatSimClock } from '@/lib/format';
import { keyAction } from '@/lib/keys';
import { FALLBACK_PRESETS, fetchPresets, presetBase, randomBase, sameBase, type Preset } from '@/lib/presets';
import { withPolicy, type BaseConfig } from '@/lib/scenario';
import { useScenarioStream } from '@/lib/stream';
import { combinedStatus } from '@/lib/sync';
import { verdict } from '@/lib/verdict';
import { autoAction, nextPresetIndex } from '@/lib/auto';
import { AssumptionsDrawer } from './AssumptionsDrawer';
import { CopyDemoLink, DemoQr } from './DemoLink';
import { Legend } from './Legend';
import { MapPane, type MapView } from './MapPane';
import { OperatorPanel } from './OperatorPanel';
import { ReplayBar } from './ReplayBar';
import { RunVerdict } from './RunVerdict';
import { ScenarioPicker } from './ScenarioPicker';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { StreamStatusPill } from './StreamStatusPill';
import { useSyncedFrames } from './useSyncedFrames';

const SPEEDS = [4, 12, 30, 60] as const;

/** /live: the same fire and the same synthetic people, run twice. Only the policy differs. */
export function LiveView() {
  const params = useSearchParams();
  const router = useRouter();
  const forcedMock = params.get('mock') === '1';
  const noEngine = !engineUrl();
  /** engine configured but unreachable (down, CORS, blocked): run the mock and keep re-checking */
  const [engineDown, setEngineDown] = useState(false);
  const [retry, setRetry] = useState<{ at: number | null; attempt: number }>({ at: null, attempt: 0 });
  const mock = forcedMock || noEngine || engineDown;
  const tiles = params.get('tiles') !== '0';
  const pitch = params.get('pitch') === '1';
  /** ?view=maps: screenshot-friendly, just the two maps + scoreboards (no sidebar, no map controls) */
  const mapsOnly = params.get('view') === 'maps';
  /** ?auto=1: unattended loop through the presets (judging stations) */
  const auto = params.get('auto') === '1';

  const speedParam = Number(params.get('speed'));
  const startSpeed = Number.isFinite(speedParam) && speedParam >= 0.25 && speedParam <= 60 ? speedParam : 12;
  const [presets, setPresets] = useState<Preset[]>(FALLBACK_PRESETS);
  const [presetSource, setPresetSource] = useState<'engine' | 'local'>('local');
  const [base, setBase] = useState<BaseConfig>(() => presetBase(FALLBACK_PRESETS[0]!, startSpeed));
  const [draft, setDraft] = useState<BaseConfig>(base);
  const [activePresetId, setActivePresetId] = useState<string | null>(FALLBACK_PRESETS[0]!.id);
  const [picking, setPicking] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [selected, setSelected] = useState<{ id: string; policy: Policy } | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [replayT, setReplayT] = useState<number | null>(null);
  // SSE drop + automatic resume: remember when it dropped, flash "Reconnected" when it is back
  const [dropT, setDropT] = useState<number | null>(null);
  const [justReconnected, setJustReconnected] = useState(false);
  const [verdictDismissed, setVerdictDismissed] = useState(false);
  /** pitch mode opens on the first frame, paused: the presenter presses Space to start */
  const [holdAtStart, setHoldAtStart] = useState(pitch && !auto);
  const [autoDue, setAutoDue] = useState<{ at: number; label: string } | null>(null);
  const [autoNow, setAutoNow] = useState(0);

  const leftConfig = useMemo(() => withPolicy(base, 'alerts_only'), [base]);
  const rightConfig = useMemo(() => withPolicy(base, 'last_mile'), [base]);
  const left = useScenarioStream(leftConfig, { mock, runKey });
  const right = useScenarioStream(rightConfig, { mock, runKey });
  const synced = useSyncedFrames(left, right, replayT);
  const status = combinedStatus(left.status, right.status);
  const live = left.status === 'live' || right.status === 'live';
  const paused = left.paused && right.paused;
  useEffect(() => {
    if (status === 'reconnecting') setDropT((d) => d ?? synced.t ?? 0);
    else if (status !== 'error') setDropT(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const reconnects = left.reconnects + right.reconnects;
  useEffect(() => {
    if (!reconnects) return;
    setJustReconnected(true);
    const t = setTimeout(() => setJustReconnected(false), 3500);
    return () => clearTimeout(t);
  }, [reconnects]);
  // end-of-run verdict from the two runs' real final metrics
  const result = useMemo(() => (left.final && right.final ? verdict(left.final, right.final) : null), [left.final, right.final]);

  useEffect(() => {
    document.documentElement.dataset.pitch = pitch ? '1' : '0';
    return () => { delete document.documentElement.dataset.pitch; };
  }, [pitch]);

  // presets from the engine when it is there; the built-in copy otherwise
  useEffect(() => {
    if (mock) return;
    let alive = true;
    fetchPresets()
      .then((list) => { if (alive) { setPresets(list); setPresetSource('engine'); } })
      .catch((e) => console.warn('[presets] using built-in presets:', e instanceof Error ? e.message : e));
    return () => { alive = false; };
  }, [mock]);

  // engine configured: if a stream fails and /health doesn't answer either, fall back to the mock
  const streamFailed = !forcedMock && !noEngine && !engineDown && (left.status === 'error' || right.status === 'error');
  useEffect(() => {
    if (forcedMock || noEngine || engineDown) return;
    let alive = true;
    // also probe once on load, so a dead engine falls back within ~3 s instead of waiting on the stream
    engineHealthy().then((ok) => { if (alive && !ok) setEngineDown(true); });
    return () => { alive = false; };
  }, [forcedMock, noEngine, engineDown, streamFailed]);
  // while down: re-check /health with backoff; when it answers, go back to the real engine
  useEffect(() => {
    if (!engineDown) return;
    let alive = true;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const wait = engineRetryDelay(attempt);
      setRetry({ at: Date.now() + wait, attempt });
      timer = setTimeout(async () => {
        if (!alive) return;
        setRetry({ at: null, attempt });
        const ok = await engineHealthy();
        if (!alive) return;
        if (ok) { setEngineDown(false); setRunKey((k) => k + 1); }
        else { attempt++; schedule(); }
      }, wait);
    };
    schedule();
    return () => { alive = false; clearTimeout(timer); };
  }, [engineDown]);
  const [retryNow, setRetryNow] = useState(0);
  useEffect(() => {
    if (retry.at === null) return;
    const i = setInterval(() => setRetryNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [retry.at]);

  const dirty = !sameBase(draft, base);
  /** Run = apply the draft (if edited) and restart both sides from t=0. */
  const run = useCallback((next?: BaseConfig) => {
    const cfg = next ?? draft;
    setSelected(null); setView(null); setPicking(false); setHoldAtStart(false); setReplayT(null); setVerdictDismissed(false);
    setDraft(cfg);
    setBase({ ...cfg, speedMultiplier: right.speed });
    setRunKey((k) => k + 1);
  }, [draft, right.speed]);
  const restart = useCallback(() => run(), [run]);
  const choosePreset = useCallback((p: Preset) => { setActivePresetId(p.id); run(presetBase(p, right.speed)); }, [run, right.speed]);

  // ---- ?auto=1: next preset 5 s after both runs end; retry after an engine error ----
  const autoRef = useRef({ presets, activePresetId, choosePreset, restart });
  autoRef.current = { presets, activePresetId, choosePreset, restart };
  useEffect(() => {
    if (!auto) return;
    const a = autoAction(status);
    if (!a) { setAutoDue(null); return; }
    const { presets: ps, activePresetId: cur } = autoRef.current;
    const nextIdx = nextPresetIndex(cur, ps.map((p) => p.id));
    const label = a.kind === 'retry' ? 'Retrying the engine' : `Next: ${ps[nextIdx]?.name ?? 'restart'}`;
    setAutoDue({ at: Date.now() + a.ms, label });
    const timer = setTimeout(() => {
      setAutoDue(null);
      const r = autoRef.current;
      if (a.kind === 'retry') r.restart();
      else if (nextIdx >= 0 && r.presets[nextIdx]) r.choosePreset(r.presets[nextIdx]!);
      else r.restart();
    }, a.ms);
    return () => clearTimeout(timer);
  }, [auto, status, runKey]);
  useEffect(() => {
    if (!autoDue) return;
    setAutoNow(Date.now());
    const iv = setInterval(() => setAutoNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [autoDue]);
  const randomize = useCallback(() => { setActivePresetId(null); run(randomBase(draft)); }, [run, draft]);
  const editDraft = (next: BaseConfig) => { setActivePresetId(null); setDraft(next); };
  const pickIgnition = useCallback((p: LatLng) => {
    setPicking(false); setActivePresetId(null);
    setDraft((d) => ({ ...d, ignition: { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) } }));
  }, []);
  const pendingIgnition = dirty || picking ? draft.ignition : null;
  const control = useCallback((a: 'pause' | 'resume' | 'speed', v?: number) => { left.control(a, v); right.control(a, v); }, [left, right]);
  // pitch mode: freeze both runs on their first frame until Space
  const holdSent = useRef<string | null>(null);
  useEffect(() => {
    if (!holdAtStart || !left.init || !right.init) return;
    const key = `${left.init.scenarioId}|${right.init.scenarioId}`;
    if (holdSent.current === key) return;
    holdSent.current = key;
    control('pause');
  }, [holdAtStart, left.init, right.init, control]);

  // keyboard: Space start/pause, R reset, 1/2/3 presets, ? help, Esc close
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const a = keyAction(e);
    if (!a) return;
    if (a.type === 'escape') { setSelected(null); setPicking(false); setHelpOpen(false); return; }
    if (assumptionsOpen) return;
    e.preventDefault();
    if (a.type === 'help') setHelpOpen((x) => !x);
    else if (a.type === 'live') setReplayT(null);
    else if (a.type === 'seek') {
      if (synced.liveT === null) return;
      const next = (replayT ?? synced.liveT) + a.delta;
      setReplayT(next >= synced.liveT ? null : Math.max(next, synced.startT ?? 0));
    }
    else if (a.type === 'reset') { setHoldAtStart(false); restart(); }
    else if (a.type === 'preset') { const p = presets[a.index]; if (p) { setHoldAtStart(false); choosePreset(p); } }
    else if (holdAtStart) { setHoldAtStart(false); control('resume'); }
    else if (status === 'ended' || status === 'error' || status === 'idle') restart();
    else if (live) control(paused ? 'resume' : 'pause');
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const switchToMock = () => {
    const q = new URLSearchParams(params.toString());
    q.set('mock', '1');
    router.replace(`/live?${q.toString()}`);
  };
  const engineError = !mock ? (left.status === 'error' ? left.error : right.status === 'error' ? right.error : null) : null;
  const select = (policy: Policy) => (id: string | null) => setSelected(id ? { id, policy } : null);

  return (
    <AppShell
      fullBleed
      right={
        <>
          {replayT !== null && <span className="rounded border border-info/50 bg-info/10 px-1.5 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em] text-info" data-testid="replay-badge">Replay</span>}
          <span className="tabular font-mono text-base font-bold text-fg md:text-lg" aria-label="Shared simulated time since ignition" data-testid="frame-counter">
            {formatSimClock(synced.t ?? 0)}
          </span>
          <StreamStatusPill status={status} source={mock ? 'mock' : 'engine'} />
          <SimBadge mock={mock} />
        </>
      }
    >
      <h1 className="sr-only">Live split-screen simulation: alerts only versus Last Mile (synthetic people)</h1>
      <a href="#operator-panel" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-16 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold">Skip to the operator queue</a>
      <div className={mapsOnly ? 'grid h-full grid-cols-1' : 'grid h-full grid-cols-1 lg:grid-cols-[1fr_21.25rem]'} data-maps-only={mapsOnly ? '1' : undefined}>
        <div className="flex min-h-[70vh] flex-col lg:min-h-0">
        <div className="relative grid min-h-0 flex-1 grid-rows-2 gap-px bg-line md:grid-cols-2 md:grid-rows-1">
          <MapPane
            side="left" policy="alerts_only" init={left.init} frame={synced.left} tiles={tiles}
            selectedId={selected?.id ?? null} showCard={selected?.policy === 'alerts_only'} onSelect={select('alerts_only')} winner={replayT === null && result?.winner === 'alerts_only'}
            view={view} onMove={setView} onPick={picking ? pickIgnition : null} pendingIgnition={pendingIgnition}
          />
          <MapPane
            side="right" policy="last_mile" init={right.init} frame={synced.right} tiles={tiles}
            selectedId={selected?.id ?? null} showCard={selected?.policy === 'last_mile'} onSelect={select('last_mile')} winner={replayT === null && result?.winner === 'last_mile'}
            view={view} onMove={setView} onPick={picking ? pickIgnition : null} pendingIgnition={pendingIgnition}
          />
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-xl flex-col items-stretch gap-2">
            {engineError && (
              <Banner tone="danger" title="Live engine offline." className="pointer-events-auto bg-surface/95" action={<div className="flex gap-2"><Button size="sm" onClick={restart}>Retry</Button><Button size="sm" variant="primary" onClick={switchToMock}>Switch to mock mode</Button></div>}>
                {engineError}
              </Banner>
            )}
            {engineDown && !forcedMock && (
              <div data-testid="engine-unreachable-banner" role="status">
                <Banner tone="warn" title="Engine unreachable, showing the mock. Retrying..." className="pointer-events-auto bg-surface/95">
                  The live engine at {engineUrl().replace(/^https?:\/\//, '')} did not answer (down, or blocked by CORS or the network).{' '}
                  {retry.at === null ? 'Checking now…' : `Next check in ${Math.max(1, Math.ceil((retry.at - (retryNow || Date.now())) / 1000))} s.`} Numbers here are mock data.
                </Banner>
              </div>
            )}
            {noEngine && !forcedMock && (
              <Banner tone="warn" title="Engine not configured." className="pointer-events-auto bg-surface/95">
                Showing the in-browser mock (NEXT_PUBLIC_ENGINE_URL is unset).
              </Banner>
            )}
            {auto && autoDue && (
              <div className="glass-map mx-auto flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs font-semibold text-fg-muted" role="status" data-testid="auto-next">
                <span className="text-info">AUTO</span> {autoDue.label} in {Math.max(0, Math.ceil((autoDue.at - autoNow) / 1000))} s
              </div>
            )}
            {holdAtStart && left.init && right.init && (
              <div className="glass-map mx-auto flex items-center gap-2 rounded-full border-accent/40 px-4 py-2 text-sm font-semibold shadow-xl" data-testid="press-space">
                Press <Kbd>Space</Kbd> to start the fire
              </div>
            )}
            {result && !verdictDismissed && replayT === null && <RunVerdict v={result} mock={mock} onClose={() => setVerdictDismissed(true)} className="mx-auto w-full" />}
            {status === 'reconnecting' && (
              <div data-testid="sse-drop-banner">
                <Banner tone="warn" title="Connection to the engine dropped." className="pointer-events-auto bg-surface/95" action={<Button size="sm" onClick={switchToMock}>Switch to mock</Button>}>
                  Lost at {formatSimClock(dropT ?? synced.t ?? 0)}. The run keeps going on the engine; reconnecting automatically and picking up where it is now…
                </Banner>
              </div>
            )}
            {justReconnected && status === 'live' && (
              <div role="status" className="glass-map mx-auto rounded-full px-4 py-1.5 text-xs font-semibold text-ok" data-testid="reconnected-toast">Reconnected. The run resumed.</div>
            )}
          </div>
        </div>
        {!mapsOnly && <ReplayBar startT={synced.startT} liveT={synced.liveT} replayT={replayT} onScrub={(t) => setReplayT(synced.liveT !== null && t >= synced.liveT ? null : t)} onLive={() => setReplayT(null)} />}
        </div>

        {!mapsOnly && <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-line bg-bg p-3 [&>*]:shrink-0">
          <Panel eyebrow="Run" title="Controls">
            <p className="mb-3 text-xs leading-relaxed text-fg-muted">Same fire, same synthetic people. Only the policy differs.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" data-testid="run-button" onClick={restart} className="min-w-28">
                <RotateCcw aria-hidden className="size-4" /> {dirty || status === 'idle' ? 'Run' : 'Restart'}
              </Button>
              <Button size="lg" onClick={() => { setHoldAtStart(false); control(paused ? 'resume' : 'pause'); }} disabled={!live} aria-label={paused ? 'Resume' : 'Pause'}>
                {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
              </Button>
              <Segmented
                label="Playback speed"
                value={String(SPEEDS.includes(right.speed as (typeof SPEEDS)[number]) ? right.speed : 12)}
                onChange={(v) => control('speed', Number(v))}
                options={SPEEDS.map((x) => ({ value: String(x), label: `${x}×` }))}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
              <CopyDemoLink />
              <Button size="sm" variant="ghost" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" data-dev-only>
                <Keyboard aria-hidden className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAssumptionsOpen(true)} data-testid="assumptions-button">
                <BookOpen aria-hidden className="size-3.5" /> Assumptions
              </Button>
            </div>
          </Panel>
          {pitch && <DemoQr />}
          <OperatorPanel init={right.init} frame={synced.right} selectedId={selected?.policy === 'last_mile' ? selected.id : null} onSelect={(id) => setSelected({ id, policy: 'last_mile' })} />
          <ScenarioPicker
            draft={draft} onChange={editDraft} presets={presets} presetSource={presetSource} activePresetId={activePresetId}
            onPreset={choosePreset} onRandomize={randomize} picking={picking} onTogglePick={() => setPicking((x) => !x)} dirty={dirty}
          />
          <div className="hidden flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-fg-dim [html[data-pitch='1']_&]:flex" aria-hidden>
            <span><Kbd>Space</Kbd> start / pause</span><span><Kbd>R</Kbd> reset</span><span><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd> presets</span>
          </div>
          <Panel eyebrow="Map key" title="Legend" data-dev-only>
            <Legend />
          </Panel>
        </aside>}
      </div>
      <ShortcutsOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} assumptions={right.init?.assumptions ?? left.init?.assumptions ?? []} mock={mock} />
    </AppShell>
  );
}
