import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from './Badge';

const VALUE_TONE: Record<Tone, string> = {
  neutral: 'text-fg',
  accent: 'text-accent',
  fire: 'text-fire',
  danger: 'text-danger',
  warn: 'text-warn',
  ok: 'text-ok',
  info: 'text-info',
  baseline: 'text-baseline',
};

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** e.g. "of 60" or a delta */
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'data-testid'?: string;
}

/** Big readable number. Values use tabular figures so they don't jitter while counting. */
export function StatTile({ label, value, sub, icon, tone = 'neutral', size = 'md', className, ...rest }: StatTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)} data-testid={rest['data-testid']}>
      <div className="flex items-center gap-1.5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-fg-dim">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'tabular font-mono font-bold leading-none tracking-tight',
            size === 'sm' && 'text-xl',
            size === 'md' && 'text-3xl',
            size === 'lg' && 'text-5xl',
            VALUE_TONE[tone],
          )}
        >
          {value}
        </span>
        {sub !== undefined && <span className="tabular truncate font-mono text-xs text-fg-muted">{sub}</span>}
      </div>
    </div>
  );
}
