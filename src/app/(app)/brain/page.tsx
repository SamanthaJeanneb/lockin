'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api, type SerializedObject } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { formatDayHeading, relative } from '@/lib/format';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isAtLeast } from '@/lib/breakpoints';
import { iconFor } from '@/components/composite/ObjectDetail';
import { BlockEditor, WritingAssistant } from '@/components/editor/BlockEditor';
import { Board } from '@/components/views/Board';
import { IDEA_STAGES } from '@/lib/constants';
import {
  Button, Chip, Divider, EmptyState, Icon, Meta, SectionHeader, Segmented, Skeleton,
} from '@/components/ui';

const TABS = [
  { value: 'all', label: 'All', types: [] as string[] },
  { value: 'journal', label: 'Journal', types: ['journal'] },
  { value: 'thoughts', label: 'Thoughts', types: ['thought'] },
  { value: 'notes', label: 'Notes', types: ['note'] },
  { value: 'drafts', label: 'Drafts', types: ['draft'] },
  { value: 'ideas', label: 'Ideas', types: ['idea'] },
  { value: 'decisions', label: 'Decisions', types: ['decision'] },
  { value: 'saves', label: 'Saves', types: ['save', 'quote'] },
];

const ALL_TYPES = ['journal', 'thought', 'note', 'draft', 'idea', 'decision', 'quote', 'save'];

/** Two-pane by nature: a filterable stream on the left, the editor on the right.
 *  Journal entries are stored verbatim; the reflection panel never rewrites them. */
