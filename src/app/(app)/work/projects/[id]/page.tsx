'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Diamond } from 'lucide-react';
import { api, type SerializedObject } from '@/lib/client-api';
import { formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useObject, useOptimisticComplete } from '@/hooks/useObjects';
import { useContextPane } from '@/hooks/useContextPane';
import {
  Button, Checkbox, Divider, EmptyState, Input, Meta, ProgressBar, SectionHeader, Skeleton, useToast,
} from '@/components/ui';

interface Tree {
  milestones: (SerializedObject & { tasks: SerializedObject[] })[];
  looseTasks: SerializedObject[];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const toast = useToast();
  const complete = useOptimisticComplete();
  const { open } = useContextPane();
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const { data: project } = useObject(id);

  const { data: tree, isLoading } = useQuery({
    queryKey: ['project-tree', id],
    queryFn: async () => {
      const ms = await api.get<{ objects: SerializedObject[] }>(
        `/api/objects?type=milestone&project=${id}&limit=100`,
      );
      const milestones = await Promise.all(
        ms.objects.map(async (m) => {
          const t = await api.get<{ objects: SerializedObject[] }>(
            `/api/objects?type=task&project=${m.id}&limit=200`,
          );
          return { ...m, tasks: t.objects };
        }),
      );
      const loose = await api.get<{ objects: SerializedObject[] }>(
        `/api/objects?type=task&project=${id}&limit=200`,
      );
      return { milestones, looseTasks: loose.objects } as Tree;
    },
  });

  const addTask = useMutation({
    mutationFn: (milestoneId: string) =>
      api.post('/api/objects', {
        type: 'task',
        title: draft,
        area: project?.object.area,
        status: 'backlog',
        linkTo: { id: milestoneId, rel: 'part_of' },
        props: { project_id: id },
      }),
    onSuccess: () => {
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['project-tree', id] });
    },
  });

  const addMilestone = useMutation({
    mutationFn: () =>
      api.post('/api/objects', {
        type: 'milestone',
        title: draft,
        area: project?.object.area,
        status: 'open',
        linkTo: { id, rel: 'part_of' },
      }),
    onSuccess: () => {
      setDraft('');
      setAdding(null);
      void qc.invalidateQueries({ queryKey: ['project-tree', id] });
    },
  });

  /** Regenerating preserves completed items — they are named in the prompt. */
  const breakdown = useMutation({
    mutationFn: () => api.post('/api/ai/breakdown', { objectId: id, apply: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project-tree', id] });
      toast.show('Broken down into milestones and tasks');
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Breakdown failed'),
  });

  if (!project) return <Skeleton className="h-[400px] w-full" />;

  const p = project.object;
  const openCount =
    (tree?.milestones ?? []).flatMap((m) => m.tasks).filter((t) => !t.completedAt).length +
    (tree?.looseTasks ?? []).filter((t) => !t.completedAt).length;

  return (
    <div className="flex flex-col">
      <Link href="/work/projects" className="t-caption mb-md flex w-fit items-center gap-xs text-ink-muted no-underline">
        <ArrowLeft size={14} strokeWidth={1.5} /> Work
      </Link>

      <h1 className="t-display">{p.title}</h1>
      <div className="mt-sm flex items-center gap-md">
        <ProgressBar value={Number(p.progress)} className="w-[180px]" label={p.title} />
        <Meta>
          {Math.round(Number(p.progress))}% · {openCount} open
          {p.dueAt ? ` · due ${formatDue(p.dueAt)}` : ''}
        </Meta>
      </div>

      {p.body ? <p className="t-body mt-md max-w-measure text-ink-muted">{p.body}</p> : null}

      <Divider clearance="lg" />

      {isLoading ? (
        <Skeleton className="h-[240px] w-full" />
      ) : (
        <div className="flex flex-col gap-xl">
          {(tree?.milestones ?? []).map((m) => (
            <section key={m.id}>
              <div className="flex items-center gap-sm">
                <span className={cn('text-ink', m.completedAt ? '' : 'opacity-60')}>
                  <Diamond size={14} strokeWidth={1.5} fill={m.completedAt ? 'currentColor' : 'none'} />
                </span>
                <button
                  onClick={() => open(m.id)}
                  className={cn('t-heading-sm text-left', m.completedAt && 'text-ink-faint line-through')}
                >
                  {m.title}
                </button>
                <Meta className="ml-auto">
                  {m.completedAt ? `✓ ${formatDue(m.completedAt)}` : m.dueAt ? `due ${formatDue(m.dueAt)}` : ''}
                </Meta>
              </div>

              <div className="mt-sm flex flex-col pl-lg">
                {m.tasks.map((t) => (
                  <label
                    key={t.id}
                    className="group/row flex h-row items-center gap-sm rounded-sm px-xs hover:bg-surface-1"
                  >
                    <Checkbox
                      checked={Boolean(t.completedAt)}
                      label={`Complete ${t.title}`}
                      onCheckedChange={(next) =>
                        complete.mutate({ id: t.id, completed: next, title: t.title })
                      }
                    />
                    <button
                      onClick={() => open(t.id)}
                      className={cn(
                        't-body-sm flex-1 truncate text-left',
                        t.completedAt && 'text-ink-faint line-through',
                      )}
                    >
                      {t.title}
                    </button>
                    {t.targetValue ? (
                      <Meta>
                        {Number(t.currentValue ?? 0)}/{Number(t.targetValue)}
                      </Meta>
                    ) : null}
                  </label>
                ))}

                {adding === m.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim()) addTask.mutate(m.id);
                    }}
                  >
                    <Input
                      autoFocus
                      value={draft}
                      placeholder="New task…"
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => !draft && setAdding(null)}
                      onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
                      className="mt-xs"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => setAdding(m.id)}
                    className="t-body-sm flex h-row items-center px-xs text-left text-ink-faint hover:text-ink-muted"
                  >
                    + Add task
                  </button>
                )}
              </div>
            </section>
          ))}

          {tree?.looseTasks.length ? (
            <section>
              <SectionHeader title="Unassigned tasks" size="micro" as="h3" />
              {tree.looseTasks.map((t) => (
                <label key={t.id} className="flex h-row items-center gap-sm rounded-sm px-xs hover:bg-surface-1">
                  <Checkbox
                    checked={Boolean(t.completedAt)}
                    label={`Complete ${t.title}`}
                    onCheckedChange={(next) => complete.mutate({ id: t.id, completed: next, title: t.title })}
                  />
                  <button onClick={() => open(t.id)} className="t-body-sm flex-1 truncate text-left">
                    {t.title}
                  </button>
                </label>
              ))}
            </section>
          ) : null}

          {!tree?.milestones.length && !tree?.looseTasks.length ? (
            <EmptyState
              message="No milestones yet."
              action={
                <Button variant="primary" onClick={() => breakdown.mutate()} disabled={breakdown.isPending}>
                  Break it down
                </Button>
              }
            />
          ) : null}
        </div>
      )}

      <Divider clearance="lg" />

      <div className="flex flex-wrap gap-sm">
        {adding === 'milestone' ? (
          <form
            className="flex gap-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) addMilestone.mutate();
            }}
          >
            <Input
              autoFocus
              value={draft}
              placeholder="New milestone…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
            />
            <Button type="submit" variant="primary">
              Add
            </Button>
          </form>
        ) : (
          <Button onClick={() => setAdding('milestone')}>+ Add milestone</Button>
        )}
        <Button onClick={() => breakdown.mutate()} disabled={breakdown.isPending}>
          {breakdown.isPending ? 'Working…' : 'Break down'}
        </Button>
      </div>
    </div>
  );
}
