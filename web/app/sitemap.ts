import type { MetadataRoute } from 'next';
import { serverSiteUrl } from '@/lib/site';

const PATHS = ['/', '/live', '/results', '/how-it-works', '/call', '/dashboard'];

/** Absolute URLs from NEXT_PUBLIC_SITE_URL (else Vercel's production URL, else localhost). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = serverSiteUrl() || 'http://localhost:3000';
  return PATHS.map((p) => ({ url: `${base}${p === '/' ? '' : p}`, changeFrequency: 'daily', priority: p === '/' ? 1 : 0.8 }));
}
