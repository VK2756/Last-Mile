import type { Metadata } from 'next';
import { storyMeta } from '@/components/story/meta';
import Link from 'next/link';
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  CarFront,
  Cloud,
  Database,
  Flame,
  Languages,
  Phone,
  Route,
  Server,
  Sparkles,
  Timer,
  Wind,
} from 'lucide-react';
import { AppShell, SimBadge, buttonClass, eyebrowClass } from '@/components/ui';
import { LivePreview } from '@/components/story/LivePreview';
import { Reveal } from '@/components/story/Reveal';

export const metadata: Metadata = storyMeta(
  'Last Mile · live evacuation dispatch for people who can\'t drive out',
  'Last Mile predicts every household\'s time to impact, dispatches the nearest capable helper, and phones each home to learn its needs. Demonstrated in simulation with synthetic people.',
  '/',
);

const STEPS = [
  {
    n: '01',
    icon: Timer,
    title: 'Predict',
    body: 'A fire model spreads the front with the wind and gives every household a countdown: how long until the fire reaches that door.',
    tag: 'risk clock per home',
  },
  {
    n: '02',
    icon: Route,
    title: 'Dispatch',
    body: 'The most urgent home that cannot leave alone is matched to the nearest helper who can carry them: a wheelchair needs a wheelchair-capable van. Routes re-plan as the fire moves.',
    tag: 'explains every choice',
  },
  {
    n: '03',
    icon: Phone,
    title: 'Call',
    body: 'A Gemini voice agent phones each at-risk home, in its own language, landlines included, and turns the answers into needs on the map.',
    tag: 'never promises rescue',
  },
];

const WHO = [
  {
    icon: CarFront,
    title: 'People without a car',
    gap: 'An evacuation order assumes you can drive away.',
    does: 'Matched to a neighbour, volunteer driver, van or shuttle that can reach them before the fire does.',
  },
  {
    icon: Accessibility,
    title: 'Wheelchair users',
    gap: 'Not every ride can take a wheelchair, and boarding takes time.',
    does: 'Only wheelchair-capable vans and buses are sent, with boarding time built into the deadline.',
  },
  {
    icon: Wind,
    title: 'Oxygen-dependent residents',
    gap: 'Smoke and a long wait are more dangerous; equipment has to come along.',
    does: 'Flagged as more urgent on the call, so the dispatcher sees them sooner.',
  },
  {
    icon: Languages,
    title: 'Limited-English households',
    gap: 'Alerts in one language reach people late, or not at all.',
    does: 'The call happens in the resident’s language and works on a landline. No app, no sign-up.',
  },
];

const STACK = [
  { icon: Sparkles, name: 'Gemini', role: 'Voice triage: speech to structured needs' },
  { icon: Database, name: 'MongoDB Atlas', role: 'Households and helpers, $geoNear matching' },
  { icon: BarChart3, name: 'Tiger Data', role: 'Risk and dispatch time series' },
  { icon: Server, name: 'Vultr', role: 'Runs the simulation and dispatch engine' },
  { icon: Cloud, name: 'Vercel', role: 'Hosts this front end' },
];

const PROOF = [
  { k: 'Same fire', v: 'Each seed builds one town, one fire and one set of synthetic people.' },
  { k: 'Two policies', v: 'Run once with alerts only, once with Last Mile. Nothing else changes.' },
  { k: 'Fair baseline', v: 'Last Mile keeps every alerts-only behaviour, family pickups included, and only adds dispatch.' },
  { k: 'Many seeds', v: 'Hundreds of paired runs, reported as a mean difference with a 95% confidence interval.' },
];

const SIMULATED = [
  'Every resident, helper and household is synthetic. No real person is in this system.',
  'The fire is a simplified wind-driven model, not an operational fire-behaviour forecast.',
  'Outcome numbers come only from the Monte Carlo evaluator, run over many paired seeds. Nothing is tuned for the demo.',
  'If Last Mile did not beat the baseline, the results page would say so.',
];

