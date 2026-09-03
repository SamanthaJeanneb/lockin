'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { api, type SerializedObject } from '@/lib/client-api';
import { useApp } from '@/lib/store';
import { useContextPane } from '@/hooks/useContextPane';
import { DataTable, type Column } from '@/components/views/DataTable';
import { Avatar, Button, Meta, Skeleton } from '@/components/ui';

interface PersonProps {
  company?: string;
  role?: string;
  cadence_days?: number | null;
  last_interaction?: string;
  birthday?: string;
}

/**
 * Default sort is reach-out priority: how far past the learned cadence each
 * relationship is. The cadence itself is the rolling median of interaction gaps.
 */
export default function PeoplePage() {
  const openModal = useApp((s) => s.openModal);
  const { open, objectId } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['objects', { type: 'person' }],
    queryFn: () => api.get<{ objects: SerializedObject[] }>('/api/objects?type=person&limit=500'),
  });

  const rows = useMemo(() => {
    return (data?.objects ?? []).map((p) => {
      const props = p.props as PersonProps;
      const last = props.last_interaction ? new Date(props.last_interaction) : null;
      const days = last ? differenceInCalendarDays(new Date(), last) : null;
      const cadence = props.cadence_days ?? null;
      const overdueBy = days != null && cadence ? days - cadence : null;
      return { ...p, days, cadence, overdueBy, company: props.company ?? null, birthday: props.birthday ?? null };
    });
  }, [data]);

  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Person',
      width: '26%',
      sortValue: (r) => r.title,
      render: (r) => (
        <span className="flex items-center gap-sm">
          <Avatar name={r.title} />
          {r.title}
        </span>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      from: 'tablet',
      width: '20%',
      sortValue: (r) => r.company ?? '',
      render: (r) => r.company ?? '—',
    },
    {
      key: 'last',
      header: 'Last',
      align: 'right',
      width: '10%',
      sortValue: (r) => r.days ?? -1,
      render: (r) => (r.days == null ? '—' : r.days === 0 ? 'today' : `${r.days}d`),
    },
    {
      key: 'cadence',
      header: 'Cadence',
      from: 'compact',
      align: 'right',
      width: '12%',
      sortValue: (r) => r.cadence ?? 0,
      render: (r) => (r.cadence ? `${r.cadence}d` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      from: 'tablet',
      width: '16%',
      sortValue: (r) => -(r.overdueBy ?? -999),
      render: (r) => (
        <Meta>
          {r.overdueBy != null && r.overdueBy > 0
            ? `overdue by ${r.overdueBy}d`
            : r.days === 0
              ? 'new'
              : 'ok'}
          {r.birthday && differenceInCalendarDays(new Date(r.birthday), new Date()) <= 2
            ? ' · birthday soon'
            : ''}
        </Meta>
      ),
    },
    {
      key: 'actions',
      header: '',
      from: 'compact',
      align: 'right',
      width: '16%',
      render: (r) => (
        <span className="flex justify-end gap-xs" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => openModal('capture', `@${r.title} — `)}>
            Log
          </Button>
          <Button size="sm" onClick={() => openModal('capture', `Draft a message to ${r.title}: `)}>
            Draft
          </Button>
        </span>
      ),
    },
  ];

  if (isLoading) return <Skeleton className="m-xl h-[300px]" />;

  return (
    <div className="flex min-h-full flex-col p-xl">
      <header className="mb-lg flex items-center justify-between gap-md">
        <h1 className="t-display">People</h1>
        <Button variant="primary" onClick={() => openModal('capture', 'Met ')}>
          Log an interaction
        </Button>
      </header>

      <DataTable
        rows={rows}
        columns={columns}
        selectedId={objectId}
        onOpen={(r) => open(r.id)}
        empty="No one yet. Capture “Coffee with Sarah, she recommended The Mom Test” and the person, the interaction and the book all appear."
        defaultSort={{ key: 'status', dir: 'asc' }}
      />
    </div>
  );
}
