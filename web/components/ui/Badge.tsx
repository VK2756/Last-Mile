import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'accent' | 'fire' | 'danger' | 'warn' | 'ok' | 'info' | 'baseline';

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-muted border-line-strong',
  accent: 'bg-accent/12 text-accent border-accent/35',
  fire: 'bg-fire/12 text-fire border-fire/40',
  danger: 'bg-danger/12 text-danger border-danger/40',
  warn: 'bg-warn/12 text-warn border-warn/40',
  ok: 'bg-ok/12 text-ok border-ok/35',
  info: 'bg-info/12 text-info border-info/35',
  baseline: 'bg-baseline/12 text-baseline border-baseline/40',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: 'sm' | 'md';
}

/** Small uppercase label. */
export function Badge({ tone = 'neutral', size = 'sm', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border font-mono font-semibold uppercase tracking-[0.08em] whitespace-nowrap',
        size === 'sm' ? 'h-5 px-1.5 text-[0.625rem]' : 'h-6 px-2 text-xs',
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    />
  );
}
