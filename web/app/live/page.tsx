import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LiveView } from '@/components/live/LiveView';

export const metadata: Metadata = { title: 'Live · Last Mile' };

export default function LivePage() {
  return (
    <Suspense fallback={<div className="ops-grid h-dvh" />}>
      <LiveView />
    </Suspense>
  );
}
