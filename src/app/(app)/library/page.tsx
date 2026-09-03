'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SerializedObject } from '@/lib/client-api';
import { groupBy } from '@/lib/utils';
import { useContextPane } from '@/hooks/useContextPane';
import { Sparkline } from '@/components/ui/Sparkline';
import {
  Button, Chip, EmptyState, Meta, ProgressBar, SectionHeader, Segmented, Skeleton,
} from '@/components/ui';
import { useApp } from '@/lib/store';

const TABS = [
  { value: 'books', label: 'Books', types: ['book'] },
  { value: 'media', label: 'Media', types: ['media', 'podcast', 'video', 'course'] },
  { value: 'articles', label: 'Articles', types: ['article', 'save'] },
  { value: 'places', label: 'Places', types: ['place'] },
  { value: 'interests', label: 'Interests', types: ['interest', 'skill'] },
];

const STATUS_ORDER = ['want', 'unread', 'reading', 'listening', 'watching', 'taking', 'in_progress', 'finished', 'read', 'visited', 'abandoned', 'archived'];

export default function LibraryPage() {
  const [tab, setTab] = useState('books');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { open, objectId } = useContextPane();
  const openModal = useApp((s) => s.openModal);

  const types = TABS.find((t) => t.value === tab)!.types;
  const { data, isLoading } = useQuery({
    queryKey: ['objects', { surface: 'library', tab }],
    queryFn: () =>
      api.get<{ objects: SerializedObject[] }>(
        `/api/objects?${types.map((t) => `type=${t}`).join('&')}&limit=300`,
      ),
  });

  const groups = groupBy(data?.objects ?? [], (o) => o.status ?? 'want');
  const orderedGroups = Object.entries(groups).sort(
    (a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]),
  );

  return (
    <div className="flex min-h-full flex-col p-xl">
      <header className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <h1 className="t-display">Library</h1>
        <div className="flex items-center gap-sm">
          <Segmented options={TABS.map(({ value, label }) => ({ value, label }))} value={tab as never} onChange={setTab} size="sm" />
          <Segmented
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
            ]}
            value={view}
            onChange={setView}
            size="sm"
          />
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : !data?.objects.length ? (
        <EmptyState
          message="Nothing here yet."
          action={<Button onClick={() => openModal('capture', 'Started reading ')}>Add something</Button>}
        />
      ) : tab === 'interests' ? (
        <div className="grid gap-lg tablet:grid-cols-2 standard:grid-cols-3">
          {data.objects.map((o) => (
            <button
              key={o.id}
              onClick={() => open(o.id)}
              className="flex flex-col gap-sm border-b border-hairline pb-md text-left"
            >
              <span className="t-heading-sm">{o.title}</span>
              <Sparkline values={[2, 3, 3, 5, 4, 6, 8]} />
              <Meta>{o.status} · make this a goal</Meta>
            </button>
          ))}
        </div>
      ) : (
        orderedGroups.map(([status, items]) => (
          <section key={status} className="mb-xl">
            <SectionHeader title={status.replace('_', ' ')} size="micro" as="h2" count={items.length} />
            {view === 'grid' ? (
              <div className="grid gap-md tablet:grid-cols-3 standard:grid-cols-5 wide:grid-cols-6">
                {items.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => open(o.id)}
                    className={`flex flex-col gap-xs rounded-md border p-sm text-left transition-colors duration-[120ms] ${
                      objectId === o.id ? 'border-hairline-strong bg-surface-1' : 'border-hairline hover:bg-surface-1'
                    }`}
                  >
                    <span className="flex h-[80px] items-end rounded-sm bg-surface-2 p-sm">
                      <span className="t-micro text-ink-subtle">{o.type}</span>
                    </span>
                    <span className="t-body-sm line-clamp-2">{o.title}</span>
                    {(o.props as { author?: string }).author ? (
                      <Meta>{(o.props as { author?: string }).author}</Meta>
                    ) : null}
                    {Number(o.progress) > 0 && Number(o.progress) < 100 ? (
                      <ProgressBar value={Number(o.progress)} label={o.title} />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {items.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => open(o.id)}
                    className="flex h-row items-center gap-sm border-b border-hairline px-xs text-left hover:bg-surface-1"
                  >
                    <span className="t-body-sm flex-1 truncate">{o.title}</span>
                    {(o.props as { author?: string }).author ? (
                      <Meta>{(o.props as { author?: string }).author}</Meta>
                    ) : null}
                    <Chip>{o.type}</Chip>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
