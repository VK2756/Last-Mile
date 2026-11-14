import { cn } from '@/lib/cn';

/**
 * The model's assumptions (pass `SimInit.assumptions` or `MonteCarloComparison.assumptions`).
 * Honesty rule: every page that shows simulated outcomes keeps these one glance or one click away.
 */
export function AssumptionsList({ assumptions, className, empty = 'Waiting for the scenario to start…', dense = false }: {
  assumptions: readonly string[];
  className?: string;
  /** shown when the list is empty (e.g. before the engine answers) */
  empty?: string;
  dense?: boolean;
}) {
  return (
    <ol className={cn(dense ? 'space-y-2' : 'space-y-3', className)} aria-label="Simulation assumptions" data-testid="assumptions-list">
      {assumptions.map((a, i) => (
        <li key={i} className={cn('flex gap-3 leading-relaxed', dense ? 'text-xs' : 'text-sm')}>
          <span className="tabular mt-0.5 shrink-0 font-mono text-xs text-fg-dim" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
          <span>{a}</span>
        </li>
      ))}
      {assumptions.length === 0 && <li className="text-sm text-fg-dim">{empty}</li>}
    </ol>
  );
}
