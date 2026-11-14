import type { Metrics, Policy } from '@lastmile/contracts';
import { CheckCircle2, Flame, Accessibility, Loader } from 'lucide-react';
import { StatTile } from '@/components/ui';
import { cn } from '@/lib/cn';
import { POLICY_LABEL } from '@/lib/status';

/** Live counts for one run. Big, readable from the back of the room. */
export function Scoreboard({ policy, metrics, className, compact = false, 'data-testid': testId }: { policy: Policy; metrics: Metrics | null; className?: string; compact?: boolean; 'data-testid'?: string }) {
  const m = metrics;
  const isLM = policy === 'last_mile';
  return (
    <div data-testid={testId} className={cn('rounded-lg border bg-surface/95 p-4 backdrop-blur', isLM ? 'border-accent/35' : 'border-baseline/35', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn('font-mono text-xs font-bold uppercase tracking-[0.16em]', isLM ? 'text-accent' : 'text-baseline')}>{POLICY_LABEL[policy]}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">{m ? `${m.total} households` : '—'}</span>
      </div>
      <div className={cn('grid gap-4', compact ? 'grid-cols-2' : 'grid-cols-2')}>
        <StatTile
          label="Vulnerable out"
          icon={<Accessibility aria-hidden className="size-3" />}
          value={m ? m.vulnerableEvacuated : '—'}
          sub={m ? `/ ${m.vulnerableTotal}` : undefined}
          tone={isLM ? 'accent' : 'baseline'}
          size={compact ? 'md' : 'lg'}
          data-testid={testId ? `${testId}-vulnerable` : undefined}
        />
        <StatTile
          label="Trapped"
          icon={<Flame aria-hidden className="size-3" />}
          value={m ? m.trapped : '—'}
          sub={m ? `${m.vulnerableTrapped} vulnerable` : undefined}
          tone="danger"
          size={compact ? 'md' : 'lg'}
        />
        <StatTile label="Evacuated" icon={<CheckCircle2 aria-hidden className="size-3" />} value={m ? m.evacuated : '—'} sub={m ? `/ ${m.total}` : undefined} tone="ok" size="sm" />
        <StatTile label="In progress" icon={<Loader aria-hidden className="size-3" />} value={m ? m.inProgress : '—'} size="sm" />
      </div>
    </div>
  );
}
