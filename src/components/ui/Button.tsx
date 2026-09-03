'use client';
import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-action text-on-action hover:bg-action-hover active:bg-action-pressed',
  secondary: 'bg-canvas text-ink border border-hairline-strong hover:bg-surface-1',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
  // A danger button is a normal secondary button. The confirmation copy carries
  // the weight, not a red fill.
  danger: 'bg-transparent text-ink border border-hairline-strong hover:bg-surface-2',
};

const SIZE: Record<Size, string> = {
  sm: 'h-control-sm px-sm',
  md: 'h-control-md px-md',
  lg: 'h-control-lg px-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', asChild, loading, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      disabled={disabled || loading}
      data-loading={loading ? '' : undefined}
      className={cn(
        't-button inline-flex shrink-0 items-center justify-center gap-xs rounded-md',
        'transition-colors duration-[120ms] whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent',
        VARIANT[variant],
        SIZE[size],
        variant === 'ghost' && size === 'sm' && 'px-sm',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function IconButton({ className, label, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-control-sm shrink-0 items-center justify-center rounded-sm',
        'text-ink-subtle transition-colors duration-[120ms]',
        'hover:bg-surface-2 hover:text-ink',
        'disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
