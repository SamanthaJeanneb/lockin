'use client';
import { cn } from '@/lib/utils';

/**
 * A smooth ink bar on a surface-3 track. The fill is never tinted by status —
 * trajectory is a word beside it, so colour is never the only signal.
 */
export function ProgressBar({
  value,
  className,
  label,
  height = 'sm',
}: {
  value: number;
  className?: string;
  label?: string;
  height?: 'sm' | 'md' | 'lg';
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-3',
        height === 'lg' ? 'h-md' : height === 'md' ? 'h-sm' : 'h-[4px]',
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-ink transition-[width] duration-[400ms] ease-token"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** The dense ASCII-style bar used in the goal tree and the area strip. */
export function BlockBar({ value, cells = 10 }: { value: number; cells?: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells);
  return (
    <span aria-hidden className="inline-flex gap-px">
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className={cn('h-[4px] w-[6px] rounded-[1px]', i < filled ? 'bg-ink' : 'bg-surface-3')}
        />
      ))}
    </span>
  );
}
