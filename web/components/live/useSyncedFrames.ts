'use client';
import { useMemo, useRef } from 'react';
import type { SimFrame } from '@lastmile/contracts';
import type { ScenarioStream } from '@/lib/stream';
import { frameAt, pushFrame, sharedTime } from '@/lib/sync';

/** Both runs' frames at one shared sim time (see lib/sync.ts). */
export function useSyncedFrames(left: ScenarioStream, right: ScenarioStream): { t: number | null; left: SimFrame | null; right: SimFrame | null } {
  const bufL = useRef<SimFrame[]>([]);
  const bufR = useRef<SimFrame[]>([]);
  return useMemo(() => {
    if (!left.frame) bufL.current = [];
    else pushFrame(bufL.current, left.frame);
    if (!right.frame) bufR.current = [];
    else pushFrame(bufR.current, right.frame);
    const t = sharedTime(
      { latestT: left.frame?.t ?? null, status: left.status },
      { latestT: right.frame?.t ?? null, status: right.status },
    );
    if (t === null) return { t: null, left: null, right: null };
    const l = frameAt(bufL.current, t);
    const r = frameAt(bufR.current, t);
    const shown = Math.max(l?.t ?? 0, r?.t ?? 0);
    return { t: Number.isFinite(t) ? t : shown, left: l, right: r };
  }, [left.frame, left.status, right.frame, right.status]);
}
