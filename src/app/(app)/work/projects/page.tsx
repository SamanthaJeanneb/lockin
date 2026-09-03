'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, type SerializedObject } from '@/lib/client-api';
import { formatDue, formatMinutes } from '@/lib/format';
import { useContextPane } from '@/hooks/useContextPane';
import { DataTable, type Column } from '@/components/views/DataTable';
import { CategoryChip, ProgressBar, Skeleton, TrajectoryChip } from '@/components/ui';
import { AREA_SERIES, type Trajectory } from '@/lib/constants';

export default function ProjectsPage() {
  const { open, objectId } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['objects', { type: 'project' }],
    queryFn: () => api.get<{ objects: SerializedObject[] }>('/api/objects?type=project&limit=200'),
  });

  const columns: Column<SerializedObject>[] = [
    {
      key: 'title',
      header: 'Project',
      width: '28%',
      sortValue: (r) => r.title,
      render: (r) => (
        <Link
          href={`/work/projects/${r.id}`}
          onClick={(e) => e.stopPropagation()}
          className="no-underline hover:underline"
        >
          {r.title}
        </Link>
      ),
    },
    {
      key: 'area',
      header: 'Area',
      from: 'tablet',
      width: '12%',
      sortValue: (r) => r.area ?? '',
      render: (r) =>
        r.area ? <CategoryChip series={AREA_SERIES[r.area] ?? 10}>{r.area}</CategoryChip> : '—',
    },
    {
      key: 'progress',
      header: 'Progress',
      width: '18%',
      sortValue: (r) => Number(r.progress),
      render: (r) => (
        <span className="flex items-center gap-sm">
          <ProgressBar value={Number(r.progress)} className="w-[80px]" label={r.title} />
          <span className="t-numeric tabular">{Math.round(Number(r.progress))}%</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      from: 'compact',
      width: '12%',
      sortValue: (r) => r.status ?? '',
      render: (r) => <TrajectoryChip trajectory={trajectory(r) as Trajectory} />,
    },
    {
      key: 'due',
      header: 'Due',
      from: 'tablet',
      align: 'right',
      width: '12%',
      sortValue: (r) => (r.dueAt ? new Date(r.dueAt).getTime() : Infinity),
      render: (r) => formatDue(r.dueAt),
    },
    {
      key: 'load',
      header: 'Load',
      from: 'standard',
      align: 'right',
      width: '10%',
      sortValue: (r) => r.estimateMinutes ?? 0,
      render: (r) => (r.estimateMinutes ? `${formatMinutes(r.estimateMinutes)}/wk` : '—'),
    },
  ];

  if (isLoading) return <Skeleton className="h-[300px] w-full" />;

  const active = (data?.objects ?? []).filter((p) => p.status !== 'parked');
  const parked = (data?.objects ?? []).filter((p) => p.status === 'parked');

  return (
    <div className="flex flex-col gap-xl">
      <DataTable
        rows={active}
        columns={columns}
        selectedId={objectId}
        onOpen={(r) => open(r.id)}
        empty="No projects yet. Create one from a goal, or capture a sentence describing it."
        defaultSort={{ key: 'due', dir: 'asc' }}
      />
      {parked.length ? (
        <details>
          <summary className="t-micro cursor-default text-ink-subtle">Parked · {parked.length}</summary>
          <div className="mt-sm">
            <DataTable rows={parked} columns={columns} onOpen={(r) => open(r.id)} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function trajectory(r: SerializedObject) {
  if (r.completedAt) return 'ahead';
  if (!r.dueAt) return 'none';
  const due = new Date(r.dueAt).getTime();
  if (due < Date.now()) return 'overdue';
  const start = r.startAt ? new Date(r.startAt).getTime() : new Date(r.createdAt).getTime();
  const elapsed = ((Date.now() - start) / (due - start)) * 100;
  const p = Number(r.progress);
  if (p >= elapsed + 5) return 'ahead';
  if (p >= elapsed - 5) return 'on_track';
  return 'behind';
}
