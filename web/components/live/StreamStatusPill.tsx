import type { StreamStatus } from '@/lib/stream';
import { cn } from '@/lib/cn';

const META: Record<StreamStatus, { label: string; dot: string; text: string }> = {
  idle: { label: 'Ready', dot: 'bg-fg-dim', text: 'text-fg-muted' },
  connecting: { label: 'Connecting', dot: 'bg-info animate-pulse', text: 'text-info' },
  live: { label: 'Live', dot: 'bg-ok animate-pulse-slow', text: 'text-ok' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-warn animate-pulse', text: 'text-warn' },
  ended: { label: 'Run complete', dot: 'bg-fg-muted', text: 'text-fg-muted' },
  error: { label: 'Offline', dot: 'bg-danger', text: 'text-danger' },
};

export function StreamStatusPill({ status, source }: { status: StreamStatus; source: 'engine' | 'mock' }) {
  const m = META[status];
  return (
    <span role="status" aria-label={`Stream ${m.label}, ${source}`} title={`${m.label} · ${source}`} className={cn('inline-flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.1em]', m.text)}>
      <span className={cn('size-2 rounded-full', m.dot)} aria-hidden />
      <span className="hidden sm:inline">{m.label}</span>
      <span className="hidden text-fg-dim lg:inline">· {source}</span>
    </span>
  );
}
