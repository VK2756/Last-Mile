import type { Metadata } from 'next';

/**
 * Page metadata with Open Graph + Twitter cards for the story pages (Lane E).
 * The image is app/opengraph-image.tsx; it is listed explicitly because a page-level `openGraph` replaces the inherited one.
 */
const IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: "Last Mile: live evacuation dispatch for people who can't drive out (simulation)" };

/** Absolute site URL for canonical/OG links: NEXT_PUBLIC_SITE_URL, else Vercel's production URL, else none (no canonical). */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

export function storyMeta(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    ...(SITE ? { metadataBase: new URL(SITE), alternates: { canonical: path } } : {}),
    openGraph: { title, description, url: path, siteName: 'Last Mile', type: 'website', locale: 'en_US', images: [IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [IMAGE.url] },
  };
}
