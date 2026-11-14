'use client';

import { useEffect, useState } from 'react';
import type { TriageResult } from '@lastmile/contracts';
import { AppShell, Button, Panel, SimBadge } from '@/components/ui';

type Turn = { role: 'agent' | 'resident'; text: string };
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { lang: string; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; start(): void; stop(): void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

const fieldClass = 'mt-1 w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm text-fg focus:outline-2 focus:outline-accent';

export default function CallPage() {
  const [scenarioId, setScenarioId] = useState('');
  const [householdId, setHouseholdId] = useState('');
  const [language, setLanguage] = useState('en');
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [learned, setLearned] = useState<TriageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setScenarioId(params.get('scenario') || '');
    setHouseholdId(params.get('household') || '');
    setLanguage(params.get('language') || 'en');
  }, []);

  async function send(text: string) {
    if (!text.trim() || !householdId || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/triage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, language, utterance: text, history: turns }) });
      if (!response.ok) throw new Error(`Triage request failed (${response.status})`);
      const result = await response.json() as TriageResult;
      setTurns((prior) => [...prior, { role: 'resident', text }, { role: 'agent', text: result.reply }]);
      setLearned(result); setInput('');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const speech = new SpeechSynthesisUtterance(result.reply);
        speech.lang = language;
        window.speechSynthesis.speak(speech);
      }
      if (result.done && scenarioId) {
        const base = process.env.NEXT_PUBLIC_ENGINE_URL;
        if (!base) { setMessage('Needs captured. Engine URL is not configured, so the live map was not updated.'); return; }
        const applied = await fetch(`${base.replace(/\/$/, '')}/scenarios/${encodeURIComponent(scenarioId)}/households/${encodeURIComponent(householdId)}/needs`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) });
        if (!applied.ok) throw new Error(`Live map update failed (${applied.status})`);
        setMessage('Needs recorded in the simulation. The live map has been updated.');
      } else if (result.done) setMessage('Needs captured. Add a scenario ID to update the live map.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  function listen() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) { setMessage('Speech recognition is unavailable here. Please type your answer.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.onresult = (event) => { setListening(false); const text = event.results[0]?.[0]?.transcript; if (text) void send(text); };
    recognition.onerror = () => { setListening(false); setMessage('Microphone unavailable. Please type your answer.'); };
    setListening(true); recognition.start();
  }

  return (
    <AppShell right={<SimBadge />}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <header className="mb-6 max-w-2xl">
          <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Voice triage</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">Household needs call</h1>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            Speak or type on behalf of a synthetic resident. This demonstration does not place a real call or dispatch emergency services.
            If you are in immediate danger, call 911.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <div className="grid content-start gap-4">
            <Panel eyebrow="Scenario" title="Call setup">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-fg-muted">Scenario ID
                  <input aria-label="Scenario ID" className={fieldClass} value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} />
                </label>
                <label className="text-xs font-medium text-fg-muted">Household ID
                  <input aria-label="Household ID" className={fieldClass} value={householdId} onChange={(e) => setHouseholdId(e.target.value)} />
                </label>
                <label className="text-xs font-medium text-fg-muted">Language
                  <select aria-label="Language" className={fieldClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option><option value="es">Español</option>
                    <option value="pt">Português</option><option value="zh">中文</option>
                  </select>
                </label>
              </div>
            </Panel>

            <Panel eyebrow="Conversation" title="Call transcript">
              <div aria-live="polite" className="mb-4 min-h-36 space-y-3 text-sm leading-relaxed text-fg">
                {turns.length ? turns.map((turn, index) => (
                  <p key={index}><strong className="text-accent">{turn.role === 'resident' ? 'Resident' : 'Assistant'}:</strong> {turn.text}</p>
                )) : (
                  <p className="text-fg-muted">
                    Tell us how many people are with you, whether you have a ride, and any mobility or medical needs.
                    If you are in immediate danger, call 911.
                  </p>
                )}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex flex-wrap gap-2">
                <input
                  aria-label="Your answer" value={input} onChange={(e) => setInput(e.target.value)}
                  maxLength={2000} placeholder="Type the resident's answer"
                  className={fieldClass + ' mt-0 min-w-48 flex-1'}
                />
                <Button type="submit" variant="primary" disabled={busy || !householdId}>Send</Button>
                <Button onClick={listen} disabled={busy || listening}>{listening ? 'Listening…' : 'Speak'}</Button>
              </form>
              {message && <p role="status" className="mt-3 text-sm text-warn">{message}</p>}
            </Panel>
          </div>

          <div className="grid content-start gap-4">
            <Panel eyebrow="Structured triage" title="What we learned">
              {learned ? (
                <ul className="space-y-2 text-sm text-fg">
                  <li>Needs: {learned.needs.join(', ') || 'None reported yet'}</li>
                  <li>Ride available: {learned.hasRide === null ? 'Unknown' : learned.hasRide ? 'Yes' : 'No'}</li>
                  <li>Can walk to road: {learned.canWalkToRoad === null ? 'Unknown' : learned.canWalkToRoad ? 'Yes' : 'No'}</li>
                  <li>Residents: {learned.residents ?? 'Unknown'}</li>
                  <li>Urgency: {learned.urgency}/5</li>
                </ul>
              ) : <p className="text-sm text-fg-muted">No answers yet.</p>}
            </Panel>
            <Panel eyebrow="Model boundaries" title="Simulation assumptions">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-fg-muted">
                <li>Residents and helpers are synthetic.</li>
                <li>Fire spread, road access, travel time, and helper availability are modeled.</li>
                <li>The triage result updates this simulation only; it never promises rescue.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
