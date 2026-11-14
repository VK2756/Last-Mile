import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type HeadingTone = 'fire' | 'accent' | 'dim';
const TONE: Record<HeadingTone, string> = { fire: 'text-fire', accent: 'text-accent', dim: 'text-fg-dim' };

/** The small mono kicker above a section title. Use as a class when you only need the eyebrow. */
export const eyebrowClass = (tone: HeadingTone = 'fire') => cn('font-mono text-xs font-semibold uppercase tracking-[0.2em]', TONE[tone]);

/** Eyebrow + title + optional lede: the one section-heading style for every page. */
export function SectionHeading({ eyebrow, title, lede, as: Tag = 'h2', tone = 'fire', align = 'left', className, id }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  tone?: HeadingTone;
  align?: 'left' | 'center';
  className?: string;
  id?: string;
}) {
  return (
    <header className={cn('mb-6 max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow !== undefined && <p className={cn('mb-2', eyebrowClass(tone))}>{eyebrow}</p>}
      <Tag id={id} className={cn('font-semibold tracking-tight text-fg text-balance', Tag === 'h1' ? 'text-4xl sm:text-5xl' : Tag === 'h2' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl')}>
        {title}
      </Tag>
      {lede !== undefined && <p className="mt-3 text-base leading-relaxed text-fg-muted text-pretty">{lede}</p>}
    </header>
  );
}
