'use client';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { api, type SerializedObject } from '@/lib/client-api';
import { BACKLOG_SECTIONS } from '@/lib/constants';
import { relative } from '@/lib/format';
import { useUpdateObject } from '@/hooks/useObjects';
import { useContextPane } from '@/hooks/useContextPane';
import { Button, EmptyState, Meta, SectionHeader, Skeleton, useToast } from '@/components/ui';

/** Items older than a year get an inline chip: still interested? */
export default function BacklogPage() {
  const update = useUpdateObject();
  const toast = useToast();
  const qc = useQueryClient();
  const { open } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['objects', { surface: 'backlog' }],
    queryFn: () =>
      api.get<{ objects: SerializedObject[] }>(
        '/api/objects?type=backlog_item&type=task&status=now&status=next&status=later&status=someday&status=maybe&status=backlog&completed=false&limit=400',
      ),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const bySection = useMemo(() => {
    const map: Record<string, SerializedObject[]> = {};
    for (const s of BACKLOG_SECTIONS) map[s.key] = [];
    for (const o of data?.objects ?? []) {
      const key = BACKLOG_SECTIONS.find((s) => s.key === o.status)?.key ?? 'someday';
      map[key]!.push(o);
    }
    return map;
  }, [data]);

  function onDragEnd(e: DragEndEvent) {
    const status = e.over ? String(e.over.id) : null;
    if (!status) return;
    const item = data?.objects.find((o) => o.id === e.active.id);
    if (!item || item.status === status) return;
    const previous = item.status;
    update.mutate({ id: item.id, patch: { status } });
    toast.show(`Moved to ${status}`, () => update.mutate({ id: item.id, patch: { status: previous } }));
  }

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-xl">
        {BACKLOG_SECTIONS.map((s) => (
          <Section
            key={s.key}
            id={s.key}
            label={s.label}
            items={bySection[s.key] ?? []}
            onOpen={open}
            onPromote={(id) => {
              update.mutate({ id, patch: { status: 'next' } });
              void qc.invalidateQueries({ queryKey: ['objects'] });
            }}
            onArchive={(id) => update.mutate({ id, patch: { archivedAt: new Date().toISOString() } })}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Section({
  id, label, items, onOpen, onPromote, onArchive,
}: {
  id: string;
  label: string;
  items: SerializedObject[];
  onOpen: (id: string) => void;
  onPromote: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section ref={setNodeRef} className={cn('rounded-sm', isOver && 'bg-surface-1')}>
      <SectionHeader title={label} size="micro" as="h2" count={items.length} />
      {items.length ? (
        <div className="flex flex-col">
          {items.map((o) => (
            <Row key={o.id} object={o} onOpen={onOpen} onPromote={onPromote} onArchive={onArchive} />
          ))}
        </div>
      ) : (
        <Meta>Nothing here.</Meta>
      )}
    </section>
  );
}

function Row({
  object, onOpen, onPromote, onArchive,
}: {
  object: SerializedObject;
  onOpen: (id: string) => void;
  onPromote: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: object.id });
  const ageDays = differenceInCalendarDays(new Date(), new Date(object.createdAt));
  const stale = ageDays > 365;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group/row flex h-row items-center gap-sm rounded-sm border-b border-hairline px-xs hover:bg-surface-1',
        isDragging && 'opacity-40',
      )}
      {...attributes}
      {...listeners}
    >
      <button onClick={() => onOpen(object.id)} className="t-body-sm min-w-0 flex-1 truncate text-left">
        {object.title}
      </button>
      <Meta>{relative(object.createdAt)}</Meta>
      {stale ? (
        <div className="flex items-center gap-xs">
          <Meta>Saved {Math.round(ageDays / 30)} months ago. Still interested?</Meta>
          <Button size="sm" onClick={() => onPromote(object.id)}>
            Promote
          </Button>
          <Button size="sm" onClick={() => onArchive(object.id)}>
            Archive
          </Button>
        </div>
      ) : null}
    </div>
  );
}
