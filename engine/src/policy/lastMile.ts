// OWNER: Lane A. What Last Mile adds on top of the alerts-only baseline: households that cannot drive out send a help request.
import type { Household } from '@lastmile/contracts';
import type { Behavior } from '../world/population';

/** seconds (sim time) when a help request reaches the dispatcher; Infinity if the household does not need to ask. */
export function helpRequestTime(h: Pick<Household, 'hasVehicle'>, b: Behavior, warnedAt: number): number {
  return h.hasVehicle ? Infinity : warnedAt + b.helpRequestDelayS;
}

export const LAST_MILE_ASSUMPTIONS = [
  'Last Mile: a household with no vehicle that is warned sends a help request 1 to 3 min later (voice triage / app / registry). Households with a vehicle are assumed to self-evacuate exactly as in the baseline.',
  'Helpers drive at road speed x1.3 congestion (same factor as evacuating residents), pick up on arrival at the home (visiting households in the order the dispatcher gives), and drop off at the nearest safe zone. Capacity counts people; only vans and buses carry wheelchair users.',
  'A household that gets a family pickup before the helper arrives leaves with the family; the helper is released and re-planned.',
];
