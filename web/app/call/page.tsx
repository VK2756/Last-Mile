'use client';

import { useEffect, useState } from 'react';
import type { TriageResult } from '@lastmile/contracts';

type Turn = { role: 'agent' | 'resident'; text: string };
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { lang: string; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; start(): void; stop(): void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

const card: React.CSSProperties = { background: '#fff', border: '1px solid #d7dfda', borderRadius: 14, padding: 20, boxShadow: '0 4px 20px #1534290c' };

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

  return <main style={{ minHeight: '100vh', background: '#f2f5f1', color: '#16352b', fontFamily: 'Arial, sans-serif', padding: '36px 20px' }}>
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 20 }}>
      <header><span style={{ background: '#9b2c20', color: 'white', padding: '5px 9px', borderRadius: 5, fontSize: 12, fontWeight: 700 }}>SIMULATION</span>
        <h1>Household needs call</h1><p>Synthetic residents and a simplified fire model. This is a demonstration, not an emergency service.</p></header>
      <section style={card}><label>Scenario ID <input aria-label="Scenario ID" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} /></label>{' '}
        <label>Household ID <input aria-label="Household ID" value={householdId} onChange={(e) => setHouseholdId(e.target.value)} /></label>{' '}
        <label>Language <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="es">Español</option><option value="pt">Português</option><option value="zh">中文</option></select></label></section>
      <section style={card}><h2>Call transcript</h2><div aria-live="polite" style={{ minHeight: 140 }}>
        {turns.length ? turns.map((turn, index) => <p key={index}><strong>{turn.role === 'resident' ? 'Resident' : 'Assistant'}:</strong> {turn.text}</p>)
          : <p>Tell us how many people are with you, whether you have a ride, and any mobility or medical needs. If you are in immediate danger, call 911.</p>}</div>
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} style={{ display: 'flex', gap: 8 }}>
          <input aria-label="Your answer" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} style={{ flex: 1, padding: 10 }} />
          <button type="submit" disabled={busy || !householdId}>Send</button><button type="button" onClick={listen} disabled={busy || listening}>{listening ? 'Listening…' : 'Speak'}</button>
        </form>{message && <p role="status">{message}</p>}</section>
      <section style={card}><h2>What we learned</h2>{learned ? <ul>
        <li>Needs: {learned.needs.join(', ') || 'None reported yet'}</li><li>Ride available: {learned.hasRide === null ? 'Unknown' : learned.hasRide ? 'Yes' : 'No'}</li>
        <li>Can walk to road: {learned.canWalkToRoad === null ? 'Unknown' : learned.canWalkToRoad ? 'Yes' : 'No'}</li>
        <li>Residents: {learned.residents ?? 'Unknown'}</li><li>Urgency: {learned.urgency}/5</li></ul> : <p>No answers yet.</p>}</section>
    </div></main>;
}
