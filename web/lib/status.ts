import type { HouseholdStatus } from '@lastmile/contracts';

/**
 * One source of truth for how a household looks. Colour encodes URGENCY (time left);
 * SHAPE encodes STATUS, so nothing relies on colour alone.
 */
export type Shape = 'dot' | 'ring' | 'triangle' | 'diamond' | 'square' | 'arrow' | 'check' | 'cross';
export type Urgency = 'calm' | 'watch' | 'urgent' | 'critical' | 'safe' | 'lost';

export const STATUS_META: Record<HouseholdStatus, { label: string; shape: Shape; short: string }> = {
  unaware: { label: 'Unaware', shape: 'dot', short: 'Unaware' },
  warned: { label: 'Warned', shape: 'ring', short: 'Warned' },
  self_evacuating: { label: 'Self-evacuating', shape: 'arrow', short: 'Leaving' },
  needs_help: { label: 'Needs help', shape: 'triangle', short: 'Needs help' },
  assigned: { label: 'Helper assigned', shape: 'diamond', short: 'Assigned' },
  enroute: { label: 'Helper en route', shape: 'square', short: 'En route' },
  evacuated: { label: 'Evacuated', shape: 'check', short: 'Safe' },
  trapped: { label: 'Trapped', shape: 'cross', short: 'Trapped' },
};

export const URGENCY_COLOR: Record<Urgency, string> = {
  calm: '#34d399', // > 15 min (or not threatened)
  watch: '#f5b301', // 5–15 min
  urgent: '#ff7a1a', // 2–5 min
  critical: '#ff3b47', // < 2 min
  safe: '#38bdf8', // evacuated
  lost: '#8b1d2c', // trapped
};

export function urgencyOf(status: HouseholdStatus, tti: number | null): Urgency {
  if (status === 'evacuated') return 'safe';
  if (status === 'trapped') return 'lost';
  if (tti === null) return 'calm';
  if (tti < 120) return 'critical';
  if (tti < 300) return 'urgent';
  if (tti < 900) return 'watch';
  return 'calm';
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  calm: '> 15 min / not threatened',
  watch: '5–15 min',
  urgent: '2–5 min',
  critical: '< 2 min',
  safe: 'Evacuated',
  lost: 'Trapped',
};

export const POLICY_LABEL = { alerts_only: 'Alerts only', last_mile: 'Last Mile' } as const;
