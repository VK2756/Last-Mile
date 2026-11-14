import type { HouseholdStatus } from '@lastmile/contracts';
import { cn } from '@/lib/cn';
import { formatTti } from '@/lib/format';
import { STATUS_META, URGENCY_COLOR, urgencyOf } from '@/lib/status';
import { StatusIcon } from './StatusIcon';

/** "▲ 4m 20s" — status shape + time-to-impact, coloured by urgency. */
export function CountdownChip({ status, tti, className }: { status: HouseholdStatus; tti: number | null; className?: string }) {
  const u = urgencyOf(status, tti);
  const color = URGENCY_COLOR[u];
  const text = status === 'evacuated' ? 'Safe' : status === 'trapped' ? 'Trapped' : formatTti(tti);
  return (
    <span
      className={cn('tabular inline-flex h-6 items-center gap-1.5 rounded border px-1.5 font-mono text-xs font-semibold', u === 'critical' && 'animate-pulse-slow', className)}
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
      title={`${STATUS_META[status].label} · ${formatTti(tti)} to impact`}
    >
      <StatusIcon status={status} tti={tti} size={12} />
      {text}
    </span>
  );
}
