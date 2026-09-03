'use client';
import { memo, useState } from 'react';
import { Check, Clock, Lock, MoveUpRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDue, formatMinutes } from '@/lib/format';
import { AREA_SERIES, SNOOZE_OPTIONS } from '@/lib/constants';
import type { SerializedObject } from '@/lib/client-api';
import {
  CategoryChip, Checkbox, ContextMenu, IconButton, Menu, Meta, Tooltip, type MenuItem,
} from '@/components/ui';

export interface ObjectRowProps {
  object: SerializedObject;
  why?: string;
  unblocks?: number;
  blockedBy?: { id: string; title: string }[];
  selected?: boolean;
  focused?: boolean;
  onOpen?: () => void;
  onComplete?: (next: boolean) => void;
  onSnooze?: (option: string) => void;
  onSelect?: (e: React.MouseEvent) => void;
  menuItems?: MenuItem[];
  showArea?: boolean;
  className?: string;
}

/**
 * Type-agnostic: renders a task, a habit, a milestone or a waiting_on from the
 * same object shape. 36px, transparent, one hairline bottom rule, hover-revealed
 * actions that are always exposed to assistive technology.
 */
export const ObjectRow = memo(function ObjectRow({
  object,
  why,
  unblocks = 0,
  blockedBy = [],
  selected,
  focused,
  onOpen,
  onComplete,
  onSnooze,
  onSelect,
  menuItems = [],
  showArea = true,
  className,
}: ObjectRowProps) {
  const [completing, setCompleting] = useState(false);
  const done = Boolean(object.completedAt);
  const blocked = blockedBy.length > 0;

  const items: MenuItem[] = [
    { key: 'open', label: 'Open', onSelect: onOpen },
    {
      key: 'complete',
      label: done ? 'Mark not done' : 'Complete',
      shortcut: 'E',
      onSelect: () => onComplete?.(!done),
    },
    {
      key: 'snooze',
      label: 'Snooze',
      shortcut: 'S',
      submenu: SNOOZE_OPTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        onSelect: () => onSnooze?.(s.key),
      })),
    },
    ...menuItems,
  ];

  const row = (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={object.title}
      data-focused={focused ? '' : undefined}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) onSelect?.(e);
        else onOpen?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.();
      }}
      className={cn(
        'group/row flex h-row min-w-0 cursor-default items-center gap-sm rounded-sm border-b border-hairline px-sm',
        'transition-colors duration-[120ms]',
        selected ? 'bg-surface-2' : 'hover:bg-surface-1',
        focused && 'bg-surface-1',
        completing && 'row-completing',
        className,
      )}
    >
      <Checkbox
        checked={done}
        label={done ? `Mark ${object.title} not done` : `Complete ${object.title}`}
        onCheckedChange={(next) => {
          if (next) {
            setCompleting(true);
            setTimeout(() => setCompleting(false), 400);
          }
          onComplete?.(next);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-xs">
          <span className={cn('t-body truncate', done && 'text-ink-faint line-through')}>
            {object.title}
          </span>
          {blocked ? (
            <Tooltip content={`Blocked by ${blockedBy.map((b) => b.title).join(', ')}`}>
              <span className="shrink-0 text-ink-subtle">
                <Lock size={12} strokeWidth={1.5} />
              </span>
            </Tooltip>
          ) : null}
          {unblocks > 0 ? (
            <Tooltip content={`Unblocks ${unblocks} task${unblocks === 1 ? '' : 's'}`}>
              <span className="t-micro flex shrink-0 items-center gap-px text-ink-subtle tabular">
                <Zap size={11} strokeWidth={1.5} />
                {unblocks}
              </span>
            </Tooltip>
          ) : null}
        </div>
        {why ? <Meta className="truncate">{why}</Meta> : null}
      </div>

      <div className="flex shrink-0 items-center gap-sm">
        {showArea && object.area ? (
          <CategoryChip series={AREA_SERIES[object.area] ?? 10}>{object.area}</CategoryChip>
        ) : null}
        {object.estimateMinutes ? <Meta>{formatMinutes(object.estimateMinutes)}</Meta> : null}
        {object.dueAt ? <Meta>{formatDue(object.dueAt)}</Meta> : null}

        <div className="row-actions flex items-center gap-xxs">
          <IconButton
            label={done ? 'Mark not done' : 'Complete'}
            onClick={(e) => {
              e.stopPropagation();
              onComplete?.(!done);
            }}
          >
            <Check size={14} strokeWidth={1.5} />
          </IconButton>
          <Menu
            align="end"
            trigger={
              <IconButton label="Snooze" onClick={(e) => e.stopPropagation()}>
                <Clock size={14} strokeWidth={1.5} />
              </IconButton>
            }
            items={SNOOZE_OPTIONS.map((s) => ({
              key: s.key,
              label: s.label,
              onSelect: () => onSnooze?.(s.key),
            }))}
          />
          <IconButton
            label="Open detail"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.();
            }}
          >
            <MoveUpRight size={14} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>
    </div>
  );

  return <ContextMenu items={items}>{row}</ContextMenu>;
});
