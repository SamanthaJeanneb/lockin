'use client';
import { cn } from '@/lib/utils';
import { Meta, Sparkline, TrajectoryChip } from '@/components/ui';
import type { Trajectory } from '@/lib/constants';

/** numeric-lg + sparkline + a trajectory word. The number is ink; only the word
 *  is ever chromatic. */
export function MetricTile({
  label,
  value,
  delta,
  history,
  trajectory,
  onClick,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  history?: number[];
  trajectory?: Trajectory;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex flex-col gap-xs border-b border-hairline py-md text-left',
        onClick && 'hover:bg-surface-1',
        className,
      )}
    >
      <span className="t-micro text-ink-subtle">{label}</span>
      <span className="t-numeric-lg">{value}</span>
      <div className="flex items-center gap-sm">
        {delta ? <Meta className="tabular">{delta}</Meta> : null}
        {trajectory ? <TrajectoryChip trajectory={trajectory} /> : null}
        {history?.length ? <Sparkline values={history} width={72} height={18} className="ml-auto" /> : null}
      </div>
    </Comp>
  );
}
