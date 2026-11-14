// /live keyboard shortcuts (all modes; pitch mode advertises them). Pure so it can be unit-tested.
export type KeyAction = { type: 'space' } | { type: 'reset' } | { type: 'preset'; index: number } | { type: 'help' } | { type: 'escape' };

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Space'], label: 'Start, or pause / resume' },
  { keys: ['R'], label: 'Reset and run again' },
  { keys: ['1', '2', '3'], label: 'Run preset 1 / 2 / 3' },
  { keys: ['?'], label: 'Show / hide shortcuts' },
  { keys: ['Esc'], label: 'Close card or dialog' },
];

export interface KeyLike { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; target?: EventTarget | null }

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function keyAction(e: KeyLike): KeyAction | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const t = e.target as (HTMLElement & { isContentEditable?: boolean }) | null | undefined;
  if (t && (TYPING.has(t.tagName ?? '') || t.isContentEditable)) return e.key === 'Escape' ? { type: 'escape' } : null;
  switch (e.key) {
    case ' ': return { type: 'space' };
    case 'r': case 'R': return { type: 'reset' };
    case '1': case '2': case '3': return { type: 'preset', index: Number(e.key) - 1 };
    case '?': case '/': return { type: 'help' };
    case 'Escape': return { type: 'escape' };
    default: return null;
  }
}
