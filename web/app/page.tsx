import Link from 'next/link';
import { ArrowRight, Flame, Phone, Route, Users } from 'lucide-react';
import { AppShell, SimBadge } from '@/components/ui';

// STUB: M1 landing. Full hero + 10-second explainer + stack strip + pitch mode lands in M3 (Lane B).
const STEPS = [
  { icon: Flame, title: 'Predict', body: 'Simulates the fire and gives every home a countdown to impact.' },
  { icon: Users, title: 'Match', body: 'Pairs each at-risk household with the nearest helper who can actually carry them.' },
  { icon: Route, title: 'Route', body: 'Plans pickups and re-plans every few seconds as the fire moves.' },
  { icon: Phone, title: 'Call', body: 'An AI voice phones each home in its own language. No app, landlines work.' },
];

export default function Home() {
  return (
    <AppShell right={<SimBadge />}>
      <section className="ops-grid relative overflow-hidden border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fire">Wildfire &amp; flood evacuation</p>
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Live dispatch for the people who <span className="text-accent">can&apos;t drive out.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-fg-muted">
            Alerts tell people to leave. Last Mile gets the ones who can&apos;t leave on their own out: no car, a wheelchair, an oxygen line, or no alert at all.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/live" className="inline-flex h-14 items-center gap-3 rounded-md bg-accent px-7 text-lg font-semibold text-bg hover:bg-[#5ff0d6]">
              Run the demo <ArrowRight aria-hidden className="size-5" />
            </Link>
            <Link href="/live?mock=1" className="inline-flex h-14 items-center rounded-md border border-line-strong px-6 text-base font-semibold text-fg-muted hover:text-fg">
              Offline mock
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="border-l border-line px-5 py-2">
            <div className="mb-3 flex items-center gap-2 font-mono text-xs text-fg-dim">
              <span>0{i + 1}</span>
              <s.icon aria-hidden className="size-4 text-accent" />
            </div>
            <h2 className="mb-1 text-lg font-semibold">{s.title}</h2>
            <p className="text-sm text-fg-muted">{s.body}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
