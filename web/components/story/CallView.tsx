'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Send, Volume2, VolumeX, AlertTriangle, Loader2 } from 'lucide-react';
import { TriageResult, type Need } from '@lastmile/contracts';
import { AppShell, Banner, Button, SimBadge } from '@/components/ui';
import { engineUrl } from '@/lib/engine';
import { cn } from '@/lib/cn';
import { SampleRibbon } from './SampleRibbon';
import { mockTriage, openingLine } from './mockTriage';

type Turn = { role: 'agent' | 'resident'; text: string };
type Responder = 'gemini' | 'mock';
type Applied = { kind: 'idle' } | { kind: 'sending' } | { kind: 'ok' } | { kind: 'skipped'; why: string } | { kind: 'error'; why: string };

// Minimal Web Speech API typing (not in TS's DOM lib everywhere).
type RecAlt = { transcript: string };
type RecResult = { isFinal: boolean; 0: RecAlt; length: number };
type RecEvent = { resultIndex: number; results: ArrayLike<RecResult> };
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechWin = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

const LANGS = [
  { code: 'en', label: 'English', bcp: 'en-US' },
  { code: 'es', label: 'Español', bcp: 'es-US' },
  { code: 'pt', label: 'Português', bcp: 'pt-BR' },
  { code: 'zh', label: '中文', bcp: 'zh-CN' },
  { code: 'vi', label: 'Tiếng Việt', bcp: 'vi-VN' },
];
const bcp = (code: string) => LANGS.find((l) => l.code === code)?.bcp ?? code;

const NEED_LABEL: Record<Need, string> = {
  no_vehicle: 'no vehicle',
  wheelchair: 'wheelchair',
  oxygen: 'oxygen',
  dementia: 'dementia',
  vision_impaired: 'vision impaired',
  hearing_impaired: 'hearing impaired',
  medical_device: 'medical device',
  young_children: 'young children',
  pets: 'pets',
  limited_english: 'limited English',
  no_cell_signal: 'no cell signal',
};

const yesNo = (v: boolean | null) => (v === null ? 'Unknown' : v ? 'Yes' : 'No');

