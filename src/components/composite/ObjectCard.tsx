'use client';
import { forwardRef } from 'react';
import { Lock, Repeat, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDue } from '@/lib/format';
import { AREA_SERIES } from '@/lib/constants';
import type { SerializedObject } from '@/lib/client-api';
import { CategoryChip, ContextMenu, Meta, type MenuItem } from '@/components/ui';

export interface ObjectCardProps extends React.HTMLAttributes<HTMLDivElement> {
  object: SerializedObject;
  unblocks?: number;
  blockedBy?: { id: string; title: string }[];
  selected?: boolean;
  dragging?: boolean;
  menuItems?: MenuItem[];
  onOpen?: () => void;
}

/**
 * One of the few places a bordered container is correct, because a card
 * genuinely is a discrete movable object.
 */
export const ObjectCard = forwardRef<HTMLDivElement, ObjectCardProps>(function ObjectCard(
  { object, unblocks = 0, blockedBy = [], selected, dragging, menuItems = [], onOpen, className, ...rest },
  ref,
) {
  const card = (
    <div
      ref={ref}
      onClick={onOpen}
      className={cn(
        'flex cursor-default flex-col gap-xs rounded-md border bg-canvas p-sm',
        'transition-colors duration-[120ms]',
        dragging ? 'border-hairline-strong shadow-drag' : 'border-hairline',
        selected && 'bg-surface-2',
        className,
      )}
      {...rest}
    >
      <span className={cn('t-body-sm line-clamp-2', object.completedAt && 'text-ink-faint line-through')}>
        {object.title}
      </span>

      <div className="flex flex-wrap items-center gap-xs">
        {object.area ? (
          <CategoryChip series={AREA_SERIES[object.area] ?? 10}>{object.area}</CategoryChip>
        ) : null}
        {object.dueAt ? <Meta>{formatDue(object.dueAt)}</Meta> : null}
        {object.rrule ? (
          <span className="text-ink-subtle">
            <Repeat size={11} strokeWidth={1.5} />
          </span>
        ) : null}
        {unblocks > 0 ? (
          <span className="t-micro flex items-center gap-px text-ink-subtle tabular">
            <Zap size={11} strokeWidth={1.5} />
            {unblocks}
          </span>
        ) : null}
        {blockedBy.length ? (
          <span
            className="text-ink-subtle"
            title={`Blocked by ${blockedBy.map((b) => b.title).join(', ')}`}
          >
            <Lock size={11} strokeWidth={1.5} />
          </span>
        ) : null}
      </div>
    </div>
  );

  return menuItems.length ? <ContextMenu items={menuItems}>{card}</ContextMenu> : card;
});
