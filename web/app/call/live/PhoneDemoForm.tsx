'use client';

import { useState, type FormEvent } from 'react';

export function PhoneDemoForm({ scenarioId, householdId, language }: { scenarioId: string; householdId: string; language: string }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (process.env.NEXT_PUBLIC_PHONE_DEMO !== '1') return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/phone/call', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), scenarioId: scenarioId || undefined, householdId: scenarioId ? householdId : undefined, language }) });
      const result = await response.json() as { error?: string; status?: string };
      setMessage(response.ok ? 'Demo call requested. Please answer your phone.' : result.error ?? 'Could not start the demo call.');
    } catch { setMessage('Phone service is unavailable. You can still use browser voice or text.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={(event) => { void submit(event); }} className="rounded-lg border border-line bg-surface p-5">
    <h2 className="font-semibold">Call my phone</h2>
    <p className="mt-2 text-sm text-fg-muted">Demo calls go only to numbers registered for this demo. This is an automated AI simulation call, not an emergency service. For immediate danger, call 911.</p>
    <label htmlFor="demo-phone" className="mt-3 block text-sm">Registered phone number (E.164)</label>
    <div className="mt-2 flex flex-wrap gap-2"><input id="demo-phone" type="tel" autoComplete="tel" required placeholder="+1XXXXXXXXXX" value={to} onChange={(event) => setTo(event.target.value)} className="min-w-56 rounded border border-line bg-surface px-3 py-2" />
      <button type="submit" disabled={busy} className="rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-60">{busy ? 'Calling…' : 'Call my phone'}</button></div>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </form>;
}
