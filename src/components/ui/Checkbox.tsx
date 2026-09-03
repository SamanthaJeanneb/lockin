'use client';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Circle for completable objects, square for filters. */
  shape?: 'circle' | 'square';
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  shape = 'circle',
  label,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={cn(
        'inline-flex size-icon shrink-0 items-center justify-center border',
        'transition-colors duration-[120ms]',
        shape === 'circle' ? 'rounded-full' : 'rounded-xs',
        checked
          ? 'border-ink bg-ink text-on-action'
          : 'border-hairline-strong bg-transparent hover:border-ink-subtle',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {checked ? <Check size={11} strokeWidth={2.5} /> : null}
    </button>
  );
}
