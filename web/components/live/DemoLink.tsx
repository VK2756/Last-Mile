'use client';
import { useEffect, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui';

import { demoUrl, siteOrigin } from '@/lib/site';

export { demoUrl };

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API blocked (http, permissions): fall back to a hidden textarea
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** One-click "Copy demo link". */
export function CopyDemoLink() {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const ok = await copyText(demoUrl(siteOrigin(window.location.origin)));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };
  return (
    <Button size="sm" variant="ghost" onClick={onClick} data-testid="copy-demo-link" aria-live="polite">
      {copied ? <Check aria-hidden className="size-3.5 text-ok" /> : <Link2 aria-hidden className="size-3.5" />}
      {copied ? 'Copied' : 'Copy demo link'}
    </Button>
  );
}

/** Pitch mode: a QR code judges can scan to open the demo on their phones. */
export function DemoQr() {
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = demoUrl(siteOrigin(window.location.origin));
    setUrl(u);
    let alive = true;
    import('qrcode')
      .then((QR) => QR.toString(u, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#06080b', light: '#ffffff' } }))
      .then((s) => { if (alive) setSvg(s); })
      .catch((e) => console.warn('[qr] could not render', e));
    return () => { alive = false; };
  }, []);
  return (
    <figure className="glass flex items-center gap-4 rounded-xl p-3" data-testid="demo-qr">
      <div className="size-28 shrink-0 overflow-hidden rounded-md bg-white p-1" role="img" aria-label={`QR code for ${url}`}>
        {/* SVG generated locally by the qrcode library from our own URL */}
        {svg ? <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="skeleton size-full" />}
      </div>
      <figcaption className="min-w-0">
        <div className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-dim">Try it yourself</div>
        <div className="mt-1 break-all font-mono text-sm font-semibold text-accent">{url.replace(/^https?:\/\//, '')}</div>
        <div className="mt-1 text-xs text-fg-muted">Scan to open the live demo on your phone.</div>
      </figcaption>
    </figure>
  );
}
