import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Honesty rule: every screen with residents/helpers/fire shows this.
 * Never conditionally hide it (pitch mode keeps it too).
 */
export function SimBadge({ className, mock = false }: { className?: string; mock?: boolean }) {
  return (
    <span
      data-testid="sim-badge"
      role="status"
      aria-label={mock ? 'Simulation, mock data' : 'Simulation with synthetic people'}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-warn/50 bg-warn/10 px-2',
        'font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn',
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-3.5" strokeWidth={2.5} />
      Simulation
      {/* mock is always called out; the longer suffix only where there is room (375px phones must fit) */}
      {mock && <span className="font-medium normal-case tracking-normal text-warn/75 xl:hidden">· mock</span>}
      <span className="hidden font-medium normal-case tracking-normal text-warn/75 xl:inline">
        {mock ? '· mock data' : '· synthetic people'}
      </span>
    </span>
  );
}
