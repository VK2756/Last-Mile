'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';
import { buttonClass } from './Button';

/** Gemini Live voice intake (Lane C's /call/live). */
export const VOICE_AGENT_HREF = '/call/live';

// /call belongs to Lane C; don't prefetch it (avoids a 404 in the console before it exists).
const NAV = [
  { href: '/live', label: 'Live', prefetch: undefined },
  { href: '/results', label: 'Results', prefetch: undefined },
  { href: '/call', label: 'Call', prefetch: false },
] as const;

export interface AppShellProps {
  children: ReactNode;
  /** rendered at the right of the top bar (e.g. SimBadge, clock, status) */
  right?: ReactNode;
  /** full-bleed app layout (map pages) vs. scrolling document layout */
  fullBleed?: boolean;
}

/** Top bar + nav shared by every page (Lane C's /call uses it too). */
export function AppShell({ children, right, fullBleed = false }: AppShellProps) {
  const path = usePathname();
  return (
    <div className={cn('flex flex-col', fullBleed ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur sm:gap-4 sm:px-4">
        <Link href="/" className="rounded focus-visible:outline-2 focus-visible:outline-accent" aria-label="Last Mile home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex min-w-0 items-center overflow-x-auto sm:gap-1" data-dev-only>
          {NAV.map((n) => {
            const active = (path === n.href || path?.startsWith(`${n.href}/`)) && !path?.startsWith(VOICE_AGENT_HREF);
            return (
              <Link
                key={n.href}
                href={n.href}
                prefetch={n.prefetch}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative h-14 shrink-0 px-2 text-sm font-medium leading-[3.5rem] transition-colors sm:px-3',
                  active ? 'text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                {n.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <Link
          href={VOICE_AGENT_HREF}
          prefetch={false}
          aria-current={path?.startsWith(VOICE_AGENT_HREF) ? 'page' : undefined}
          data-dev-only
          data-testid="voice-agent-link"
          className={buttonClass({ variant: 'secondary', size: 'sm', className: cn('shrink-0', path?.startsWith(VOICE_AGENT_HREF) && 'border-accent/60 text-accent') })}
        >
          <Mic aria-hidden className="size-3.5 text-accent" />
          <span className="hidden lg:inline">Talk to the voice agent</span>
          <span className="lg:hidden">Voice agent</span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">{right}</div>
      </header>
      <main className={cn('flex-1', fullBleed && 'min-h-0')}>{children}</main>
    </div>
  );
}
