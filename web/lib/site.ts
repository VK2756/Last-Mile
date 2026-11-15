// The public site URL. NEXT_PUBLIC_SITE_URL (e.g. https://lastmile.example) wins when set, so the
// demo link, QR code, Open Graph URLs and sitemap all point at the custom domain; otherwise the
// browser's own origin (client) or Vercel's production URL (server). Pure: no React, no DOM imports.

const clean = (u: string) => u.trim().replace(/\/+$/, '');

/** NEXT_PUBLIC_SITE_URL if set and valid http(s), else ''. */
export function configuredSiteUrl(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (!env) return '';
  const u = clean(env);
  return /^https?:\/\/[^/\s]+/.test(u) ? u : '';
}

/** Origin for links built in the browser: the configured site URL, else the current origin. */
export function siteOrigin(fallbackOrigin: string, env?: string): string {
  return configuredSiteUrl(env) || clean(fallbackOrigin);
}

/** Absolute site URL on the server (metadata, sitemap); '' when unknown. */
export function serverSiteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return configuredSiteUrl() || (vercel ? `https://${vercel}` : '');
}

/** The shareable demo URL: /live with no presenter flags. */
export function demoUrl(origin: string): string {
  return `${clean(origin)}/live`;
}
