'use client';
import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners,
  useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { BOARD_COLUMNS } from '@/lib/constants';
import type { SerializedObject } from '@/lib/client-api';
import { useBulkAction, useUpdateObject } from '@/hooks/useObjects';
import { useSelection } from '@/hooks/useSelection';
import { useContextPane } from '@/hooks/useContextPane';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { boardColumnsVisible } from '@/lib/breakpoints';
import { ObjectCard } from '@/components/composite/ObjectCard';
import { Button, EmptyState, Segmented, useToast } from '@/components/ui';

/**
 * One dnd-kit configuration covers mouse, finger and keyboard. The touch sensor
 * has a 250ms delay and 5px tolerance so a drag never fights a scroll, and the
 * keyboard sensor gives the same operation without a pointer at all.
 */
export function Board({
  objects,
  loading,
  unblocks = {},
  blockedBy = {},
  /** The idea pipeline and the task board are the same component with a
   *  different column set — one concept, one implementation. */
  columns = BOARD_COLUMNS as readonly { key: string; label: string }[],
  defaultColumn = 'today',
}: {
  objects: SerializedObject[];
  loading?: boolean;
  unblocks?: Record<string, number>;
  blockedBy?: Record<string, { id: string; title: string }[]>;
  columns?: readonly { key: string; label: string }[];
  defaultColumn?: string;
}) {
  const bp = useBreakpoint();
  const update = useUpdateObject();
  const bulk = useBulkAction();
  const { open } = useContextPane();
  const toast = useToast();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<SerializedObject | null>(null);
  const [phoneColumn, setPhoneColumn] = useState<string>(defaultColumn);

  const ordered = useMemo(() => objects.map((o) => o.id), [objects]);
  const { selection, onSelect, clear, isSelected } = useSelection(ordered);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const map: Record<string, SerializedObject[]> = {};
    for (const c of columns) map[c.key] = [];
    const fallback = columns[0]!.key;
    for (const o of objects) {
      const key =
        o.completedAt && map.done ? 'done' : (o.status && map[o.status] ? o.status : fallback);
      (map[key] ??= []).push(o);
    }
    return map;
  }, [objects, columns]);

  function onDragStart(e: DragStartEvent) {
    setDragging(objects.find((o) => o.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const overId = e.over?.id;
    if (!overId) return;

    const target = columns.find((c) => c.key === overId)
      ? String(overId)
      : (objects.find((o) => o.id === overId)?.status ?? null);
    if (!target) return;

    const moved = objects.find((o) => o.id === e.active.id);
    if (!moved || moved.status === target) return;

    const previous = moved.status;
    update.mutate({
      id: moved.id,
      patch: {
        status: target,
        ...(target === 'done'
          ? { completedAt: new Date().toISOString() }
          : previous === 'done'
            ? { completedAt: null }
            : {}),
      },
    });
    toast.show(`Moved to ${columns.find((c) => c.key === target)?.label}`, () => {
      update.mutate({ id: moved.id, patch: { status: previous, completedAt: null } });
    });
  }

  const visible = boardColumnsVisible(bp);

  // On a phone the board is a segmented control showing one column as a list.
  if (bp === 'phone') {
    return (
      <div className="flex flex-col gap-md">
        <div className="overflow-x-auto">
          <Segmented
            options={columns.map((c) => ({
              value: c.key,
              label: c.label,
              count: byStatus[c.key]?.length ?? 0,
            }))}
            value={phoneColumn as never}
            onChange={(v) => setPhoneColumn(v)}
          />
        </div>
        <div className="flex flex-col gap-sm">
          {(byStatus[phoneColumn] ?? []).map((o) => (
            <ObjectCard
              key={o.id}
              object={o}
              unblocks={unblocks[o.id]}
              blockedBy={blockedBy[o.id]}
              onOpen={() => open(o.id)}
            />
          ))}
          {!byStatus[phoneColumn]?.length ? <EmptyState message="Nothing here." /> : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-md overflow-x-auto pb-md">
          {columns.map((c, i) => (
            <Column
              key={c.key}
              id={c.key}
              label={c.label}
              items={byStatus[c.key] ?? []}
              unblocks={unblocks}
              blockedBy={blockedBy}
              isSelected={isSelected}
              onSelect={onSelect}
              onOpen={open}
              onStatus={(id, status) => update.mutate({ id, patch: { status } })}
              columns={columns}
              offScreen={i >= visible}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging ? <ObjectCard object={dragging} dragging className="w-[264px]" /> : null}
        </DragOverlay>
      </DndContext>

      {selection.length > 1 ? (
        <div className="anim-toast fixed bottom-lg left-1/2 z-40 flex -translate-x-1/2 items-center gap-sm rounded-md border border-hairline bg-canvas px-md py-sm shadow-popover">
          <span className="t-body-sm tabular">{selection.length} selected</span>
          <span className="h-[16px] w-px bg-hairline" />
          {columns.map((c) => (
            <Button
              key={c.key}
              size="sm"
              onClick={() =>
                bulk.mutate(
                  { ids: selection, action: 'status', payload: { status: c.key } },
                  { onSuccess: () => clear() },
                )
              }
            >
              {c.label}
            </Button>
          ))}
          <span className="h-[16px] w-px bg-hairline" />
          <Button
            size="sm"
            onClick={() =>
              bulk.mutate(
                { ids: selection, action: 'delete' },
                {
                  onSuccess: () => {
                    clear();
                    void qc.invalidateQueries({ queryKey: ['objects'] });
                  },
                },
              )
            }
          >
            Delete
          </Button>
          <Button size="sm" onClick={clear}>
            Cancel
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Column({
  id, label, items, unblocks, blockedBy, isSelected, onSelect, onOpen, onStatus, columns, offScreen,
}: {
  id: string;
  label: string;
  items: SerializedObject[];
  unblocks: Record<string, number>;
  blockedBy: Record<string, { id: string; title: string }[]>;
  isSelected: (id: string) => boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: string) => void;
  columns: readonly { key: string; label: string }[];
  offScreen: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={cn('flex w-[280px] shrink-0 flex-col gap-sm', offScreen && 'cv-auto')}
    >
      <header className="sticky top-0 z-10 flex items-baseline gap-sm bg-canvas pb-xs">
        <h2 className="t-micro text-ink-subtle">{label}</h2>
        <span className="t-micro text-ink-faint tabular">{items.length}</span>
      </header>

      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            'flex min-h-[80px] flex-col gap-sm rounded-md',
            isOver && 'bg-surface-1',
          )}
        >
          {items.map((o) => (
            <SortableCard
              key={o.id}
              object={o}
              unblocks={unblocks[o.id]}
              blockedBy={blockedBy[o.id]}
              selected={isSelected(o.id)}
              onSelect={(e) => onSelect(o.id, e)}
              onOpen={() => onOpen(o.id)}
              onStatus={(status) => onStatus(o.id, status)}
              columns={columns}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  object, unblocks, blockedBy, selected, onSelect, onOpen, onStatus, columns,
}: {
  object: SerializedObject;
  unblocks?: number;
  blockedBy?: { id: string; title: string }[];
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onStatus: (status: string) => void;
  columns: readonly { key: string; label: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: object.id,
  });

  return (
    <ObjectCard
      ref={setNodeRef}
      object={object}
      unblocks={unblocks}
      blockedBy={blockedBy}
      selected={selected}
      className={isDragging ? 'opacity-40' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) onSelect(e);
        else onOpen();
      }}
      menuItems={[
        // Every drag operation has a menu equivalent, so drag is never required.
        {
          key: 'move',
          label: 'Move to',
          submenu: columns.map((c) => ({
            key: c.key,
            label: c.label,
            checked: object.status === c.key,
            onSelect: () => onStatus(c.key),
          })),
        },
        { key: 'open', label: 'Open', onSelect: onOpen },
      ]}
      {...attributes}
      {...listeners}
    />
  );
}
