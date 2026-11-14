'use client';
import Link from 'next/link';
import { BarChart3, Flag, X } from 'lucide-react';
import type { Verdict } from '@/lib/verdict';
import { cn } from '@/lib/cn';

/** End-of-run callout. Text comes from lib/verdict.ts (real final metrics of both runs). */
export function RunVerdict({ v, mock = false, onClose, className }: { v: Verdict; mock?: boolean; onClose: () => void; className?: string }) {
  const color = v.winner === 'last_mile' ? 'var(--color-accent)' : v.winner === 'alerts_only' ? 'var(--color-baseline)' : 'var(--color-fg-muted)';
  return (
    <div role="status" className={cn('glass pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl px-4 py-3', className)} style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }} data-testid="run-verdict">
      <Flag aria-hidden className="mt-0.5 size-4 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-fg-dim">Run complete · this seed</div>
        <p className="text-sm font-semibold leading-snug sm:text-base" style={{ color }}>{v.headline}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{v.detail} {mock ? 'In-browser mock data: an illustration, not a result.' : 'One seeded run of a simulation with synthetic people.'}</p>
        <Link href="/results" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-info hover:underline">
          <BarChart3 aria-hidden className="size-3.5" /> See confidence intervals over many runs
        </Link>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss run summary" className="rounded p-1 text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"><X className="size-4" /></button>
    </div>
  );
}
