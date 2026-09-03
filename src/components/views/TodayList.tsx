'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addHours } from 'date-fns';
import { api, type TodayItem } from '@/lib/client-api';
import { useOptimisticComplete, useUpdateObject } from '@/hooks/useObjects';
import { useContextPane } from '@/hooks/useContextPane';
import { useListShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SNOOZE_OPTIONS } from '@/lib/constants';
import { ObjectRow } from '@/components/composite/ObjectRow';
import { EmptyState, SectionHeader, Skeleton } from '@/components/ui';

export function TodayList({
  items,
  loading,
  title = 'Today',
  emptyMessage = 'Nothing scheduled. Capture something with C.',
}: {
  items: TodayItem[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
}) {
  const complete = useOptimisticComplete();
  const update = useUpdateObject();
  const { open } = useContextPane();
  const [focus, setFocus] = useState(0);
  const qc = useQueryClient();

  const done = items.filter((i) => i.object.completedAt).length;

  useListShortcuts({
    onMove: (d) => setFocus((f) => Math.max(0, Math.min(items.length - 1, f + d))),
    onOpen: () => items[focus] && open(items[focus]!.object.id),
    onComplete: () =>
      items[focus] &&
      complete.mutate({
        id: items[focus]!.object.id,
        completed: !items[focus]!.object.completedAt,
        title: items[focus]!.object.title,
      }),
    onSnooze: () =>
      items[focus] &&
      update.mutate({
        id: items[focus]!.object.id,
        patch: { snoozeUntil: addHours(new Date(), 24).toISOString() },
      }),
    onToday: () => items[focus] && update.mutate({ id: items[focus]!.object.id, patch: { status: 'today' } }),
    onPriority: (n) => items[focus] && update.mutate({ id: items[focus]!.object.id, patch: { priority: n } }),
    enabled: items.length > 0,
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-xs">
        <SectionHeader title={title} size="heading-sm" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-row w-full" />
        ))}
      </div>
    );
  }

  return (
    <section>
      <SectionHeader title={title} size="heading-sm" count={`${done} / ${items.length}`} />
      {items.length ? (
        <div role="list" className="flex flex-col">
          {items.map((item, i) => (
            <ObjectRow
              key={item.object.id}
              object={item.object}
              why={item.why}
              unblocks={item.unblocks}
              blockedBy={item.blockedBy}
              focused={i === focus}
              onOpen={() => {
                setFocus(i);
                open(item.object.id);
              }}
              onComplete={(next) =>
                complete.mutate({ id: item.object.id, completed: next, title: item.object.title })
              }
              onSnooze={(option) => {
                const opt = SNOOZE_OPTIONS.find((s) => s.key === option);
                update.mutate({
                  id: item.object.id,
                  patch: { snoozeUntil: addHours(new Date(), opt?.hours || 24).toISOString() },
                });
              }}
              menuItems={[
                {
                  key: 'today',
                  label: 'Move to Today',
                  shortcut: 'T',
                  separatorBefore: true,
                  onSelect: () => update.mutate({ id: item.object.id, patch: { status: 'today' } }),
                },
                {
                  key: 'someday',
                  label: 'Someday',
                  onSelect: () => update.mutate({ id: item.object.id, patch: { status: 'someday' } }),
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  separatorBefore: true,
                  onSelect: async () => {
                    await api.del(`/api/objects/${item.object.id}`);
                    void qc.invalidateQueries({ queryKey: ['today'] });
                  },
                },
              ]}
            />
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
}
