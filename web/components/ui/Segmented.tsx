'use client';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> { value: T; label: string }

/** Small radio-group pill selector. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-md border border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('h-7 rounded px-2.5 text-xs font-semibold transition-colors', o.value === value ? 'bg-surface-3 text-fg shadow-sm' : 'text-fg-muted hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
