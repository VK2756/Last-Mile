import { describe, expect, it } from 'vitest';
import { buttonClass } from '../components/ui/Button';
import { eyebrowClass } from '../components/ui/SectionHeading';
import { configuredSiteUrl, demoUrl, siteOrigin } from '../lib/site';

describe('shared UI kit helpers', () => {
  it('buttonClass gives links the same styling as <Button>', () => {
    const c = buttonClass({ variant: 'primary', size: 'lg', className: 'w-full' });
    expect(c).toContain('bg-accent');
    expect(c).toContain('h-12');
    expect(c).toContain('focus-visible:outline-accent');
    expect(c).toContain('w-full');
    expect(buttonClass()).toContain('bg-surface-2');
  });
  it('eyebrowClass is the one kicker style', () => {
    expect(eyebrowClass()).toContain('text-fire');
    expect(eyebrowClass('accent')).toContain('text-accent');
    expect(eyebrowClass()).toContain('tracking-[0.2em]');
  });
});

// demoUrl/siteOrigin live in lib/site.ts (no React or component imports), so these tests have no
// cold component import to time out on a loaded laptop (#108).
describe('demo link', () => {
  it('points at /live on this deployment, without presenter flags', () => {
    expect(demoUrl('https://last-mile-seven.vercel.app')).toBe('https://last-mile-seven.vercel.app/live');
    expect(demoUrl('http://localhost:3102/')).toBe('http://localhost:3102/live');
  });
  it('uses NEXT_PUBLIC_SITE_URL when set, else the page origin', () => {
    expect(siteOrigin('https://x.vercel.app', 'https://lastmile.example/')).toBe('https://lastmile.example');
    expect(siteOrigin('https://x.vercel.app', '')).toBe('https://x.vercel.app');
    expect(siteOrigin('https://x.vercel.app', 'not a url')).toBe('https://x.vercel.app');
    expect(configuredSiteUrl(undefined)).toBe('');
  });
  it('qrcode encodes the URL', async () => {
    const QR = await import('qrcode');
    const svg = await QR.toString('https://last-mile-seven.vercel.app/live', { type: 'svg' });
    expect(svg.startsWith('<svg')).toBe(true);
  }, 20_000); // cold import of qrcode under a parallel verify run
});
