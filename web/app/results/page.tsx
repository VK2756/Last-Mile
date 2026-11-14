import type { Metadata } from 'next';
import { ResultsView } from '@/components/story/ResultsView';

export const metadata: Metadata = {
  title: 'Results · Last Mile',
  description: 'Monte Carlo comparison of alerts-only vs Last Mile evacuation dispatch, with 95% confidence intervals. Simulation with synthetic people.',
};

export default function ResultsPage() {
  return <ResultsView />;
}
