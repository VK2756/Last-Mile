import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
      {icon && <div className="text-fg-dim">{icon}</div>}
      <div className="text-sm font-semibold">{title}</div>
      {children && <div className="max-w-sm text-sm text-fg-muted">{children}</div>}
      {action}
    </div>
  );
}
