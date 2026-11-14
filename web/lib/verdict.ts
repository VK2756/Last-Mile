// End-of-run verdict, derived ONLY from the two runs' real final metrics (never hard-coded).
import type { Metrics, Policy } from '@lastmile/contracts';

export interface Verdict {
  winner: Policy | null;
  /** last_mile minus alerts_only */
  vulnerableDelta: number;
  trappedDelta: number;
  headline: string;
  detail: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Primary metric: vulnerable households evacuated; tie-break: fewer trapped. */
export function verdict(alerts: Metrics, lastMile: Metrics): Verdict {
  const vulnerableDelta = lastMile.vulnerableEvacuated - alerts.vulnerableEvacuated;
  const trappedDelta = lastMile.trapped - alerts.trapped;
  const winner: Policy | null = vulnerableDelta > 0 ? 'last_mile' : vulnerableDelta < 0 ? 'alerts_only' : trappedDelta < 0 ? 'last_mile' : trappedDelta > 0 ? 'alerts_only' : null;
  const vuln = `${lastMile.vulnerableEvacuated} vs ${alerts.vulnerableEvacuated} of ${lastMile.vulnerableTotal} vulnerable households evacuated`;
  const trapped = trappedDelta === 0 ? 'the same number trapped' : `${plural(Math.abs(trappedDelta), 'household', 'households')} ${trappedDelta < 0 ? 'fewer' : 'more'} trapped`;
  let headline: string;
  if (vulnerableDelta > 0) headline = `Last Mile got ${plural(vulnerableDelta, 'more vulnerable household', 'more vulnerable households')} out`;
  else if (vulnerableDelta < 0) headline = `Alerts only got ${plural(-vulnerableDelta, 'more vulnerable household', 'more vulnerable households')} out in this run`;
  else headline = 'Both policies got the same number of vulnerable households out';
  return { winner, vulnerableDelta, trappedDelta, headline, detail: `${vuln}; ${trapped} with Last Mile.` };
}
