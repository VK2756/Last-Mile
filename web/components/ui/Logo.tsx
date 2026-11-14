import { cn } from '@/lib/cn';

/** Wordmark: a route line that ends in a safe point. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path d="M3 19 C 8 19, 7 6, 13 6 S 19 12, 21 5" fill="none" stroke="#2ee6c5" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0 0" />
        <circle cx="3" cy="19" r="2.4" fill="#ff5a1f" />
        <circle cx="21" cy="5" r="2.6" fill="#06080b" stroke="#2ee6c5" strokeWidth="2" />
      </svg>
      {!compact && <span className="hidden text-[15px] font-bold tracking-tight sm:inline">Last&nbsp;Mile</span>}
    </span>
  );
}
