'use client';
import { useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDroppable, useDraggable, type DragEndEvent } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';
import { useContextPane } from '@/hooks/useContextPane';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isAtLeast } from '@/lib/breakpoints';
import { AREA_SERIES, HORIZON_LABEL, type Horizon, type Trajectory } from '@/lib/constants';
import { formatDelta } from '@/lib/format';
import type { GoalNode } from '@/lib/client-api';
import { BlockBar, IconButton, TrajectoryChip } from '@/components/ui';

/**
 * Walking the hierarchy never loses your place: the tree stays put and the
 * detail opens beside it. Expansion state persists to the server, because it
 * encodes which parts of your life you are currently working on.
 */
export function GoalTree({
  areas,
  onAddChild,
  onReparent,
}: {
  areas: { area: string; goals: GoalNode[]; progress: number; delta7: number }[];
  onAddChild?: (parentId: string | null, area: string) => void;
  onReparent?: (childId: string, parentId: string) => void;
}) {
  const bp = useBreakpoint();
  const expanded = useApp((s) => s.ui.goal_tree_expanded);
  const setUi = useApp((s) => s.setUi);
  const { open, objectId } = useContextPane();

  // On a phone the tree collapses to depth 2 and the detail becomes a route.
  const maxDepth = isAtLeast(bp, 'tablet') ? 99 : 2;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function toggle(id: string) {
    setUi({
      goal_tree_expanded: expanded.includes(id)
        ? expanded.filter((x) => x !== id)
        : [...expanded, id],
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const child = String(e.active.id);
    const parent = e.over ? String(e.over.id) : null;
    if (parent && parent !== child) onReparent?.(child, parent);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col">
        {areas.map((a) => {
          const areaOpen = !expanded.includes(`area:${a.area}`);
          return (
            <section key={a.area}>
              <div className="group/row flex h-row items-center gap-sm rounded-sm px-xs hover:bg-surface-1">
                <IconButton
                  label={areaOpen ? `Collapse ${a.area}` : `Expand ${a.area}`}
                  onClick={() => toggle(`area:${a.area}`)}
                >
                  {areaOpen ? <ChevronDown size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />}
                </IconButton>
                <span
                  aria-hidden
                  className="size-[6px] shrink-0 rounded-full"
                  style={{ background: `var(--series-${AREA_SERIES[a.area] ?? 10})` }}
                />
                <span className="t-subheading flex-1 truncate">
                  {a.area.charAt(0).toUpperCase() + a.area.slice(1)}
                </span>
                <span className="t-numeric w-[42px] shrink-0 text-right tabular">{a.progress}%</span>
                <span className="t-caption w-[40px] shrink-0 text-ink-subtle tabular">
                  {formatDelta(a.delta7)}
                </span>
                <div className="row-actions">
                  <IconButton label={`Add a goal to ${a.area}`} onClick={() => onAddChild?.(null, a.area)}>
                    <Plus size={14} strokeWidth={1.5} />
                  </IconButton>
                </div>
              </div>

              {areaOpen
                ? a.goals.map((g) => (
                    <TreeRow
                      key={g.id}
                      node={g}
                      depth={1}
                      maxDepth={maxDepth}
                      expanded={expanded}
                      selectedId={objectId}
                      onToggle={toggle}
                      onOpen={open}
                      onAddChild={(id) => onAddChild?.(id, a.area)}
                    />
                  ))
                : null}
            </section>
          );
        })}
      </div>
    </DndContext>
  );
}

function TreeRow({
  node, depth, maxDepth, expanded, selectedId, onToggle, onOpen, onAddChild,
}: {
  node: GoalNode;
  depth: number;
  maxDepth: number;
  expanded: string[];
  selectedId: string | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && depth < maxDepth && !expanded.includes(`closed:${node.id}`);
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: node.id });
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: node.id });

  return (
    <>
      <div
        ref={dropRef}
        className={cn(
          'group/row flex h-row-compact items-center gap-sm rounded-sm px-xs',
          'transition-colors duration-[120ms]',
          selectedId === node.id ? 'bg-surface-2' : 'hover:bg-surface-1',
          isOver && 'bg-surface-2',
          isDragging && 'opacity-40',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          <IconButton
            label={isOpen ? `Collapse ${node.title}` : `Expand ${node.title}`}
            onClick={() => onToggle(`closed:${node.id}`)}
          >
            {isOpen ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronRight size={13} strokeWidth={1.5} />}
          </IconButton>
        ) : (
          <span className="size-control-sm shrink-0" />
        )}

        <button
          ref={dragRef}
          onClick={() => onOpen(node.id)}
          className="flex min-w-0 flex-1 items-center gap-sm text-left"
          {...attributes}
          {...listeners}
        >
          {node.horizon ? (
            <span className="t-micro w-[26px] shrink-0 text-ink-faint">{node.horizon}</span>
          ) : null}
          <span className="t-body-sm truncate">{node.title}</span>
        </button>

        <BlockBar value={node.progress} cells={8} />
        <span className="t-numeric w-[38px] shrink-0 text-right tabular">
          {Math.round(node.progress)}%
        </span>
        <span className="t-caption w-[34px] shrink-0 text-ink-subtle tabular">
          {node.delta7 ? formatDelta(node.delta7) : ''}
        </span>
        <span className="w-[64px] shrink-0">
          <TrajectoryChip trajectory={node.trajectory as Trajectory} withDot={false} />
        </span>

        <div className="row-actions">
          <IconButton label={`Add a child goal to ${node.title}`} onClick={() => onAddChild(node.id)}>
            <Plus size={13} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>

      {isOpen
        ? node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              maxDepth={maxDepth}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onOpen={onOpen}
              onAddChild={onAddChild}
            />
          ))
        : null}
    </>
  );
}

export function horizonLabel(h: string | null) {
  return h ? (HORIZON_LABEL[h as Horizon] ?? h) : '';
}
