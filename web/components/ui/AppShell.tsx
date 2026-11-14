'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

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
      <header className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-bg/90 px-4 backdrop-blur">
        <Link href="/" className="rounded focus-visible:outline-2 focus-visible:outline-accent" aria-label="Last Mile home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map((n) => {
            const active = path === n.href || path?.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                prefetch={n.prefetch}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative h-14 px-3 text-sm font-medium leading-[3.5rem] transition-colors',
                  active ? 'text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                {n.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3">{right}</div>
      </header>
      <main className={cn('flex-1', fullBleed && 'min-h-0')}>{children}</main>
    </div>
  );
}
