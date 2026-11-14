import type { Metadata } from 'next';
import { DashboardView } from '@/components/story/DashboardView';

export const metadata: Metadata = {
  title: 'Dashboard · Last Mile',
  description: 'Time series for one simulated scenario: households at risk by status, minimum time to impact and dispatches per minute. Simulation with synthetic people.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
