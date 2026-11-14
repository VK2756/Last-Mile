import { FlaskConical } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Honesty rule (Lane E): whenever a page shows numbers that did not come from the real engine/API,
 * this ribbon is visible. Never hide it conditionally on anything except "the data is real".
 */
export function SampleRibbon({
  testId,
  children,
  className,
}: {
  testId: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-warn/50 bg-[repeating-linear-gradient(135deg,rgb(245_179_1/0.13)_0_12px,rgb(245_179_1/0.05)_12px_24px)] px-4 py-2 sm:px-6',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-warn">
        <FlaskConical aria-hidden className="size-3.5" strokeWidth={2.5} />
        Sample data (engine not connected)
      </span>
      {children && <span className="text-xs text-fg-muted">{children}</span>}
    </div>
  );
}
