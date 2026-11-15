import type { MetadataRoute } from 'next';
import { serverSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = serverSiteUrl();
  return { rules: { userAgent: '*', allow: '/' }, ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}) };
}
