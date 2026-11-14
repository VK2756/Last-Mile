import type { Metadata } from 'next';
import { BarChart3 } from 'lucide-react';
import { AppShell, EmptyState, Panel, SimBadge } from '@/components/ui';

export const metadata: Metadata = { title: 'Results · Last Mile' };

// STUB: M3 (Lane B) replaces this with the Monte Carlo comparison (POST /montecarlo, 95% CIs).
export default function ResultsPage() {
  return (
    <AppShell right={<SimBadge />}>
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Panel eyebrow="Monte Carlo" title="Alerts only vs. Last Mile">
          <EmptyState icon={<BarChart3 className="size-8" />} title="Results are being computed">
            Outcome numbers come only from the Monte Carlo evaluator (hundreds of paired, seeded runs). This page fills in when it is wired up.
          </EmptyState>
        </Panel>
      </div>
    </AppShell>
  );
}
