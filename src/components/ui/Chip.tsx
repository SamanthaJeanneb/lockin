'use client';
import { cn } from '@/lib/utils';
import { TRAJECTORY_LABEL, TRAJECTORY_VAR, type Trajectory } from '@/lib/constants';

export function Chip({
  children,
  className,
  onClick,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      onClick={onClick}
      title={title}
      className={cn(
        't-micro inline-flex h-[18px] shrink-0 items-center gap-xs rounded-xs bg-surface-2 px-xs',
        'text-ink-muted',
        onClick && 'hover:bg-surface-3',
        className,
      )}
    >
      {children}
    </Comp>
  );
}

/** The 6px dot is the only chromatic pixel in a category chip. */
export function CategoryChip({
  series,
  children,
  className,
  onClick,
  title,
}: {
  series: number;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <Chip className={className} onClick={onClick} title={title}>
      <span
        aria-hidden
        className="size-[6px] shrink-0 rounded-full"
        style={{ background: `var(--series-${Math.min(10, Math.max(1, series))})` }}
      />
      {children}
    </Chip>
  );
}

/** Trajectory pairs its colour with a word, so colour never carries meaning alone. */
export function TrajectoryChip({
  trajectory,
  className,
  withDot = true,
}: {
  trajectory: Trajectory;
  className?: string;
  withDot?: boolean;
}) {
  if (trajectory === 'none') return null;
  return (
    <span
      className={cn('t-micro inline-flex shrink-0 items-center gap-xs', className)}
      style={{ color: TRAJECTORY_VAR[trajectory] }}
    >
      {withDot ? (
        <span
          aria-hidden
          className="size-[6px] shrink-0 rounded-full"
          style={{ background: TRAJECTORY_VAR[trajectory] }}
        />
      ) : null}
      {TRAJECTORY_LABEL[trajectory]}
    </span>
  );
}
