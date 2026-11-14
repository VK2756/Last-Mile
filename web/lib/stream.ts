'use client';
// useScenarioStream: one hook, two backends.
//   real: POST {ENGINE}/scenarios -> EventSource {ENGINE}/scenarios/:id/stream
//   mock: lib/mock.ts in the browser (?mock=1, and the last-resort demo fallback)
// Every event from either backend goes through StreamEvent.parse: off-contract data fails loudly.
import { useCallback, useEffect, useRef, useState } from 'react';
import { StreamEvent, type Metrics, type ScenarioConfig, type SimFrame, type SimInit } from '@lastmile/contracts';
import { createMockRunner } from './mock';
import { createScenario, engineHealthy, engineUrl, sendControl, type ControlAction } from './engine';

export type StreamStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error';

export type ParseResult = { ok: true; event: StreamEvent } | { ok: false; error: string };

/** Parse one SSE `data:` payload. Never throws. */
export function parseStreamEvent(data: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { ok: false, error: 'stream event is not valid JSON' };
  }
  const r = StreamEvent.safeParse(json);
  if (!r.success) return { ok: false, error: `stream event off-contract: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
  return { ok: true, event: r.data };
}

export interface StreamOptions {
  /** use the in-browser mock instead of the engine */
  mock: boolean;
  /** start streaming (false = stay idle, e.g. before Run is pressed) */
  enabled?: boolean;
  /** bump to restart the scenario with the same config */
  runKey?: number;
  /** mock only: ms of wall time per frame */
  mockFrameMs?: number;
}

export interface ScenarioStream {
  init: SimInit | null;
  frame: SimFrame | null;
  final: Metrics | null;
  status: StreamStatus;
  error: string | null;
  scenarioId: string | null;
  paused: boolean;
  speed: number;
  /** completed automatic reconnects in this run (the UI shows a short "Reconnected" notice) */
  reconnects: number;
  control: (action: ControlAction, value?: number) => void;
}

const MAX_RECONNECT_MS = 12_000;
/** after the browser's own retries give up: health-check backoff before re-attaching to the same run */
export const RESUME_BACKOFF_MS = [2000, 4000, 8000, 15_000];
/** consecutive re-attach failures while the engine itself is healthy = the run is gone (engine restarted) */
const MAX_HEALTHY_FAILURES = 2;

export function useScenarioStream(config: ScenarioConfig | null, opts: StreamOptions): ScenarioStream {
  const { mock, enabled = true, runKey = 0, mockFrameMs = 250 } = opts;
  const [init, setInit] = useState<SimInit | null>(null);
  const [frame, setFrame] = useState<SimFrame | null>(null);
  const [final, setFinal] = useState<Metrics | null>(null);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(config?.speedMultiplier ?? 8);
  const [reconnects, setReconnects] = useState(0);
  const controlRef = useRef<(a: ControlAction, v?: number) => void>(() => {});
  const configKey = config ? JSON.stringify(config) : '';

  useEffect(() => {
    if (!config || !enabled) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setInit(null); setFrame(null); setFinal(null); setError(null); setPaused(false); setSpeed(config.speedMultiplier); setReconnects(0);
    setStatus('connecting');

    const handle = (ev: StreamEvent) => {
      if (cancelled) return;
      if (ev.type === 'init') { setInit(ev.init); setScenarioId(ev.init.scenarioId); setStatus('live'); }
      else if (ev.type === 'frame') { setFrame(ev.frame); setStatus('live'); }
      else { setFinal(ev.final); setStatus('ended'); }
    };
    const fail = (msg: string) => { if (!cancelled) { setError(msg); setStatus('error'); } };

    // ---------------- mock backend ----------------
    if (mock) {
      const id = `mock-${config.policy}-${config.seed}`;
      const runner = createMockRunner(id, config);
      let isPaused = false;
      let spd = config.speedMultiplier;
      const emit = (raw: unknown) => {
        const r = StreamEvent.safeParse(raw);
        if (!r.success) { fail(`mock produced an off-contract event: ${r.error.issues[0]?.message ?? 'unknown'}`); return false; }
        handle(r.data);
        return true;
      };
      emit({ type: 'init', init: runner.init });
      emit({ type: 'frame', frame: runner.frame() });
      const timer = setInterval(() => {
        if (isPaused || cancelled) return;
        if (!emit({ type: 'frame', frame: runner.step((mockFrameMs / 1000) * spd) })) { clearInterval(timer); return; }
        if (runner.done) { clearInterval(timer); emit({ type: 'end', scenarioId: id, final: runner.finalMetrics() }); }
      }, mockFrameMs);
      controlRef.current = (a, v) => {
        if (a === 'pause') { isPaused = true; setPaused(true); }
        else if (a === 'resume') { isPaused = false; setPaused(false); }
        else if (v !== undefined) { spd = Math.min(60, Math.max(0.25, v)); setSpeed(spd); }
      };
      return () => { cancelled = true; clearInterval(timer); };
    }

    // ---------------- real backend (SSE) ----------------
    const base = engineUrl();
    if (!base) { fail('NEXT_PUBLIC_ENGINE_URL is not set'); return; }
    let es: EventSource | null = null;
    let downSince: number | null = null;
    let id: string | null = null;
    let ended = false;
    let wasDown = false;
    let attempt = 0;
    let healthyFailures = 0;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    // The engine keeps running a scenario while nobody watches, so after a drop we re-attach to the
    // SAME run (it resumes where the engine is now) instead of starting a new one.
    const scheduleResume = () => {
      if (cancelled || ended) return;
      setStatus('reconnecting');
      const wait = RESUME_BACKOFF_MS[Math.min(attempt, RESUME_BACKOFF_MS.length - 1)]!;
      attempt++;
      resumeTimer = setTimeout(async () => {
        if (cancelled) return;
        if (!(await engineHealthy())) { scheduleResume(); return; }
        if (healthyFailures >= MAX_HEALTHY_FAILURES) { fail('The engine restarted and this run is gone. Press Retry to start a new one.'); return; }
        healthyFailures++;
        open();
      }, wait);
    };

    const open = () => {
      if (!id || cancelled) return;
      es?.close();
      es = new EventSource(`${base}/scenarios/${encodeURIComponent(id)}/stream`);
      es.onopen = () => {
        downSince = null;
        if (cancelled) return;
        attempt = 0; healthyFailures = 0;
        if (wasDown) { wasDown = false; setReconnects((n) => n + 1); }
        setStatus((s) => (s === 'reconnecting' ? 'live' : s));
      };
      es.onmessage = (m) => {
        const r = parseStreamEvent(m.data as string);
        if (!r.ok) { console.error(r.error); fail(r.error); es?.close(); return; }
        handle(r.event);
        if (r.event.type === 'end') { ended = true; es?.close(); } // otherwise EventSource would reconnect and replay
      };
      es.onerror = () => {
        if (cancelled || !es || ended) return;
        wasDown = true;
        if (es.readyState === EventSource.CLOSED) { scheduleResume(); return; }
        // CONNECTING: the browser retries on its own for a while; then we take over with health checks.
        downSince ??= Date.now();
        if (Date.now() - downSince > MAX_RECONNECT_MS) { es.close(); downSince = null; scheduleResume(); return; }
        setStatus((s) => (s === 'ended' ? s : 'reconnecting'));
      };
    };

    (async () => {
      try {
        id = await createScenario(config);
      } catch (e) {
        fail(`Engine unreachable (${e instanceof Error ? e.message : String(e)})`);
        return;
      }
      if (cancelled) return;
      setScenarioId(id);
      open();
    })();
    controlRef.current = (a, v) => {
      if (!id) return;
      if (a === 'pause') setPaused(true);
      if (a === 'resume') setPaused(false);
      if (a === 'speed' && v !== undefined) setSpeed(v);
      sendControl(id, a, v).catch((e) => console.error('control failed', e));
    };
    return () => { cancelled = true; es?.close(); if (resumeTimer) clearTimeout(resumeTimer); };
    // configKey captures config by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, mock, enabled, runKey, mockFrameMs]);

  const control = useCallback((a: ControlAction, v?: number) => controlRef.current(a, v), []);
  return { init, frame, final, status, error, scenarioId, paused, speed, reconnects, control };
}
