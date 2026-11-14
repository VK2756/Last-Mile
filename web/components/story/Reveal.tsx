'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Scroll reveal. Server-renders visible (no-JS and crawlers see everything). After mount, elements that are
 * still below the fold fade/slide in once when they scroll into view. Does nothing under prefers-reduced-motion.
 */
export function Reveal({ children, className, delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'static' | 'hidden' | 'shown'>('static');

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on screen: leave it alone
    setState('hidden');
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        state !== 'static' && 'transition-[opacity,transform] duration-700 ease-out',
        state === 'hidden' && 'translate-y-4 opacity-0',
        state === 'shown' && 'translate-y-0 opacity-100',
        className,
      )}
      style={state !== 'static' && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
