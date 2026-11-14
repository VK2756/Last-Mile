import Link from 'next/link';
import { AppShell, SimBadge, buttonClass, eyebrowClass } from '@/components/ui';

const LINKS = [
  { href: '/live', label: 'Live demo', sub: 'the same fire, two responses' },
  { href: '/results', label: 'Monte Carlo results', sub: 'paired seeds, 95% CIs' },
  { href: '/how-it-works', label: 'How it works', sub: 'fire, risk clock, dispatch, voice' },
  { href: '/call', label: 'Needs call', sub: 'voice triage screen' },
];

/** 404 (Lane E). Keeps the SIMULATION badge like every other page. */
export function NotFoundView() {
  return (
    <AppShell right={<SimBadge />}>
      <div className="ops-grid flex min-h-[calc(100dvh-3.5rem)] items-center">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <p className={`mb-3 ${eyebrowClass()}`}>404 · off the map</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">This road doesn&apos;t go anywhere.</h1>
          <p className="mt-4 max-w-xl text-lg text-fg-muted">The page you asked for isn&apos;t here. These routes are open:</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent">
                  <span className="font-semibold">{l.label}</span>
                  <span className="mt-1 block text-sm text-fg-muted">{l.sub}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/" className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-8' })}>
            Back to the start
          </Link>
          <p className="mt-10 text-sm text-fg-muted">In immediate danger? Call 911. Last Mile is a simulation, not an emergency service.</p>
        </div>
      </div>
    </AppShell>
  );
}
