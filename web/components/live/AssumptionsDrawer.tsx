'use client';
import { AssumptionsList, Drawer, SimBadge } from '@/components/ui';

/** Honesty: SimInit.assumptions must always be one click away. */
export function AssumptionsDrawer({ open, onClose, assumptions, mock }: { open: boolean; onClose: () => void; assumptions: string[]; mock: boolean }) {
  return (
    <Drawer open={open} onClose={onClose} title="Modelling assumptions" eyebrow="What this simulation assumes">
      <SimBadge mock={mock} className="mb-4" />
      <p className="mb-4 text-sm text-fg-muted">
        Everything on this map is a simulation with synthetic residents and helpers. These are the assumptions the run is built on:
      </p>
      <AssumptionsList assumptions={assumptions} />
    </Drawer>
  );
}
