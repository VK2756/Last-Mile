// Split-screen clock sync. The two runs (Alerts only / Last Mile) stream independently, so one can
// be a frame or two ahead. We buffer recent frames per side and show both at the same sim time:
// the slower live side sets the shared clock; an ended or failed side stops holding the other back.
import type { SimFrame } from '@lastmile/contracts';
import type { StreamStatus } from './stream';

export const MAX_BUFFER = 400;

/** Append a frame (ignores repeats of the last one) and cap the buffer. Mutates and returns `buf`. */
export function pushFrame(buf: SimFrame[], f: SimFrame): SimFrame[] {
  const last = buf[buf.length - 1];
  if (last === f) return buf;
  if (last && f.t < last.t) buf.length = 0; // new run or replay: start over
  buf.push(f);
  if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER);
  return buf;
}

/** Latest buffered frame at or before `t` (earliest frame if all are later). */
export function frameAt(buf: readonly SimFrame[], t: number): SimFrame | null {
  if (!buf.length) return null;
  let lo = 0;
  let hi = buf.length - 1;
  if (buf[0]!.t > t) return buf[0]!;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (buf[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return buf[lo]!;
}

export interface SideClock { latestT: number | null; status: StreamStatus }

/** Shared sim time to display both sides at, or null before anything arrived. */
export function sharedTime(a: SideClock, b: SideClock): number | null {
  const holding = (s: SideClock) => s.status !== 'ended' && s.status !== 'error' && s.status !== 'idle';
  const known = [a, b].filter((s) => s.latestT !== null);
  if (!known.length) return null;
  const live = [a, b].filter(holding);
  // a live side with no frames yet holds the other at its first frame
  if (live.some((s) => s.latestT === null)) return -Infinity;
  if (live.length) return Math.min(...live.map((s) => s.latestT as number));
  return Math.max(...known.map((s) => s.latestT as number));
}

/** Worst-of status for the shared status pill. */
export function combinedStatus(a: StreamStatus, b: StreamStatus): StreamStatus {
  const order: StreamStatus[] = ['error', 'reconnecting', 'connecting', 'idle', 'live', 'ended'];
  return order[Math.min(order.indexOf(a), order.indexOf(b))]!;
}
