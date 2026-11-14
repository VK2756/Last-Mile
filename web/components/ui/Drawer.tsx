'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  side?: 'right' | 'left';
  className?: string;
}

/** Slide-over sheet. Esc closes, focus moves into it, click on the scrim closes. */
export function Drawer({ open, onClose, title, eyebrow, children, side = 'right', className }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={cn('fixed inset-0 z-50', open ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!open}>
      <div className={cn('absolute inset-0 bg-black/55 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'absolute top-0 flex h-full w-full max-w-md flex-col border-line bg-surface shadow-2xl outline-none transition-transform duration-200',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {eyebrow && <div className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-dim">{eyebrow}</div>}
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-fg-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
