// Operator queue: threatened, unresolved households, most urgent first.
import type { Assignment, Household, HouseholdState, SimFrame, SimInit } from '@lastmile/contracts';
import { isVulnerable } from '@lastmile/contracts';

const DONE = new Set(['evacuated', 'trapped']);

export interface AtRiskRow { household: Household; state: HouseholdState; assignment: Assignment | undefined; vulnerable: boolean }

/** Threatened, unresolved households, most urgent first (ttiSeconds ascending). */
export function atRiskRows(init: SimInit | null, frame: SimFrame | null, vulnerableOnly = false): AtRiskRow[] {
  if (!init || !frame) return [];
  const byId = new Map(init.households.map((h) => [h.id, h]));
  const byHousehold = new Map<string, Assignment>();
  for (const a of frame.assignments) for (const id of a.householdIds) byHousehold.set(id, a);
  const rows: AtRiskRow[] = [];
  for (const state of frame.households) {
    if (state.ttiSeconds === null || DONE.has(state.status)) continue;
    const household = byId.get(state.id);
    if (!household) continue;
    const vulnerable = isVulnerable(household);
    if (vulnerableOnly && !vulnerable) continue;
    rows.push({ household, state, assignment: byHousehold.get(state.id), vulnerable });
  }
  return rows.sort((a, b) => (a.state.ttiSeconds as number) - (b.state.ttiSeconds as number) || a.household.id.localeCompare(b.household.id));
}
