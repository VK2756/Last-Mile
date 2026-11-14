'use client';
import { Fragment } from 'react';
import { Kbd } from '@/components/ui';
import { SHORTCUTS } from '@/lib/keys';

/** "?" overlay listing the /live keyboard shortcuts. */
export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={onClose} data-testid="shortcuts-overlay">
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="w-full max-w-sm rounded-lg border border-line-strong bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-fg-dim">Keyboard</div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
          {SHORTCUTS.map((s) => (
            <Fragment key={s.label}>
              <dt className="flex gap-1">{s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</dt>
              <dd className="text-fg-muted">{s.label}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}
