// OWNER: Lane A. Baseline resident behaviour under "alerts only": same fire, same people, NO dispatch.
// Used by BOTH policies (Last Mile adds help on top of it, it never removes this behaviour) so the baseline is not a strawman.
import type { BaselineKnobs, Household } from '@lastmile/contracts';
import { ALERT_ISSUE_S, P, type Behavior } from '../world/population';

/** seconds (sim time) when the household actually starts to leave on its own; Infinity if it will not leave. */
export function selfEvacDepartTime(h: Pick<Household, 'hasVehicle'>, b: Behavior, warnedAt: number): number {
  if (h.hasVehicle) return warnedAt + b.prepS;
  if (b.familyPickup) return warnedAt + b.pickupDelayS;
  return Infinity;
}

export function alertsOnlyAssumptions(b: BaselineKnobs = {}): string[] {
  const fam = b.familyPickupProb ?? P.familyPickup, prep = b.prepDelayScale ?? 1, alert = b.alertIssueS ?? ALERT_ISSUE_S;
  const tag = (on: boolean) => (on ? 'SENSITIVITY: ' : '');
  return [
    `${tag(prep !== 1)}Alerts-only baseline: every household with a vehicle leaves on its own after receiving the alert plus a preparation delay (mean about ${Math.round(6 * prep * 10) / 10} min${prep !== 1 ? `, default 6 min x prepDelayScale ${prep}` : ''}; longer with children or pets). No one is dispatched.`,
    `${tag(fam !== P.familyPickup)}Households without a vehicle only leave if a relative or friend picks them up: ${Math.round(fam * 1000) / 10}% of them have such a pickup${fam !== P.familyPickup ? ` (default ${P.familyPickup * 100}%)` : ''}, arriving 15 to 40 min after they are warned${b.urgentFamilyPickup ? ', or sooner when the fire is near (see below)' : ''}. The rest wait until the fire arrives.`,
    `${tag(alert !== ALERT_ISSUE_S)}The alert is issued ${alert} s after ignition. This baseline is applied identically under Last Mile, which only adds dispatched help on top of it.`,
  ];
}
