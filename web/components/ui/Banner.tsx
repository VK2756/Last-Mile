import type { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle2, XOctagon } from 'lucide-react';
import { cn } from '@/lib/cn';

type BannerTone = 'info' | 'warn' | 'danger' | 'ok';
const STYLE: Record<BannerTone, string> = {
  info: 'border-info/40 bg-info/10 text-info',
  warn: 'border-warn/45 bg-warn/10 text-warn',
  danger: 'border-danger/45 bg-danger/10 text-danger',
  ok: 'border-ok/40 bg-ok/10 text-ok',
};
const ICON = { info: Info, warn: AlertTriangle, danger: XOctagon, ok: CheckCircle2 } as const;

export interface BannerProps {
  tone?: BannerTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Full-width status strip (e.g. "Engine unreachable — switch to mock"). Has an icon, never colour alone. */
export function Banner({ tone = 'info', title, children, action, className }: BannerProps) {
  const Icon = ICON[tone];
  return (
    <div role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'} className={cn('flex items-center gap-3 rounded-md border px-3 py-2', STYLE[tone], className)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{title}</span>
        {children && <span className="ml-2 text-fg-muted">{children}</span>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
