'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Pause, Play, RotateCcw } from 'lucide-react';
import type { Policy } from '@lastmile/contracts';
import { AppShell, Banner, Button, Panel, Segmented, SimBadge } from '@/components/ui';
import { engineUrl } from '@/lib/engine';
import { formatSimClock } from '@/lib/format';
import { DEFAULT_BASE, withPolicy } from '@/lib/scenario';
import { useScenarioStream } from '@/lib/stream';
import { AssumptionsDrawer } from './AssumptionsDrawer';
import { HouseholdCard } from './HouseholdCard';
import { Legend } from './Legend';
import { LiveMap } from './LiveMap';
import { Scoreboard } from './Scoreboard';
import { StreamStatusPill } from './StreamStatusPill';

const SPEEDS = [4, 12, 30, 60] as const;

export function LiveView() {
  const params = useSearchParams();
  const router = useRouter();
  const forcedMock = params.get('mock') === '1';
  const noEngine = !engineUrl();
  const mock = forcedMock || noEngine;
  const tiles = params.get('tiles') !== '0';
  const pitch = params.get('pitch') === '1';

  const [policy, setPolicy] = useState<Policy>('last_mile');
  const [runKey, setRunKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const speedParam = Number(params.get('speed'));
  const startSpeed = Number.isFinite(speedParam) && speedParam >= 0.25 && speedParam <= 60 ? speedParam : DEFAULT_BASE.speedMultiplier;
  const config = useMemo(() => withPolicy({ ...DEFAULT_BASE, speedMultiplier: startSpeed }, policy), [policy, startSpeed]);
  const s = useScenarioStream(config, { mock, runKey });

  useEffect(() => {
    document.documentElement.dataset.pitch = pitch ? '1' : '0';
    return () => { delete document.documentElement.dataset.pitch; };
  }, [pitch]);

  const restart = useCallback(() => { setSelectedId(null); setRunKey((k) => k + 1); }, []);
  const switchToMock = () => {
    const q = new URLSearchParams(params.toString());
    q.set('mock', '1');
    router.replace(`/live?${q.toString()}`);
  };

  const selected = useMemo(() => {
    if (!selectedId || !s.init) return null;
    const household = s.init.households.find((h) => h.id === selectedId);
    if (!household) return null;
    const state = s.frame?.households.find((h) => h.id === selectedId);
    const assignment = s.frame?.assignments.find((a) => a.householdIds.includes(selectedId));
    const helper = assignment ? s.init.helpers.find((p) => p.id === assignment.helperId) : undefined;
    return { household, state, assignment, helper };
  }, [selectedId, s.init, s.frame]);

  return (
    <AppShell
      fullBleed
      right={
        <>
          <span className="tabular hidden font-mono text-lg font-bold text-fg md:inline" aria-label="Simulated time since ignition">{formatSimClock(s.frame?.t ?? 0)}</span>
          <StreamStatusPill status={s.status} source={mock ? 'mock' : 'engine'} />
          <SimBadge mock={mock} />
        </>
      }
    >
      <div className="grid h-full grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="relative min-h-[50vh]">
          <LiveMap className="absolute inset-0" init={s.init} frame={s.frame} selectedId={selectedId} onSelect={setSelectedId} tiles={tiles} data-testid="map-left" label={`${policy === 'last_mile' ? 'Last Mile' : 'Alerts only'} map`} />
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2">
            {s.status === 'error' && !mock && (
              <Banner tone="danger" title="Live engine offline." className="pointer-events-auto bg-surface/95" action={<Button size="sm" variant="primary" onClick={switchToMock}>Switch to mock mode</Button>}>
                {s.error}
              </Banner>
            )}
            {noEngine && !forcedMock && (
              <Banner tone="warn" title="Engine not configured." className="pointer-events-auto bg-surface/95">
                Showing the in-browser mock (NEXT_PUBLIC_ENGINE_URL is unset).
              </Banner>
            )}
            {s.status === 'reconnecting' && <Banner tone="warn" title="Reconnecting to the engine…" className="pointer-events-auto bg-surface/95" />}
          </div>
          {selected && (
            <div className="absolute bottom-3 left-3 w-[min(420px,calc(100%-1.5rem))]">
              <HouseholdCard {...selected} onClose={() => setSelectedId(null)} />
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-line bg-bg p-3">
          <Scoreboard policy={policy} metrics={s.frame?.metrics ?? null} data-testid="scoreboard-left" />
          <Panel eyebrow="Run" title="Controls">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" data-testid="run-button" onClick={restart} className="min-w-28">
                <RotateCcw aria-hidden className="size-4" /> {s.status === 'idle' ? 'Run' : 'Restart'}
              </Button>
              <Button size="lg" onClick={() => s.control(s.paused ? 'resume' : 'pause')} disabled={s.status !== 'live'} aria-label={s.paused ? 'Resume' : 'Pause'}>
                {s.paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
              </Button>
              <Segmented
                label="Playback speed"
                value={String(SPEEDS.includes(s.speed as (typeof SPEEDS)[number]) ? s.speed : 12)}
                onChange={(v) => s.control('speed', Number(v))}
                options={SPEEDS.map((x) => ({ value: String(x), label: `${x}×` }))}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Segmented<Policy>
                label="Policy"
                value={policy}
                onChange={(p) => { setPolicy(p); setSelectedId(null); }}
                options={[{ value: 'alerts_only', label: 'Alerts only' }, { value: 'last_mile', label: 'Last Mile' }]}
              />
              <Button size="sm" variant="ghost" onClick={() => setAssumptionsOpen(true)} data-testid="assumptions-button">
                <BookOpen aria-hidden className="size-3.5" /> Assumptions
              </Button>
            </div>
          </Panel>
          <Panel eyebrow="Map key" title="Legend" data-dev-only>
            <Legend />
          </Panel>
        </aside>
      </div>
      <AssumptionsDrawer open={assumptionsOpen} onClose={() => setAssumptionsOpen(false)} assumptions={s.init?.assumptions ?? []} mock={mock} />
    </AppShell>
  );
}
