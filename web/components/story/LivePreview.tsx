'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { SimBadge, buttonClass } from '@/components/ui';
import { HeroMap } from './HeroMap';

/** The live split-screen, in its mock / maps-only / pitch / autoplay form. Owned by Lane B; flags documented in /live. */
export const LIVE_PREVIEW_SRC = '/live?mock=1&view=maps&pitch=1&auto=1';
const FRAME_W = 1280;
const FRAME_H = 720;

/**
 * Hero preview of the live demo: a muted, looping, non-interactive iframe of /live, scaled to fit.
 * Performance: renders the static illustration first and mounts the iframe only after the page has
 * loaded and the browser is idle. Phones and prefers-reduced-motion keep the static illustration.
 */
export function LivePreview() {
  const box = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [mount, setMount] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wide = window.matchMedia('(min-width: 768px)').matches;
    if (reduce || !wide) return;
    let cancelled = false;
    const go = () => {
      if (cancelled) return;
      if ('requestIdleCallback' in window) window.requestIdleCallback(() => !cancelled && setMount(true), { timeout: 2500 });
      else setTimeout(() => !cancelled && setMount(true), 1200);
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', go);
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setScale(e.contentRect.width / FRAME_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <figure className="relative m-0">
      <div
        ref={box}
        className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <HeroMap className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${loaded ? 'opacity-0' : 'opacity-100'}`} />
        {mount && (
          <iframe
            src={LIVE_PREVIEW_SRC}
            title="Live demo preview (simulation, mock data)"
            aria-hidden="true"
            tabIndex={-1}
            loading="lazy"
            onLoad={() => setTimeout(() => setLoaded(true), 900)}
            className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})` }}
          />
        )}
        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-bg/85 backdrop-blur">
          <SimBadge note={loaded ? 'live preview, mock data' : 'illustration'} />
        </span>
        <Link
          href="/live"
          className={buttonClass({ variant: 'secondary', size: 'sm', className: 'absolute bottom-3 right-3 bg-bg/85 backdrop-blur' })}
        >
          <Maximize2 aria-hidden className="size-3.5" /> Open full demo
        </Link>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.6875rem] text-fg-muted">
        <span>
          Left: <span className="text-[#c9a227]">alerts only</span>
        </span>
        <span>
          Right: <span className="text-accent">Last Mile</span>
        </span>
        <span className="text-fg-dim">Same fire, same synthetic town</span>
      </figcaption>
    </figure>
  );
}
