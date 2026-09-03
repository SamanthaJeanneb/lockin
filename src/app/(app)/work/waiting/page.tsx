'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { api, type SerializedObject } from '@/lib/client-api';
import { useOptimisticComplete } from '@/hooks/useObjects';
import { useApp } from '@/lib/store';
import { useContextPane } from '@/hooks/useContextPane';
import { DataTable, type Column } from '@/components/views/DataTable';
import { Button, Skeleton } from '@/components/ui';

export default function WaitingPage() {
  const complete = useOptimisticComplete();
  const openModal = useApp((s) => s.openModal);
  const { open, objectId } = useContextPane();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['objects', { type: 'waiting_on' }],
    queryFn: () =>
      api.get<{ objects: SerializedObject[] }>('/api/objects?type=waiting_on&completed=false&limit=200'),
  });

  const columns: Column<SerializedObject>[] = [
    {
      key: 'title',
      header: 'Waiting for',
      width: '40%',
      sortValue: (r) => r.title,
      render: (r) => r.title,
    },
    {
      key: 'area',
      header: 'Area',
      from: 'tablet',
      width: '16%',
      render: (r) => r.area ?? '—',
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right',
      width: '12%',
      sortValue: (r) => differenceInCalendarDays(new Date(), new Date(r.createdAt)),
      render: (r) => `${differenceInCalendarDays(new Date(), new Date(r.createdAt))}d`,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '24%',
      render: (r) => (
        <span className="flex justify-end gap-xs" onClick={(e) => e.stopPropagation()}>
          {/* Nudge opens a pre-drafted message rather than sending anything. */}
          <Button size="sm" onClick={() => openModal('capture', `Nudge about: ${r.title}`)}>
            Nudge
          </Button>
          <Button
            size="sm"
            onClick={() => {
              complete.mutate({ id: r.id, completed: true, title: r.title });
              void qc.invalidateQueries({ queryKey: ['objects'] });
            }}
          >
            Received
          </Button>
        </span>
      ),
    },
  ];

  if (isLoading) return <Skeleton className="h-[240px] w-full" />;

  return (
    <DataTable
      rows={data?.objects ?? []}
      columns={columns}
      selectedId={objectId}
      onOpen={(r) => open(r.id)}
      empty="Nothing outstanding. Capture “waiting on Sarah for feedback” and it lands here."
      defaultSort={{ key: 'days', dir: 'desc' }}
    />
  );
}
