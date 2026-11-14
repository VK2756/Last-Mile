'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Pause, Play, RotateCcw } from 'lucide-react';
import type { LatLng, Policy } from '@lastmile/contracts';
import { AppShell, Banner, Button, Panel, Segmented, SimBadge } from '@/components/ui';
import { engineUrl } from '@/lib/engine';
import { formatSimClock } from '@/lib/format';
import { FALLBACK_PRESETS, fetchPresets, presetBase, randomBase, sameBase, type Preset } from '@/lib/presets';
import { withPolicy, type BaseConfig } from '@/lib/scenario';
import { useScenarioStream } from '@/lib/stream';
import { combinedStatus } from '@/lib/sync';
import { AssumptionsDrawer } from './AssumptionsDrawer';
import { Legend } from './Legend';
import { MapPane, type MapView } from './MapPane';
import { OperatorPanel } from './OperatorPanel';
import { ScenarioPicker } from './ScenarioPicker';
import { StreamStatusPill } from './StreamStatusPill';
import { useSyncedFrames } from './useSyncedFrames';

const SPEEDS = [4, 12, 30, 60] as const;

/** /live: the same fire and the same synthetic people, run twice. Only the policy differs. */
export function LiveView() {
  const params = useSearchParams();
  const router = useRouter();
  const forcedMock = params.get('mock') === '1';
  const noEngine = !engineUrl();
  const mock = forcedMock || noEngine;
  const tiles = params.get('tiles') !== '0';
  const pitch = params.get('pitch') === '1';

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

  const leftConfig = useMemo(() => withPolicy(base, 'alerts_only'), [base]);
  const rightConfig = useMemo(() => withPolicy(base, 'last_mile'), [base]);
  const left = useScenarioStream(leftConfig, { mock, runKey });
  const right = useScenarioStream(rightConfig, { mock, runKey });
  const synced = useSyncedFrames(left, right);
  const status = combinedStatus(left.status, right.status);
  const live = left.status === 'live' || right.status === 'live';
  const paused = left.paused && right.paused;

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

  const dirty = !sameBase(draft, base);
  /** Run = apply the draft (if edited) and restart both sides from t=0. */
  const run = useCallback((next?: BaseConfig) => {
    const cfg = next ?? draft;
    setSelected(null); setView(null); setPicking(false);
    setDraft(cfg);
    setBase({ ...cfg, speedMultiplier: right.speed });
    setRunKey((k) => k + 1);
  }, [draft, right.speed]);
  const restart = useCallback(() => run(), [run]);
  const choosePreset = useCallback((p: Preset) => { setActivePresetId(p.id); run(presetBase(p, right.speed)); }, [run, right.speed]);
  const randomize = useCallback(() => { setActivePresetId(null); run(randomBase(draft)); }, [run, draft]);
  const editDraft = (next: BaseConfig) => { setActivePresetId(null); setDraft(next); };
  const pickIgnition = useCallback((p: LatLng) => {
    setPicking(false); setActivePresetId(null);
    setDraft((d) => ({ ...d, ignition: { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) } }));
  }, []);
  const pendingIgnition = dirty || picking ? draft.ignition : null;
  const control = useCallback((a: 'pause' | 'resume' | 'speed', v?: number) => { left.control(a, v); right.control(a, v); }, [left, right]);
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
          <span className="tabular font-mono text-base font-bold text-fg md:text-lg" aria-label="Shared simulated time since ignition" data-testid="frame-counter">
            {formatSimClock(synced.t ?? 0)}
          </span>
          <StreamStatusPill status={status} source={mock ? 'mock' : 'engine'} />
          <SimBadge mock={mock} />
        </>
      }
    >
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="relative grid min-h-[70vh] grid-rows-2 gap-px bg-line md:grid-cols-2 md:grid-rows-1 lg:min-h-0">
          <MapPane
            side="left" policy="alerts_only" init={left.init} frame={synced.left} tiles={tiles}
            selectedId={selected?.id ?? null} showCard={selected?.policy === 'alerts_only'} onSelect={select('alerts_only')}
            view={view} onMove={setView} onPick={picking ? pickIgnition : null} pendingIgnition={pendingIgnition}
          />
          <MapPane
            side="right" policy="last_mile" init={right.init} frame={synced.right} tiles={tiles}
            selectedId={selected?.id ?? null} showCard={selected?.policy === 'last_mile'} onSelect={select('last_mile')}
            view={view} onMove={setView} onPick={picking ? pickIgnition : null} pendingIgnition={pendingIgnition}
          />
          <div className="pointer-events-none absolute inset-x-3 top-14 z-10 mx-auto flex max-w-xl flex-col gap-2">
            {engineError && (
              <Banner tone="danger" title="Live engine offline." className="pointer-events-auto bg-surface/95" action={<Button size="sm" variant="primary" onClick={switchToMock}>Switch to mock mode</Button>}>
                {engineError}
              </Banner>
            )}
            {noEngine && !forcedMock && (
              <Banner tone="warn" title="Engine not configured." className="pointer-events-auto bg-surface/95">
                Showing the in-browser mock (NEXT_PUBLIC_ENGINE_URL is unset).
              </Banner>
            )}
            {status === 'reconnecting' && <Banner tone="warn" title="Reconnecting to the engine…" className="pointer-events-auto bg-surface/95" />}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-line bg-bg p-3 [&>*]:shrink-0">
          <Panel eyebrow="Run" title="Controls">
            <p className="mb-3 text-xs leading-relaxed text-fg-muted">Same fire, same synthetic people. Only the policy differs.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" data-testid="run-button" onClick={restart} className="min-w-28">
                <RotateCcw aria-hidden className="size-4" /> {dirty || status === 'idle' ? 'Run' : 'Restart'}
              </Button>
              <Button size="lg" onClick={() => control(paused ? 'resume' : 'pause')} disabled={!live} aria-label={paused ? 'Resume' : 'Pause'}>
                {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
              </Button>
              <Segmented
                label="Playback speed"
                value={String(SPEEDS.includes(right.speed as (typeof SPEEDS)[number]) ? right.speed : 12)}
                onChange={(v) => control('speed', Number(v))}
                options={SPEEDS.map((x) => ({ value: String(x), label: `${x}×` }))}
              />
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAssumptionsOpen(true)} data-testid="assumptions-button">
                <BookOpen aria-hidden className="size-3.5" /> Assumptions
              </Button>
            </div>
          </Panel>
          <OperatorPanel init={right.init} frame={synced.right} selectedId={selected?.policy === 'last_mile' ? selected.id : null} onSelect={(id) => setSelected({ id, policy: 'last_mile' })} />
          <ScenarioPicker
            draft={draft} onChange={editDraft} presets={presets} presetSource={presetSource} activePresetId={activePresetId}
            onPreset={choosePreset} onRandomize={randomize} picking={picking} onTogglePick={() => setPicking((x) => !x)} dirty={dirty}
          />
          <Panel eyebrow="Map key" title="Legend" data-dev-only>
            <Legend />
          </Panel>
        </aside>
      </div>
      <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} assumptions={right.init?.assumptions ?? left.init?.assumptions ?? []} mock={mock} />
    </AppShell>
  );
}
