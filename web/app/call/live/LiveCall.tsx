'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TriageResult, type TriageResult as TriageResultType } from '@lastmile/contracts';
import { AppShell, Banner, Button, SimBadge } from '@/components/ui';
import { CallView } from '@/components/story/CallView';
import { engineUrl } from '@/lib/engine';
import { LiveSession, type LiveEvent, type LiveTokenResponse } from './session';
import { MicrophoneCapture, PcmPlayback } from './audio';
import { PhoneDemoForm } from './PhoneDemoForm';

type Turn = { role: 'agent' | 'resident'; text: string };
type Mode = 'idle' | 'connecting' | 'live' | 'fallback';

export function LiveCall() {
  const [mode, setMode] = useState<Mode>('idle');
  const [message, setMessage] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [interim, setInterim] = useState('');
  const [agentInterim, setAgentInterim] = useState('');
  const [learned, setLearned] = useState<TriageResultType | null>(null);
  const [applied, setApplied] = useState('');
  const [level, setLevel] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [tokenState, setTokenState] = useState('not requested');
  const [events, setEvents] = useState<string[]>([]);
  const [language, setLanguage] = useState('en');
  const [debug, setDebug] = useState(false);
  const [scenarioId, setScenarioId] = useState('');
  const [householdId, setHouseholdId] = useState('h1');
  const session = useRef<LiveSession | null>(null);
  const mic = useRef<MicrophoneCapture | null>(null);
  const playback = useRef<PcmPlayback | null>(null);
  const history = useRef<Turn[]>([]);
  const pendingInput = useRef('');
  const pendingOutput = useRef('');
  const lastSpeech = useRef(0);
  const ending = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebug(params.get('debug') === '1');
    setScenarioId(params.get('scenario') ?? '');
    setHouseholdId(params.get('household') ?? 'h1');
    setLanguage(params.get('language') === 'es' ? 'es' : 'en');
    return () => { ending.current = true; session.current?.close(); void mic.current?.stop(); void playback.current?.close(); };
  }, []);

  const stop = useCallback(async () => {
    ending.current = true;
    session.current?.endAudio();
    session.current?.close();
    session.current = null;
    await mic.current?.stop();
    await playback.current?.close();
    mic.current = null;
    playback.current = null;
  }, []);

  const fallback = useCallback((why: string) => {
    setMessage(`${why} Continue with browser speech or typed answers below.`);
    setMode('fallback');
    void stop();
  }, [stop]);

  const extract = useCallback(async (utterance: string, prior: Turn[]) => {
    try {
      const response = await fetch('/api/triage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, language, utterance, history: prior }),
      });
      if (!response.ok) throw new Error(`triage HTTP ${response.status}`);
      const result = TriageResult.parse(await response.json());
      setLearned(result);
      if (!result.done || !scenarioId || !householdId) return;
      const base = engineUrl();
      if (!base) { setApplied('Engine unavailable; needs are shown here but not on the map.'); return; }
      const sent = await fetch(`${base}/scenarios/${encodeURIComponent(scenarioId)}/households/${encodeURIComponent(householdId)}/needs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result),
      });
      setApplied(sent.ok ? 'Needs recorded in the simulation.' : `Map update failed (HTTP ${sent.status}).`);
    } catch { setMessage('Needs extraction is temporarily unavailable; the call can continue.'); }
  }, [householdId, language, scenarioId]);

  async function start() {
    if (mode === 'connecting' || mode === 'live') return;
    ending.current = false;
    setMode('connecting');
    setMessage('');
    setTurns([]);
    history.current = [];
    pendingInput.current = '';
    pendingOutput.current = '';
    setAgentInterim('');
    setLearned(null);
    setApplied('');
    setTokenState('requesting');
    try {
      const output = new PcmPlayback();
      await output.ready();
      playback.current = output;
      const response = await fetch('/api/live-token', { method: 'POST', cache: 'no-store' });
      if (!response.ok) return fallback(response.status === 503 ? 'Gemini Live is not configured or available.' : `Live token request failed (HTTP ${response.status}).`);
      const token = await response.json() as LiveTokenResponse;
      setTokenState('issued');
      const next = new LiveSession(token, {
        opened: () => {
          setMode('live');
          const input = new MicrophoneCapture();
          mic.current = input;
          void input.start((data) => session.current?.sendAudio(data), (rms) => {
            setLevel(rms);
            if (rms > 0.06) {
              lastSpeech.current = Date.now();
              if (playback.current?.playing) playback.current.interrupt();
            }
          }).catch(() => fallback('Microphone access failed or AudioWorklet is unavailable.'));
        },
        closed: () => { if (!ending.current) fallback('The Live connection closed.'); },
        error: () => { if (!ending.current) fallback('The Live connection failed.'); },
        input: (text, isInterim) => {
          if (isInterim) setInterim(text);
          else { pendingInput.current += `${text} `; setInterim(''); }
        },
        output: (text) => { pendingOutput.current += `${text} `; setAgentInterim(pendingOutput.current.trim()); },
        audio: (data) => {
          if (lastSpeech.current && latency === null) setLatency(Date.now() - lastSpeech.current);
          playback.current?.enqueue(data);
        },
        interrupted: () => playback.current?.interrupt(),
        turnComplete: () => {
          const utterance = pendingInput.current.trim();
          const answer = pendingOutput.current.trim();
          pendingInput.current = '';
          pendingOutput.current = '';
          setAgentInterim('');
          if (!utterance && !answer) return;
          const prior = [...history.current];
          if (utterance) history.current.push({ role: 'resident', text: utterance });
          if (answer) history.current.push({ role: 'agent', text: answer });
          setTurns([...history.current]);
          if (utterance) void extract(utterance, prior);
        },
        raw: (event: LiveEvent) => {
          if (!debug) return;
          const safe = JSON.stringify(event, (key, value: unknown) => key === 'data' ? '[audio omitted]' : value);
          setEvents((old) => [...old.slice(-29), safe.slice(0, 1200)]);
        },
      });
      session.current = next;
    } catch { fallback('Could not start Gemini Live.'); }
  }

  if (mode === 'fallback') return <><div role="alert" className="mx-auto max-w-4xl p-4 text-sm text-warn">{message}</div><CallView /></>;

  return (
    <AppShell right={<SimBadge />}>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">Live voice triage</p>
          <h1 className="mt-2 text-3xl font-bold">Talk with the needs assistant</h1>
          <p className="mt-3 text-fg-muted">This call uses synthetic residents in a simulation. A headset helps avoid echo.</p>
        </header>
        <Banner tone="warn" title="Immediate danger">If you are in immediate danger, call 911. This simulation is not an emergency service and does not promise rescue.</Banner>
        {message && <p role="status" className="text-sm text-warn">{message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="live-language" className="text-sm">Language</label>
          <select id="live-language" value={language} onChange={(event) => setLanguage(event.target.value)} disabled={mode === 'live'} className="rounded border border-line bg-surface p-2">
            <option value="en">English</option><option value="es">Español</option>
          </select>
          {mode === 'live' ? <Button onClick={() => { void stop(); setMode('idle'); }}>End call</Button> : <Button onClick={() => { void start(); }} disabled={mode === 'connecting'}>{mode === 'connecting' ? 'Connecting…' : 'Start live call'}</Button>}
          <Link href="/call" className="text-sm text-accent underline">Use browser voice or text</Link>
        </div>
        <PhoneDemoForm scenarioId={scenarioId} householdId={householdId} language={language} />
        <section aria-label="Live transcript" className="min-h-40 rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold">Transcript</h2>
          {turns.length === 0 && <p className="text-sm text-fg-muted">The conversation will appear here.</p>}
          <ol className="space-y-2">{turns.map((turn, index) => <li key={index}><strong>{turn.role === 'resident' ? 'Resident' : 'Assistant'}:</strong> {turn.text}</li>)}</ol>
          {interim && <p className="mt-2 text-sm italic text-fg-muted">Hearing: {interim}</p>}
          {agentInterim && <p className="mt-2 text-sm italic text-fg-muted">Assistant: {agentInterim}</p>}
        </section>
        <section aria-label="Household needs" className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold">What we learned</h2>
          {learned ? <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt>Needs</dt><dd>{learned.needs.join(', ') || 'None stated'}</dd></div>
            <div><dt>Ride available</dt><dd>{String(learned.hasRide ?? 'unknown')}</dd></div>
            <div><dt>Can walk to road</dt><dd>{String(learned.canWalkToRoad ?? 'unknown')}</dd></div>
            <div><dt>People</dt><dd>{learned.residents ?? 'Unknown'}</dd></div>
          </dl> : <p className="text-sm text-fg-muted">Needs appear after each spoken turn.</p>}
          {applied && <p role="status" className="mt-3 text-sm">{applied}</p>}
        </section>
        {debug && <section aria-label="Live debug" className="rounded-lg border border-line p-4 font-mono text-xs">
          <h2 className="font-semibold">Debug</h2>
          <p>Token: {tokenState} · input: 16000 Hz · output: 24000 Hz · mic RMS: {level.toFixed(3)} · first audio latency: {latency ?? '—'} ms</p>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{events.join('\n')}</pre>
        </section>}
      </main>
    </AppShell>
  );
}