export default function BrainPage() {
  const bp = useBreakpoint();
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const types = TABS.find((t) => t.value === tab)?.types ?? [];
  const query = (types.length ? types : ALL_TYPES).map((t) => `type=${t}`).join('&');

  const { data, isLoading } = useQuery({
    queryKey: ['objects', { surface: 'brain', tab }],
    queryFn: () =>
      api.get<{ objects: SerializedObject[] }>(`/api/objects?${query}&order=created&dir=desc&limit=200`),
  });

  const current = data?.objects.find((o) => o.id === selected) ?? data?.objects[0] ?? null;

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.patch(`/api/objects/${id}`, { body }),
  });

  const create = useMutation({
    mutationFn: (type: string) =>
      api.post<{ object: SerializedObject }>('/api/objects', {
        type,
        title: type === 'journal' ? formatDayHeading(new Date()) : 'Untitled',
      }),
    onSuccess: (res) => {
      setSelected(res.object.id);
      setShowEditor(true);
      void qc.invalidateQueries({ queryKey: ['objects'] });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SerializedObject[]>();
    for (const o of data?.objects ?? []) {
      const key = format(new Date(o.createdAt), 'yyyy-MM-dd');
      (map.get(key) ?? map.set(key, []).get(key)!).push(o);
    }
    return [...map.entries()];
  }, [data]);

  const patterns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of data?.objects ?? []) {
      for (const t of ((o.props as { themes?: string[] }).themes ?? [])) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const twoPane = isAtLeast(bp, 'compact');

  // Ideas move through a pipeline rather than sitting in a stream, so the tab
  // renders the board instead of the two-pane layout.
  if (tab === 'ideas') {
    return (
      <div className="flex min-h-full flex-col p-xl">
        <header className="mb-lg flex flex-wrap items-center justify-between gap-md">
          <h1 className="t-display">Ideas</h1>
          <div className="flex items-center gap-sm">
            <div className="overflow-x-auto">
              <Segmented
                options={TABS.map(({ value, label }) => ({ value, label }))}
                value={tab as never}
                onChange={setTab}
                size="sm"
              />
            </div>
            <Button variant="primary" onClick={() => create.mutate('idea')}>
              New idea
            </Button>
          </div>
        </header>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : (
          <Board
            objects={data?.objects ?? []}
            columns={IDEA_STAGES}
            defaultColumn="raw"
          />
        )}
      </div>
    );
  }

  const stream = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-sm p-lg pb-sm">
        <div className="flex items-center justify-between gap-sm">
          <h1 className="t-heading">Brain</h1>
          <Button size="sm" variant="primary" onClick={() => create.mutate('journal')}>
            New entry
          </Button>
        </div>
        <div className="overflow-x-auto pb-xs">
          <Segmented options={TABS.map(({ value, label }) => ({ value, label }))} value={tab as never} onChange={setTab} size="sm" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-lg pb-lg">
        {isLoading ? (
          <div className="flex flex-col gap-xs">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-row w-full" />
            ))}
          </div>
        ) : grouped.length ? (
          grouped.map(([day, items]) => (
            <section key={day} className="mb-lg">
              <SectionHeader title={dayLabel(day)} size="micro" as="h2" />
              <div className="flex flex-col">
                {items.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setSelected(o.id);
                      setShowEditor(true);
                    }}
                    className={cn(
                      'flex h-row items-center gap-sm rounded-sm px-xs text-left',
                      current?.id === o.id ? 'bg-surface-2' : 'hover:bg-surface-1',
                    )}
                  >
                    <span className="text-ink-subtle">
                      <Icon name={iconFor(o.type)} size={14} />
                    </span>
                    <span className="t-body-sm min-w-0 flex-1 truncate">{o.title}</span>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            message="Nothing yet. Journal entries, notes and ideas all land here."
            action={<Button onClick={() => create.mutate('journal')}>Write something</Button>}
          />
        )}

        {patterns.length ? (
          <>
            <Divider clearance="md" />
            <SectionHeader title="Patterns" size="micro" as="h2" />
            <div className="flex flex-col gap-xs">
              {patterns.map(([theme, n]) => (
                <div key={theme} className="flex items-center gap-sm">
                  <span className="t-body-sm flex-1 truncate">“{theme}”</span>
                  <span className="t-numeric text-ink-subtle tabular">{n}×</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );

  const editor = current ? (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2xl">
      <h2 className="t-read-heading">{current.title}</h2>
      <Meta className="mb-lg mt-xxs block">
        {current.type} · {relative(current.createdAt)}
      </Meta>

      <BlockEditor
        key={current.id}
        content={current.body ?? ''}
        reading={current.type === 'journal'}
        placeholder={current.type === 'journal' ? 'How did today go?' : 'Start writing…'}
        onSave={(html) => save.mutate({ id: current.id, body: html })}
        onMention={(id) => {
          void api.post('/api/edges', { fromId: current.id, toId: id, rel: 'mentions' });
        }}
      />

      {current.type === 'draft' ? (
        <div className="mt-xl">
          <WritingAssistant
            text={current.body ?? ''}
            onResult={(next) => save.mutate({ id: current.id, body: next })}
          />
        </div>
      ) : null}

      {((current.props as { themes?: string[] }).themes ?? []).length ? (
        <>
          <Divider clearance="lg" />
          <details>
            <summary className="t-micro cursor-default text-ink-subtle">Reflection</summary>
            <div className="mt-sm flex flex-wrap gap-xs">
              {((current.props as { themes?: string[] }).themes ?? []).map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
            <p className="t-body-sm mt-sm text-ink-muted">
              Turn into →{' '}
              {['Goal', 'Task', 'Decision'].map((label) => (
                <button key={label} className="mr-sm underline decoration-hairline-strong">
                  {label}
                </button>
              ))}
            </p>
          </details>
        </>
      ) : null}
    </div>
  ) : (
    <div className="p-2xl">
      <EmptyState message="Pick something on the left, or start a new entry." />
    </div>
  );

  if (!twoPane) {
    return showEditor && current ? (
      <div className="flex min-h-full flex-col">
        <div className="border-b border-hairline px-lg py-sm">
          <Button size="sm" onClick={() => setShowEditor(false)}>
            ← Stream
          </Button>
        </div>
        {editor}
      </div>
    ) : (
      stream
    );
  }

  return (
    <div className="grid h-full grid-cols-[340px_1fr]">
      <div className="min-h-0 border-r border-hairline">{stream}</div>
      <div className="min-h-0">{editor}</div>
    </div>
  );
}

function dayLabel(day: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd');
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return format(new Date(day), 'd MMMM');
}
