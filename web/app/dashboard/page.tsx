import type { Metadata } from 'next';
import { storyMeta } from '@/components/story/meta';
import { DashboardView } from '@/components/story/DashboardView';

export const metadata: Metadata = storyMeta(
  'Dashboard · Last Mile',
  'Time series for one simulated scenario: households at risk by status, minimum time to impact and dispatches per minute. Simulation with synthetic people.',
  '/dashboard',
);

export default function DashboardPage() {
  return <DashboardView />;
}
