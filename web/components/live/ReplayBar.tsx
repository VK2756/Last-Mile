'use client';
import { History, Radio } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatSimClock } from '@/lib/format';

/** Scrub back through the run (both sides together). The live runs keep going underneath. */
export function ReplayBar({ startT, liveT, replayT, onScrub, onLive }: {
  startT: number | null;
  liveT: number | null;
  replayT: number | null;
  onScrub: (t: number) => void;
  onLive: () => void;
}) {
  const ready = startT !== null && liveT !== null && liveT - startT >= 10;
  const value = replayT ?? liveT ?? 0;
  const replaying = replayT !== null;
  return (
    <div className={cn('flex items-center gap-3 border-t border-line bg-surface px-3 py-2', replaying && 'bg-info/[0.06]')} data-testid="replay-scrubber">
      <span className={cn('flex w-24 shrink-0 items-center gap-1.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em]', replaying ? 'text-info' : 'text-fg-dim')}>
        <History aria-hidden className="size-3.5" />{replaying ? 'Replay' : 'Rewind'}
      </span>
      <input
        type="range"
        aria-label="Replay time"
        aria-valuetext={formatSimClock(value)}
        min={startT ?? 0}
        max={liveT ?? 0}
        step={1}
        value={value}
        disabled={!ready}
        onChange={(e) => onScrub(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[var(--color-info)] disabled:cursor-default disabled:opacity-40"
      />
      <span className="tabular w-28 shrink-0 text-right font-mono text-xs text-fg-muted">
        {replaying ? <><span className="text-info">{formatSimClock(value)}</span> / {formatSimClock(liveT ?? 0)}</> : formatSimClock(liveT ?? 0)}
      </span>
      <Button size="sm" variant={replaying ? 'primary' : 'ghost'} onClick={onLive} disabled={!replaying} data-testid="replay-live">
        <Radio aria-hidden className="size-3.5" /> Live
      </Button>
    </div>
  );
}
