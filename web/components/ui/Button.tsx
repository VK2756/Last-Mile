import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-bg hover:bg-[#5ff0d6] shadow-[0_0_0_1px_rgb(46_230_197/0.4),0_8px_24px_-8px_rgb(46_230_197/0.55)]',
  secondary: 'bg-surface-2 text-fg border border-line-strong hover:bg-surface-3 hover:border-fg-dim',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
};
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  xl: 'h-14 px-7 text-lg gap-3',
};

const BASE = 'inline-flex items-center justify-center rounded-md font-semibold tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40';

/** Button styling for things that aren't <button>s, e.g. a Next <Link>: <Link className={buttonClass({ variant: 'primary' })}> */
export function buttonClass({ variant = 'secondary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, className })}
      {...rest}
    />
  );
});
