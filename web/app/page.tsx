import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, Database, Flame, Phone, Route, Server, Sparkles, Timer, Triangle, Cloud } from 'lucide-react';
import { AppShell, SimBadge } from '@/components/ui';
import { HeroMap } from '@/components/story/HeroMap';

export const metadata: Metadata = {
  title: "Last Mile · live evacuation dispatch for people who can't drive out",
  description:
    "Last Mile predicts every household's time to impact, dispatches the nearest capable helper, and phones each home to learn its needs. Demonstrated in simulation with synthetic people.",
};

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

const STACK = [
  { icon: Sparkles, name: 'Gemini', role: 'Voice triage: speech to structured needs' },
  { icon: Database, name: 'MongoDB Atlas', role: 'Households and helpers, $geoNear matching' },
  { icon: BarChart3, name: 'Tiger Data', role: 'Risk and dispatch time series' },
  { icon: Server, name: 'Vultr', role: 'Runs the simulation and dispatch engine' },
  { icon: Cloud, name: 'Vercel', role: 'Hosts this front end' },
];

const SIMULATED = [
  'Every resident, helper and household is synthetic. No real person is in this system.',
  'The fire is a simplified wind-driven model, not an operational fire-behaviour forecast.',
  'Outcome numbers come only from the Monte Carlo evaluator, run over many paired seeds. Nothing is tuned for the demo.',
  'If Last Mile did not beat the baseline, the results page would say so.',
];

const TEAM = ['Vidhaan', 'Shrish', 'Anant', 'Rishabh', 'Prince'];

export default function Home() {
  return (
    <AppShell right={<SimBadge />}>
      {/* HERO */}
      <section className="ops-grid relative overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fire">
              <Flame aria-hidden className="size-3.5" /> Wildfire &amp; flood evacuation
            </p>
            <h1 className="text-4xl font-bold leading-[1.04] tracking-tight sm:text-6xl">
              Live dispatch for the people who <span className="text-accent">can&apos;t drive out.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
              Alerts tell people to leave. Last Mile finds the households that can&apos;t leave on their own, sends the nearest
              helper who can actually carry them, and re-plans every route as the fire moves.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/live"
                data-testid="landing-cta"
                className="inline-flex h-14 items-center gap-3 rounded-md bg-accent px-7 text-lg font-semibold text-bg shadow-[0_0_0_1px_rgb(46_230_197/0.4),0_10px_30px_-10px_rgb(46_230_197/0.6)] transition-colors hover:bg-[#5ff0d6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Run the live demo <ArrowRight aria-hidden className="size-5" />
              </Link>
              <Link
                href="/results"
                className="inline-flex h-14 items-center gap-2 rounded-md border border-line-strong px-6 text-base font-semibold text-fg-muted transition-colors hover:border-fg-dim hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                See the evidence
              </Link>
            </div>
            <p className="mt-5 font-mono text-xs text-fg-dim">
              Simulation with synthetic people · <Link href="#honesty" className="underline hover:text-fg-muted">what is simulated</Link>
            </p>
          </div>
          <div className="relative">
            <div aria-hidden className="absolute -inset-6 rounded-3xl bg-fire/5 blur-2xl" />
            <HeroMap className="relative w-full rounded-xl border border-line shadow-2xl shadow-black/50" />
            <ul className="relative mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-fg-muted">
              <li className="flex items-center gap-1.5"><Triangle aria-hidden className="size-3 fill-danger text-danger" /> needs help</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-warn" /> helper assigned</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-accent" /> route to safety</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[auto_1fr] md:items-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim">The gap</p>
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-lg leading-relaxed">
              A warning only helps if you can act on it. Without a car, with a wheelchair or an oxygen line, or on a landline that
              never got the text, &ldquo;evacuate now&rdquo; is not a plan.
            </p>
            <p className="text-sm leading-relaxed text-fg-muted">
              In the 2018 Camp Fire, about 40,000 people evacuated and 85 died; NIST&apos;s case study examines how notification,
              traffic and rescues played out.{' '}
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
        </div>
      </section>

      {/* 10-SECOND EXPLAINER */}
      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim">In ten seconds</p>
            <h2 id="how" className="text-2xl font-bold tracking-tight sm:text-3xl">Predict. Dispatch. Call.</h2>
          </div>
          <Link href="/how-it-works" prefetch={false} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            How it works in detail <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col bg-bg p-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="tabular font-mono text-xs text-fg-dim">{s.n}</span>
                <s.icon aria-hidden className="size-5 text-accent" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-accent/80">{s.tag}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* PROOF */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim">Don&apos;t trust the demo</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Trust the counterfactual.</h2>
          </div>
          <div>
            <p className="leading-relaxed text-fg-muted">
              One good-looking run proves nothing. We run the same synthetic town and the same fire twice per seed, once with
              alerts only and once with Last Mile, over many seeds, and report the paired difference with a 95% confidence
              interval. Whatever it says, we show.
            </p>
            <Link
              href="/results"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-5 text-sm font-semibold transition-colors hover:border-fg-dim"
            >
              Open the Monte Carlo results <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* STACK */}
      <section aria-labelledby="stack" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="stack" className="mb-6 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim">Built on</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {STACK.map((s) => (
            <li key={s.name} className="bg-bg p-5">
              <s.icon aria-hidden className="mb-3 size-5 text-fg-muted" />
              <div className="font-semibold">{s.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-fg-dim">{s.role}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* HONESTY */}
      <section id="honesty" aria-labelledby="honesty-h" className="scroll-mt-16 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.4fr]">
          <div>
            <SimBadge className="mb-4" />
            <h2 id="honesty-h" className="text-2xl font-bold tracking-tight">What is simulated, and what we claim</h2>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted">
              Last Mile is a working prototype demonstrated in simulation. The full modelling assumptions are listed next to every
              result.
            </p>
            <Link href="/results#assumptions" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
              Read the assumptions <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <ul className="grid gap-3">
            {SIMULATED.map((t) => (
              <li key={t} className="rounded-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed">
                {t}
              </li>
            ))}
            <li className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-fg">
              The voice agent never promises rescue. If you are in immediate danger, call 911.
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-fg-dim sm:px-6">
          <p>
            Built at HackUMass XIV by <span className="text-fg-muted">{TEAM.join(', ')}</span>.
          </p>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/live" className="hover:text-fg">Live</Link>
            <Link href="/results" className="hover:text-fg">Results</Link>
            <Link href="/how-it-works" prefetch={false} className="hover:text-fg">How it works</Link>
          </nav>
        </div>
      </footer>
    </AppShell>
  );
}
