import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { AppShell, SimBadge, eyebrowClass } from '@/components/ui';
import { PIPELINE, PipelineDiagram } from '@/components/story/PipelineDiagram';

export const metadata: Metadata = {
  title: 'How it works · Last Mile',
  description:
    'The Last Mile pipeline: a wind-driven fire model, a time-to-impact clock for every household, a capacity-aware dispatch optimizer, Gemini voice triage, and a paired Monte Carlo evaluation. Simulation with synthetic people.',
};

type Stage = {
  id: (typeof PIPELINE)[number]['id'];
  plain: ReactNode;
  details: string[];
  code: string[];
};

// Every parameter below is read from the engine source (engine/src/**) and the lane status files; keep in sync.
const STAGES: Stage[] = [
  {
    id: 'fire',
    plain: (
      <>
        We need to know <em>when</em> the fire will reach each place, not just where it is now. The engine lays a 50&nbsp;m grid over the
        town and works out the fire&apos;s arrival time for every cell: faster downwind, slower backing into the wind, with patchy fuel.
      </>
    ),
    details: [
      'Arrival times come from a minimum-time (Dijkstra) spread over the 8-neighbour grid. Same burn order as stepping a cellular model, but any point can be looked up instantly.',
      'No-wind spread 0.25 m/s on average fuel; each mph of wind speeds the downwind front by 18%. Fuel varies smoothly from 0.7x to 1.3x (seeded noise).',
      'Simplified on purpose: no terrain, spotting or firebreaks. It is not an operational fire forecast.',
    ],
    code: ['engine/src/sim/fire.ts'],
  },
  {
    id: 'clock',
    plain: (
      <>
        Every household gets a countdown: the seconds until the fire reaches its door. That clock, not distance, decides who is most
        urgent, and it updates as the fire grows.
      </>
    ),
    details: [
      '600 synthetic households are placed along real Amherst streets (OpenStreetMap, baked offline). Needs such as no vehicle, wheelchair, oxygen or limited English are drawn at random from stated rates.',
      'An official alert goes out shortly after ignition. Each home reacts after a random delay, longer for landline-only, limited-English or no-signal homes.',
      'Homes with a car leave on their own after packing. Homes without one wait for a relative, if they have one, or for help. Only homes the fire reaches within 2 hours count as at risk.',
    ],
    code: ['engine/src/world/population.ts', 'engine/src/policy/alertsOnly.ts', 'engine/src/sim/engine.ts'],
  },
  {
    id: 'dispatch',
    plain: (
      <>
        When a household asks for help, the dispatcher finds a helper who can actually carry them and get there in time: a wheelchair
        user only goes in a wheelchair-capable van or bus. Routes avoid roads the fire is about to cut, and the whole plan is redone as
        the fire moves. Every assignment comes with a plain-English reason.
      </>
    ),
    details: [
      'Routing: Dijkstra on the road graph. A road closes 60 s before the fire reaches it; roads near the front are slowed by smoke (75% speed within 15 min, 50% within 5 min).',
      'Deadline for each home = its time to impact minus a 120 s safety margin. Boarding takes 90 s, 240 s for a wheelchair.',
      'Plan: greedy insertion in deadline order, then local search that moves pickups between helpers, then every trip is re-checked with exact route times. Hard rules: capacity, wheelchair capability, every pickup before its deadline.',
      'Homes no trip can reach in time are flagged, never silently dropped. The engine re-plans after changes (at most every few simulated seconds).',
    ],
    code: ['engine/src/dispatch/index.ts', 'engine/src/routing/index.ts', 'engine/src/policy/lastMile.ts'],
  },
  {
    id: 'voice',
    plain: (
      <>
        Many of the people who most need help never see an app alert. Last Mile calls them. The voice agent asks how many people are
        home, whether they have a ride, and about mobility or medical needs, in their own language, and turns the answers into
        structured needs on the dispatch map. It never promises rescue and always says: if you are in immediate danger, call 911.
      </>
    ),
    details: [
      'Gemini returns JSON that must match the shared schema (needs from a fixed list, ride, can walk to the road, residents, urgency 1 to 5).',
      'With no API key, or if Gemini fails, a deterministic keyword parser answers instead, so the demo never breaks.',
      'When the call is done, the result is posted to the live scenario: no ride, cannot walk to the road, or urgency 4 or more flips that home to "needs help" and the dispatcher picks it up.',
    ],
    code: ['packages/ai/src/triage.ts', 'web/app/api/triage/route.ts', 'web/app/call/page.tsx'],
  },
  {
    id: 'proof',
    plain: (
      <>
        One good-looking run proves nothing. For each random seed we build one town, one fire and one set of people, then run it twice:
        alerts only, and Last Mile. Repeating that over many seeds gives an average difference with a 95% confidence interval. Whatever
        it says, we show.
      </>
    ),
    details: [
      'Paired design: the population and fire depend only on the seed, never on the policy, so both runs face identical conditions.',
      'The baseline is not a strawman: Last Mile keeps every alerts-only behaviour (self-evacuation, family pickups) and only adds dispatched help on top.',
      'Default 200 seeds, run headless across worker threads. Intervals are percentile bootstrap intervals (2,000 resamples). A zero-helper sanity check gives zero lift.',
    ],
    code: ['engine/src/montecarlo/index.ts', 'engine/src/montecarlo/stats.ts', 'engine/src/sim/headless.ts'],
  },
];

