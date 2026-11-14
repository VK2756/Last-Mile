'use client';
import { Drawer, SimBadge } from '@/components/ui';

/** Honesty: SimInit.assumptions must always be one click away. */
export function AssumptionsDrawer({ open, onClose, assumptions, mock }: { open: boolean; onClose: () => void; assumptions: string[]; mock: boolean }) {
  return (
    <Drawer open={open} onClose={onClose} title="Modelling assumptions" eyebrow="What this simulation assumes">
      <SimBadge mock={mock} className="mb-4" />
      <p className="mb-4 text-sm text-fg-muted">
        Everything on this map is a simulation with synthetic residents and helpers. These are the assumptions the run is built on:
      </p>
      <ol className="space-y-3">
        {assumptions.map((a, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="tabular mt-0.5 font-mono text-xs text-fg-dim">{String(i + 1).padStart(2, '0')}</span>
            <span>{a}</span>
          </li>
        ))}
        {assumptions.length === 0 && <li className="text-sm text-fg-dim">Waiting for the scenario to start…</li>}
      </ol>
    </Drawer>
  );
}
