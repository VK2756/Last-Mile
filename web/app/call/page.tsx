import type { Metadata } from 'next';
import { CallView } from '@/components/story/CallView';

export const metadata: Metadata = {
  title: 'Needs call · Last Mile',
  description: 'Voice triage call screen: speech or typed answers become structured household needs. Simulation with synthetic residents.',
};

export default function CallPage() {
  return <CallView />;
}
