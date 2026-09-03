'use client';
import { cn } from '@/lib/utils';

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex shrink-0 items-center gap-0 rounded-md bg-surface-2 p-xxs',
        size === 'sm' ? 'h-control-sm' : 'h-control-md',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            't-button flex h-full items-center gap-xs rounded-sm px-sm transition-colors duration-[120ms]',
            value === o.value ? 'bg-canvas text-ink' : 'text-ink-subtle hover:text-ink-muted',
          )}
        >
          {o.label}
          {o.count != null ? <span className="t-micro text-ink-faint tabular">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
