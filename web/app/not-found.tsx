import type { Metadata } from 'next';
import { NotFoundView } from '@/components/story/NotFoundView';

export const metadata: Metadata = { title: 'Not found · Last Mile', robots: { index: false } };

export default function NotFound() {
  return <NotFoundView />;
}
