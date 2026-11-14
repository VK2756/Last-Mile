'use client';
import type { Metrics, Policy } from '@lastmile/contracts';
import { CheckCircle2, Flame, Accessibility, Loader, Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';
import { AnimatedNumber, StatTile } from '@/components/ui';
import { cn } from '@/lib/cn';
import { POLICY_LABEL } from '@/lib/status';

const n = (v: number) => <AnimatedNumber value={v} />;

/** Plain-English summary for screen readers (the visual tiles are decorative numbers). */
export function scoreSummary(policy: Policy, m: Metrics | null): string {
  if (!m) return `${POLICY_LABEL[policy]}: waiting for the first frame.`;
  return `${POLICY_LABEL[policy]}: ${m.vulnerableEvacuated} of ${m.vulnerableTotal} vulnerable households evacuated, ${m.trapped} trapped (${m.vulnerableTrapped} vulnerable), ${m.evacuated} of ${m.total} evacuated, ${m.inProgress} in progress.`;
}

/**
 * Live counts for one run. Big, readable from the back of the room.
 * `winner` is set only from the real final metrics of both runs (see lib/verdict.ts).
 */
export function Scoreboard({ policy, metrics, className, compact = false, winner = false, 'data-testid': testId }: {
  policy: Policy; metrics: Metrics | null; className?: string; compact?: boolean; winner?: boolean; 'data-testid'?: string;
}) {
  const m = metrics;
  const isLM = policy === 'last_mile';
  const color = isLM ? 'var(--color-accent)' : 'var(--color-baseline)';
  return (
    <section
      data-testid={testId}
      aria-label={`${POLICY_LABEL[policy]} scoreboard`}
      className={cn('glass rounded-xl p-3 sm:p-4', winner && 'lm-winner', className)}
      style={{ borderColor: `color-mix(in oklab, ${color} 38%, transparent)`, '--lm-win-color': color } as CSSProperties}
    >
      <p className="sr-only">{scoreSummary(policy, m)}</p>
      <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3" aria-hidden>
        <span className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em]" style={{ color }}>
          <span className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
          {POLICY_LABEL[policy]}
        </span>
        {winner ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.12em]" style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }} data-testid={testId ? `${testId}-winner` : undefined}>
            <Trophy className="size-3" /> Better outcome
          </span>
        ) : (
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-dim">{m ? `${m.total} households` : ''}</span>
        )}
      </div>
      {!m ? (
        <div className="grid grid-cols-2 gap-4" aria-hidden data-testid={testId ? `${testId}-skeleton` : undefined}>
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="skeleton h-2.5 w-20" />
              <div className="skeleton h-9 w-16" />
            </div>
          ))}
          <div className={cn('skeleton h-6 w-14', compact && 'hidden md:block')} />
          <div className={cn('skeleton h-6 w-14', compact && 'hidden md:block')} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-y-4" aria-hidden>
          <StatTile
            label="Vulnerable out"
            icon={<Accessibility className="size-3" />}
            value={n(m.vulnerableEvacuated)}
            sub={`/ ${m.vulnerableTotal}`}
            tone={isLM ? 'accent' : 'baseline'}
            size={compact ? 'md' : 'lg'}
            data-testid={testId ? `${testId}-vulnerable` : undefined}
          />
          <StatTile
            label="Trapped"
            icon={<Flame className="size-3" />}
            value={n(m.trapped)}
            sub={`${m.vulnerableTrapped} vuln.`}
            tone="danger"
            size={compact ? 'md' : 'lg'}
          />
          <StatTile className={cn(compact && 'hidden md:flex')} label="Evacuated" icon={<CheckCircle2 className="size-3" />} value={n(m.evacuated)} sub={`/ ${m.total}`} tone="ok" size="sm" />
          <StatTile className={cn(compact && 'hidden md:flex')} label="In progress" icon={<Loader className="size-3" />} value={n(m.inProgress)} size="sm" />
        </div>
      )}
    </section>
  );
}