const TEAM = ['Vidhaan', 'Shrish', 'Anant', 'Rishabh', 'Prince'];

const eyebrow = `mb-2 ${eyebrowClass('accent')}`;

export default function Home() {
  return (
    <AppShell right={<SimBadge />}>
      {/* HERO */}
      <section className="ops-grid relative overflow-hidden border-b border-line">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-[radial-gradient(circle,rgb(255_90_31/0.12),transparent_65%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div>
            <p className={`mb-5 inline-flex items-center gap-2 ${eyebrowClass()}`}>
              <Flame aria-hidden className="size-3.5" /> Wildfire &amp; flood evacuation
            </p>
            <h1 className="text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl">
              Live dispatch for the people who <span className="text-accent">can&apos;t drive out.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
              Alerts tell people to leave. Last Mile finds the households that can&apos;t leave on their own, sends the nearest helper who can
              actually carry them, and re-plans every route as the fire moves.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/live"
                data-testid="landing-cta"
                className={buttonClass({ variant: 'primary', size: 'xl' })}
              >
                Run the live demo <ArrowRight aria-hidden className="size-5" />
              </Link>
              <Link
                href="/results"
                className={buttonClass({ variant: 'secondary', size: 'xl' })}
              >
                See the evidence
              </Link>
            </div>
            <p className="mt-5 font-mono text-xs text-fg-muted">
              Simulation with synthetic people ·{' '}
              <Link href="#honesty" className="underline hover:text-fg-muted">
                what is simulated
              </Link>
            </p>
          </div>
          <LivePreview />
        </div>
      </section>

      {/* THE GAP */}
      <section className="border-b border-line bg-surface">
        <Reveal className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[auto_1fr] md:items-center">
          <p className={eyebrowClass('accent')}>The gap</p>
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-lg leading-relaxed">
              A warning only helps if you can act on it. Without a car, with a wheelchair or an oxygen line, or on a landline that never got
              the text, &ldquo;evacuate now&rdquo; is not a plan.
            </p>
            <p className="text-sm leading-relaxed text-fg-muted">
              In the 2018 Camp Fire, about 40,000 people evacuated and 85 died; NIST&apos;s case study examines how notification, traffic and
              rescues played out.{' '}
              <a
                className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg"
                href="https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra"
                target="_blank"
                rel="noreferrer"
              >
                Source: NIST
              </a>
              . The CDC notes that evacuation plans and alerts can miss disability-related needs.{' '}
              <a
                className="text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg"
                href="https://www.cdc.gov/disability-emergency-preparedness/about/"
                target="_blank"
                rel="noreferrer"
              >
                Source: CDC
              </a>
              .
            </p>
          </div>
        </Reveal>
      </section>

      {/* WHO THIS IS FOR */}
      <section aria-labelledby="who" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal className="mb-10 max-w-2xl">
          <p className={eyebrow}>Who this is for</p>
          <h2 id="who" className="text-2xl font-bold tracking-tight sm:text-3xl">
            The households an alert alone leaves behind.
          </h2>
        </Reveal>
        <ul className="grid gap-4 sm:grid-cols-2">
          {WHO.map((w, i) => (
            <Reveal as="li" key={w.title} delay={i * 80} className="rounded-lg border border-line bg-surface p-6">
              <w.icon aria-hidden className="mb-4 size-6 text-accent" />
              <h3 className="text-lg font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{w.gap}</p>
              <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed">
                <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-accent">Last Mile </span>
                {w.does}
              </p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* 10-SECOND EXPLAINER */}
      <section aria-labelledby="how" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={eyebrow}>In ten seconds</p>
              <h2 id="how" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Predict. Dispatch. Call.
              </h2>
            </div>
            <Link href="/how-it-works" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              How it works in detail <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 100} className="flex flex-col bg-bg p-6">
                <div className="mb-6 flex items-center justify-between">
                  <span className="tabular font-mono text-xs text-fg-muted">{s.n}</span>
                  <s.icon aria-hidden className="size-5 text-accent" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
                <p className="mt-6 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-accent/80">{s.tag}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* HOW WE PROVE IT */}
      <section aria-labelledby="prove" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className={eyebrow}>How we prove it</p>
            <h2 id="prove" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Don&apos;t trust the demo. Trust the counterfactual.
            </h2>
            <p className="mt-4 leading-relaxed text-fg-muted">
              One good-looking run proves nothing. The results page runs the same scenario under both policies across many seeds and reports
              the paired difference with its confidence interval, next to the assumptions that drive it. Whatever it says, we show.
            </p>
            <Link
              href="/results"
              className={buttonClass({ variant: 'secondary', className: 'mt-6' })}
            >
              Open the Monte Carlo results <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {PROOF.map((p, i) => (
              <Reveal as="li" key={p.k} delay={i * 80} className="bg-bg p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="tabular font-mono text-xs text-fg-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-semibold">{p.k}</span>
                </div>
                <p className="text-sm leading-relaxed text-fg-muted">{p.v}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* STACK */}
      <section aria-labelledby="stack" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="stack" className={`mb-6 ${eyebrowClass('accent')}`}>
          Built on
        </h2>
        <Reveal as="div">
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
            {STACK.map((s) => (
              <li key={s.name} className="bg-bg p-5">
                <s.icon aria-hidden className="mb-3 size-5 text-fg-muted" />
                <div className="font-semibold">{s.name}</div>
                <div className="mt-1 text-xs leading-relaxed text-fg-muted">{s.role}</div>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* HONESTY */}
      <section id="honesty" aria-labelledby="honesty-h" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <SimBadge className="mb-4" />
            <h2 id="honesty-h" className="text-2xl font-bold tracking-tight">
              What is simulated, and what we claim
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">
              Last Mile is a working prototype demonstrated in simulation. The full modelling assumptions are listed next to every result.
            </p>
            <Link href="/results#assumptions" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              Read the assumptions <ArrowRight aria-hidden className="size-4" />
            </Link>
          </Reveal>
          <ul className="grid gap-3">
            {SIMULATED.map((t, i) => (
              <Reveal as="li" key={t} delay={i * 60} className="rounded-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed">
                {t}
              </Reveal>
            ))}
            <li className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-fg">
              The voice agent never promises rescue. If you are in immediate danger, call 911.
            </li>
          </ul>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-lg font-bold tracking-tight">Last Mile</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
              Live evacuation dispatch for people who can&apos;t drive out. A HackUMass XIV prototype, demonstrated in simulation with synthetic
              people. Not an emergency service.
            </p>
            <p className="mt-4 text-sm text-fg-muted">
              Built by <span className="text-fg-muted">{TEAM.join(', ')}</span>.
            </p>
          </div>
          <nav aria-label="Product" className="text-sm">
            <p className="mb-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-muted">Product</p>
            <ul className="space-y-2">
              <li><Link href="/live" className="text-fg-muted hover:text-fg">Live demo</Link></li>
              <li><Link href="/results" className="text-fg-muted hover:text-fg">Monte Carlo results</Link></li>
              <li><Link href="/how-it-works" className="text-fg-muted hover:text-fg">How it works</Link></li>
              <li><Link href="/call" className="text-fg-muted hover:text-fg">Needs call</Link></li>
            </ul>
          </nav>
          <div className="text-sm">
            <p className="mb-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-muted">Sources</p>
            <ul className="space-y-2">
              <li>
                <a className="text-fg-muted hover:text-fg" href="https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra" target="_blank" rel="noreferrer">
                  NIST Camp Fire case study
                </a>
              </li>
              <li>
                <a className="text-fg-muted hover:text-fg" href="https://www.cdc.gov/disability-emergency-preparedness/about/" target="_blank" rel="noreferrer">
                  CDC disability inclusion
                </a>
              </li>
            </ul>
            <p className="mt-6 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-fg">In immediate danger? Call 911.</p>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}
