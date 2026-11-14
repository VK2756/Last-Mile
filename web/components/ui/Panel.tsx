import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** remove body padding (e.g. for lists that run edge to edge) */
  flush?: boolean;
}

/** The basic surface: bordered dark card with optional header. */
export function Panel({ title, eyebrow, actions, flush, className, children, ...rest }: PanelProps) {
  const hasHeader = title !== undefined || eyebrow !== undefined || actions !== undefined;
  return (
    <section className={cn('rounded-lg border border-line bg-surface', className)} {...rest}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {eyebrow !== undefined && (
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-dim">{eyebrow}</div>
            )}
            {title !== undefined && <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-4')}>{children}</div>
    </section>
  );
}
