import type { Metadata } from 'next';
import { storyMeta } from '@/components/story/meta';
import { CallView } from '@/components/story/CallView';

export const metadata: Metadata = storyMeta(
  'Needs call · Last Mile',
  'Voice triage call screen: speech or typed answers become structured household needs. Simulation with synthetic residents.',
  '/call',
);

export default function CallPage() {
  return <CallView />;
}
