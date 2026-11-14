// OWNER: Lane A. Baseline resident behaviour under "alerts only": same fire, same people, NO dispatch.
// Used by BOTH policies (Last Mile adds help on top of it, it never removes this behaviour) so the baseline is not a strawman.
import type { Household } from '@lastmile/contracts';
import { ALERT_ISSUE_S, P, type Behavior } from '../world/population';

/** seconds (sim time) when the household actually starts to leave on its own; Infinity if it will not leave. */
export function selfEvacDepartTime(h: Pick<Household, 'hasVehicle'>, b: Behavior, warnedAt: number): number {
  if (h.hasVehicle) return warnedAt + b.prepS;
  if (b.familyPickup) return warnedAt + b.pickupDelayS;
  return Infinity;
}

export const ALERTS_ONLY_ASSUMPTIONS = [
  'Alerts-only baseline: every household with a vehicle leaves on its own after receiving the alert plus a preparation delay (mean about 6 min, longer with children or pets). No one is dispatched.',
  `Households without a vehicle only leave if a relative or friend picks them up: ${Math.round(P.familyPickup * 100)}% of them have such a pickup, arriving 15 to 40 min after they are warned. The rest wait until the fire arrives.`,
  `The alert is issued ${ALERT_ISSUE_S} s after ignition. This baseline is applied identically under Last Mile, which only adds dispatched help on top of it.`,
];
