'use client';
import { useMemo, useRef } from 'react';
import type { SimFrame } from '@lastmile/contracts';
import type { ScenarioStream } from '@/lib/stream';
import { frameAt, pushFrame, pushHistory, sharedTime } from '@/lib/sync';

export interface SyncedFrames {
  /** shared sim time being shown (live or replay) */
  t: number | null;
  left: SimFrame | null;
  right: SimFrame | null;
  /** live shared time and the earliest replayable time */
  liveT: number | null;
  startT: number | null;
}

/**
 * Both runs' frames at one shared sim time (see lib/sync.ts). With `replayT` set, both sides are
 * shown from the downsampled history at that time instead; the live streams keep running underneath.
 */
export function useSyncedFrames(left: ScenarioStream, right: ScenarioStream, replayT: number | null = null): SyncedFrames {
  const bufL = useRef<SimFrame[]>([]);
  const bufR = useRef<SimFrame[]>([]);
  const histL = useRef<SimFrame[]>([]);
  const histR = useRef<SimFrame[]>([]);
  const live = useMemo(() => {
    if (!left.frame) { bufL.current = []; histL.current = []; }
    else { pushFrame(bufL.current, left.frame); pushHistory(histL.current, left.frame); }
    if (!right.frame) { bufR.current = []; histR.current = []; }
    else { pushFrame(bufR.current, right.frame); pushHistory(histR.current, right.frame); }
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

  return useMemo(() => {
    const startT = histL.current[0] || histR.current[0] ? Math.max(histL.current[0]?.t ?? 0, histR.current[0]?.t ?? 0) : null;
    if (replayT === null || live.t === null) return { ...live, liveT: live.t, startT };
    const t = Math.min(Math.max(replayT, startT ?? 0), live.t);
    return { t, left: frameAt(histL.current, t), right: frameAt(histR.current, t), liveT: live.t, startT };
  }, [live, replayT]);
}