export function CallView() {
  const [scenarioId, setScenarioId] = useState('');
  const [householdId, setHouseholdId] = useState('');
  const [language, setLanguage] = useState('en');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [learned, setLearned] = useState<TriageResult | null>(null);
  const [input, setInput] = useState('');
  const [interim, setInterim] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [responder, setResponder] = useState<Responder | null>(null);
  const [applied, setApplied] = useState<Applied>({ kind: 'idle' });
  const [notice, setNotice] = useState('');
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const logRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setScenarioId(p.get('scenario') ?? '');
    setHouseholdId(p.get('household') ?? '');
    setLanguage(p.get('language') ?? 'en');
    const w = window as SpeechWin;
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      recRef.current?.stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [turns, interim]);

  const speak = useCallback(
    (text: string) => {
      if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp(language);
      u.rate = 0.98;
      window.speechSynthesis.speak(u);
    },
    [muted, language],
  );

  const startCall = () => {
    const line = openingLine(language);
    setTurns([{ role: 'agent', text: line }]);
    setLearned(null);
    setApplied({ kind: 'idle' });
    setNotice('');
    speak(line);
  };

  async function applyToMap(result: TriageResult) {
    const base = engineUrl();
    if (!scenarioId) return setApplied({ kind: 'skipped', why: 'No scenario ID, so the live map was not updated.' });
    if (!base) return setApplied({ kind: 'skipped', why: 'Engine not connected, so the live map was not updated.' });
    setApplied({ kind: 'sending' });
    try {
      const res = await fetch(
        `${base}/scenarios/${encodeURIComponent(scenarioId)}/households/${encodeURIComponent(result.householdId)}/needs`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApplied({ kind: 'ok' });
    } catch (e) {
      setApplied({ kind: 'error', why: e instanceof Error ? e.message : 'request failed' });
    }
  }

  async function triage(utterance: string, history: Turn[]): Promise<{ result: TriageResult; via: Responder }> {
    const req = { householdId, language, utterance, history };
    try {
      const res = await fetch('/api/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { result: TriageResult.parse(await res.json()), via: 'gemini' };
    } catch {
      return { result: mockTriage(req), via: 'mock' };
    }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || !householdId || busy) return;
    const history = turns.length ? turns : [{ role: 'agent' as const, text: openingLine(language) }];
    setBusy(true);
    setNotice('');
    setInput('');
    setInterim('');
    setTurns([...history, { role: 'resident', text }]);
    try {
      const { result, via } = await triage(text.slice(0, 2000), history);
      setResponder(via);
      setTurns([...history, { role: 'resident', text }, { role: 'agent', text: result.reply }]);
      setLearned(result);
      speak(result.reply);
      if (result.done) await applyToMap(result);
    } finally {
      setBusy(false);
    }
  }

  function toggleListen() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as SpeechWin;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setNotice('Speech recognition is not available in this browser. Type the answer instead.');
      return;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const rec = new Ctor();
    rec.lang = bcp(language);
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim(finalText + live);
    };
    rec.onerror = (e) => {
      setNotice(e.error === 'not-allowed' ? 'Microphone permission denied. Type the answer instead.' : 'Could not hear that. Try again or type.');
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      if (finalText.trim()) void send(finalText);
      else setInterim('');
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const inCall = turns.length > 0;

  return (
    <AppShell right={<SimBadge mock={responder === 'mock'} />}>
      {responder === 'mock' && (
        <SampleRibbon testId="call-mock-ribbon">
          Local mock responder: /api/triage is unavailable, so answers are parsed by a keyword matcher in your browser, not Gemini.
        </SampleRibbon>
      )}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div
          role="note"
          data-testid="call-911"
          className="mb-6 flex items-center gap-3 rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm"
        >
          <AlertTriangle aria-hidden className="size-5 shrink-0 text-danger" />
          <p>
            <strong className="text-danger">If you are in immediate danger, call 911.</strong>{' '}
            <span className="text-fg-muted">This is a simulation with synthetic residents. It is not an emergency service and never promises rescue.</span>
          </p>
        </div>

        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fire">Voice triage</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Household needs call</h1>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <Field label="Scenario">
              <input aria-label="Scenario ID" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} placeholder="demo-1" className={inputCls} />
            </Field>
            <Field label="Household">
              <input aria-label="Household ID" value={householdId} onChange={(e) => setHouseholdId(e.target.value)} placeholder="h1" className={inputCls} />
            </Field>
            <Field label="Language">
              <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {LANGS.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* CALL */}
          <section aria-label="Call" className="flex min-h-[28rem] flex-col rounded-lg border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className={cn('size-2 rounded-full', inCall ? 'animate-pulse-slow bg-ok' : 'bg-fg-dim')} aria-hidden />
                <span className="font-semibold">{inCall ? 'Call in progress' : 'Not connected'}</span>
                {householdId && <span className="font-mono text-xs text-fg-dim">· household {householdId}</span>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? 'Unmute assistant voice' : 'Mute assistant voice'}>
                  {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
                </Button>
                {inCall ? (
                  <Button variant="danger" size="sm" onClick={() => { recRef.current?.stop(); setTurns([]); setInterim(''); window.speechSynthesis?.cancel(); }}>
                    <PhoneOff aria-hidden className="size-3.5" /> End
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={startCall} disabled={!householdId}>
                    <Phone aria-hidden className="size-3.5" /> Start call
                  </Button>
                )}
              </div>
            </div>

            <ol ref={logRef} aria-live="polite" aria-label="Call transcript" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!inCall && (
                <li className="text-sm text-fg-muted">
                  Press <strong className="text-fg">Start call</strong> to hear the assistant, or just type or speak an answer below. The assistant asks how
                  many people are home, whether you have a ride, and about mobility or medical needs.
                </li>
              )}
              {turns.map((t, i) => (
                <li key={i} className={cn('flex', t.role === 'resident' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                      t.role === 'resident' ? 'bg-accent/15 text-fg' : 'border border-line bg-surface-2',
                    )}
                  >
                    <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">{t.role === 'resident' ? 'Resident' : 'Assistant'}</div>
                    {t.text}
                  </div>
                </li>
              ))}
              {interim && (
                <li className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg border border-dashed border-accent/40 px-3 py-2 text-sm italic text-fg-muted">{interim}</div>
                </li>
              )}
              {busy && (
                <li className="flex items-center gap-2 text-xs text-fg-dim">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" /> Assistant is thinking…
                </li>
              )}
            </ol>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 border-t border-line p-3"
            >
              <Button
                variant={listening ? 'danger' : 'secondary'}
                size="lg"
                onClick={toggleListen}
                disabled={busy || !householdId}
                aria-pressed={listening}
                aria-label={listening ? 'Stop listening' : 'Speak your answer'}
                title={speechOk ? undefined : 'Speech recognition not supported here; type instead'}
                className="w-12 shrink-0 px-0"
              >
                {listening ? <MicOff aria-hidden className="size-5 shrink-0" /> : <Mic aria-hidden className="size-5 shrink-0" />}
              </Button>
              <input
                aria-label="Your answer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={2000}
                placeholder={listening ? 'Listening…' : householdId ? 'Type the resident’s answer…' : 'Enter a household ID first'}
                className="h-12 min-w-0 flex-1 rounded-md border border-line-strong bg-bg px-3 text-sm placeholder:text-fg-dim focus-visible:outline-2 focus-visible:outline-accent"
              />
              <Button type="submit" variant="primary" size="lg" disabled={busy || !householdId || !input.trim()}>
                <Send aria-hidden className="size-4" /> Send
              </Button>
            </form>
            {notice && <p role="status" className="px-4 pb-3 text-xs text-warn">{notice}</p>}
          </section>

          {/* LEARNED */}
          <section aria-labelledby="learned-h" data-testid="call-learned" className="rounded-lg border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 id="learned-h" className="text-sm font-semibold">What we learned</h2>
              {responder && (
                <span className={cn('font-mono text-[10px] font-semibold uppercase tracking-[0.14em]', responder === 'gemini' ? 'text-ok' : 'text-warn')}>
                  {responder === 'gemini' ? 'via /api/triage' : 'local mock'}
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">Needs</div>
                <div className="flex min-h-7 flex-wrap gap-1.5">
                  {learned?.needs.length ? (
                    learned.needs.map((n) => (
                      <span key={n} className="rounded border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-medium text-fg">{NEED_LABEL[n]}</span>
                    ))
                  ) : (
                    <span className="text-sm text-fg-dim">None reported yet</span>
                  )}
                </div>
                <p className="mt-2 font-mono text-[11px] text-fg-muted">
                  Needs: {learned?.needs.length ? learned.needs.map((n) => NEED_LABEL[n]).join(', ') : 'none yet'}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line text-sm">
                <Fact label="Has a ride" value={learned ? yesNo(learned.hasRide) : '—'} warn={learned?.hasRide === false} />
                <Fact label="Can walk to road" value={learned ? yesNo(learned.canWalkToRoad) : '—'} warn={learned?.canWalkToRoad === false} />
                <Fact label="Residents" value={learned?.residents?.toString() ?? (learned ? 'Unknown' : '—')} />
                <div className="bg-bg p-3">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">Urgency</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <span className="tabular font-mono font-bold">{learned ? `${learned.urgency}/5` : '—'}</span>
                    <span className="flex gap-0.5" aria-hidden>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={cn('h-3 w-1.5 rounded-sm', learned && i <= learned.urgency ? (learned.urgency >= 4 ? 'bg-danger' : 'bg-warn') : 'bg-surface-3')} />
                      ))}
                    </span>
                  </dd>
                </div>
              </dl>
              {learned?.summary && <p className="mt-4 text-sm text-fg-muted">{learned.summary}</p>}
              <div className="mt-4">
                <AppliedStatus applied={applied} done={Boolean(learned?.done)} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

const inputCls =
  'h-9 w-28 rounded-md border border-line-strong bg-surface px-2 font-mono text-xs text-fg focus-visible:outline-2 focus-visible:outline-accent';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">{label}</span>
      {children}
    </label>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-bg p-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">{label}</dt>
      <dd className={cn('mt-1 font-semibold', warn && 'text-danger')}>{value}</dd>
    </div>
  );
}

function AppliedStatus({ applied, done }: { applied: Applied; done: boolean }) {
  if (!done) return <p className="text-xs text-fg-dim">The live map updates once needs and ride availability are captured.</p>;
  switch (applied.kind) {
    case 'sending':
      return <p className="flex items-center gap-2 text-xs text-fg-muted"><Loader2 aria-hidden className="size-3.5 animate-spin" /> Sending to the live simulation…</p>;
    case 'ok':
      return <Banner tone="ok" title="Live map updated">Needs recorded in the simulation.</Banner>;
    case 'skipped':
      return <Banner tone="info" title="Needs captured">{applied.why}</Banner>;
    case 'error':
      return <Banner tone="warn" title="Live map not updated">{applied.why}</Banner>;
    default:
      return null;
  }
}
