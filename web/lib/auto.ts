// ?auto=1 (unattended judging stations): run preset 1, and when both runs end wait, then run the
// next preset, forever. If the engine fails, retry the same preset after a longer pause.
import type { StreamStatus } from './stream';

export const AUTO_NEXT_MS = 5000;
export const AUTO_RETRY_MS = 10_000;

/** Index of the preset after `currentId` (wraps; unknown/none -> first). */
export function nextPresetIndex(currentId: string | null, ids: string[]): number {
  if (!ids.length) return -1;
  const i = currentId ? ids.indexOf(currentId) : -1;
  return i < 0 ? 0 : (i + 1) % ids.length;
}

/** What auto mode should schedule for this combined status. */
export function autoAction(status: StreamStatus): { kind: 'next'; ms: number } | { kind: 'retry'; ms: number } | null {
  if (status === 'ended') return { kind: 'next', ms: AUTO_NEXT_MS };
  if (status === 'error') return { kind: 'retry', ms: AUTO_RETRY_MS };
  return null;
}