export default function HowItWorksPage() {
  return (
    <AppShell right={<SimBadge />}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mb-10 max-w-3xl">
          <p className={`mb-3 ${eyebrowClass()}`}>How it works</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">From a spreading fire to a van at the right door.</h1>
          <p className="mt-4 text-lg leading-relaxed text-fg-muted">
            Five parts, each simple on its own. This page describes what the code actually does, including what it leaves out. Everything runs
            on synthetic people.
          </p>
        </header>

        <section aria-label="Pipeline diagram" className="mb-14 rounded-lg border border-line bg-surface p-4 sm:p-8">
          <PipelineDiagram />
        </section>

        <ol className="grid gap-6">
          {STAGES.map((s) => {
            const meta = PIPELINE.find((p) => p.id === s.id)!;
            return (
              <li key={s.id} id={s.id} className="scroll-mt-20 rounded-lg border border-line bg-surface">
                <div className="grid gap-6 p-5 sm:p-8 md:grid-cols-[1.1fr_1fr]">
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="tabular font-mono text-xs text-fg-dim">{meta.n}</span>
                      <span aria-hidden className="h-0.5 w-6 rounded-full" style={{ background: meta.color }} />
                    </div>
                    <h2 className="mb-3 text-2xl font-bold tracking-tight">{meta.title}</h2>
                    <p className="leading-relaxed text-fg-muted">{s.plain}</p>
                  </div>
                  <div className="rounded-md border border-line bg-bg p-4">
                    <h3 className="mb-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-dim">Under the hood</h3>
                    <ul className="space-y-2.5 text-sm leading-relaxed">
                      {s.details.map((d) => (
                        <li key={d} className="flex gap-2">
                          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-fg-dim" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 break-words font-mono text-[0.6875rem] text-fg-dim">{s.code.join(' · ')}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <section className="mt-12 grid gap-6 rounded-lg border border-warn/40 bg-warn/5 p-5 sm:p-8 md:grid-cols-[auto_1fr] md:items-start">
          <SimBadge />
          <div>
            <h2 className="mb-2 text-lg font-semibold">What this does not prove</h2>
            <p className="text-sm leading-relaxed text-fg-muted">
              The results depend on stated assumptions: how fast help requests arrive, where helpers start, how quickly people react. Change
              them and the numbers change. A real deployment would need real registries of people who need help, vetted helpers, and
              coordination with emergency services. The full assumptions list sits beside every result.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              <Link href="/results" className="inline-flex items-center gap-1 text-accent hover:underline">
                See the Monte Carlo results <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/live" className="inline-flex items-center gap-1 text-accent hover:underline">
                Watch it run live <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
