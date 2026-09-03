'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useObject, useOptimisticComplete, useUpdateObject } from '@/hooks/useObjects';
import { useContextPane } from '@/hooks/useContextPane';
import { formatDue } from '@/lib/format';
import { ENERGY, PRIORITIES, RELATION_LABEL, type Relation } from '@/lib/constants';
import {
  Button, Divider, FieldRow, Icon, InlineField, Meta, ProgressBar, SectionHeader, Skeleton,
  TrajectoryChip,
} from '@/components/ui';
import type { Trajectory } from '@/lib/constants';

/**
 * Type-agnostic detail. A task, a goal, a person and a book all render from the
 * same object shape — adding a type requires no new component.
 */
export function ObjectDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const { data, isLoading } = useObject(id);
  const update = useUpdateObject();
  const complete = useOptimisticComplete();
  const { open } = useContextPane();

  const grouped = useMemo(() => {
    const out = new Map<string, { id: string; title: string; type: string }[]>();
    for (const hop of data?.edges ?? []) {
      const label = RELATION_LABEL[hop.edge.rel as Relation] ?? hop.edge.rel;
      const key = hop.direction === 'out' ? label : `${label} ←`;
      const list = out.get(key) ?? [];
      list.push({ id: hop.other.id, title: hop.other.title, type: hop.other.type });
      out.set(key, list);
    }
    return out;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-sm p-lg">
        <Skeleton className="h-[22px] w-3/4" />
        <Skeleton className="h-[14px] w-1/2" />
        <Skeleton className="mt-md h-[120px] w-full" />
      </div>
    );
  }

  const o = data.object;
  const inferred = new Set(o.inferredFields ?? []);
  const set = (patch: Record<string, unknown>) => update.mutate({ id, patch });
  const progress = Number(o.progress ?? 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-lg">
      <div className="flex items-start gap-sm">
        <span className="mt-xxs text-ink-subtle">
          <Icon name={iconFor(o.type)} />
        </span>
        <h2 className="t-title min-w-0 flex-1">{o.title}</h2>
      </div>

      {data.why.length ? (
        <p className="t-caption mt-xs text-ink-muted">
          {data.why.map((w, i) => (
            <span key={w.id}>
              {i > 0 ? ' → ' : ''}
              <button className="underline decoration-hairline-strong" onClick={() => open(w.id)}>
                {w.title}
              </button>
            </span>
          ))}
        </p>
      ) : null}

      {(o.type === 'goal' || o.type === 'project' || o.type === 'milestone') && (
        <div className="mt-lg flex items-center gap-sm">
          <ProgressBar value={progress} className="flex-1" label={`${o.title} progress`} />
          <span className="t-numeric tabular">{Math.round(progress)}%</span>
          <TrajectoryChip trajectory={trajectoryOf(o) as Trajectory} />
        </div>
      )}

      <Divider clearance="md" />

      <div className="flex flex-col gap-xxs">
        {o.dueAt !== undefined && (
          <FieldRow label="Due">
            <InlineField
              kind="date"
              label="Due date"
              inferred={inferred.has('due_at')}
              value={o.dueAt ? o.dueAt.slice(0, 10) : ''}
              placeholder="—"
              onSave={(v) => set({ dueAt: v ? new Date(v).toISOString() : null })}
            />
          </FieldRow>
        )}
        <FieldRow label="Status">
          <InlineField
            kind="text"
            label="Status"
            inferred={inferred.has('status')}
            value={o.status ?? ''}
            onSave={(v) => set({ status: v || null })}
          />
        </FieldRow>
        <FieldRow label="Area">
          <InlineField
            kind="text"
            label="Life area"
            inferred={inferred.has('area')}
            value={o.area ?? ''}
            onSave={(v) => set({ area: v || null })}
          />
        </FieldRow>
        <FieldRow label="Priority">
          <InlineField
            kind="select"
            label="Priority"
            value={o.priority ? String(o.priority) : ''}
            options={PRIORITIES.map((p) => ({ value: String(p.value), label: p.label }))}
            onSave={(v) => set({ priority: v ? Number(v) : null })}
          />
        </FieldRow>
        <FieldRow label="Estimate">
          <InlineField
            kind="number"
            label="Estimate in minutes"
            inferred={inferred.has('estimate_minutes')}
            value={o.estimateMinutes ?? ''}
            placeholder="—"
            onSave={(v) => set({ estimateMinutes: v ? Number(v) : null })}
          />
        </FieldRow>
        <FieldRow label="Energy">
          <InlineField
            kind="select"
            label="Energy"
            value={o.energy ?? ''}
            options={ENERGY.map((e) => ({ value: e, label: e }))}
            onSave={(v) => set({ energy: v || null })}
          />
        </FieldRow>
        {o.targetValue != null || o.type === 'goal' ? (
          <FieldRow label="Metric">
            <div className="flex items-center gap-xs">
              <InlineField
                kind="number"
                label="Current value"
                value={o.currentValue ?? ''}
                onSave={(v) => set({ currentValue: v ? Number(v) : null })}
                className="w-[60px]"
              />
              <span className="t-caption text-ink-subtle">/</span>
              <InlineField
                kind="number"
                label="Target value"
                value={o.targetValue ?? ''}
                onSave={(v) => set({ targetValue: v ? Number(v) : null })}
                className="w-[60px]"
              />
              <InlineField
                kind="text"
                label="Unit"
                value={o.unit ?? ''}
                placeholder="unit"
                onSave={(v) => set({ unit: v || null })}
                className="w-[60px]"
              />
            </div>
          </FieldRow>
        ) : null}
      </div>

      <Divider clearance="md" />

      <SectionHeader title="Notes" size="micro" as="h3" />
      <InlineField
        kind="textarea"
        multiline
        label="Notes"
        value={o.body ?? ''}
        placeholder="Add a note…"
        onSave={(v) => set({ body: v || null })}
        className="min-h-[60px]"
      />

      {[...grouped.entries()].map(([label, items]) => (
        <div key={label} className="mt-lg">
          <SectionHeader title={label} size="micro" as="h3" count={items.length} />
          <div className="flex flex-col">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => open(it.id)}
                className="t-body-sm flex h-row-compact items-center gap-sm rounded-sm px-xs text-left hover:bg-surface-1"
              >
                <span className="text-ink-subtle">
                  <Icon name={iconFor(it.type)} size={14} />
                </span>
                <span className="truncate">{it.title}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-xl flex flex-col gap-sm">
        <div className="flex items-center gap-xs">
          <span className="text-ink-subtle">
            <Sparkles size={14} strokeWidth={1.5} />
          </span>
          <Link href={`/work/tasks/${o.id}`} className="t-caption text-ink-muted">
            Open full route
          </Link>
        </div>
        <div className="flex items-center gap-sm">
          <Button
            variant="primary"
            onClick={() =>
              complete.mutate({ id: o.id, completed: !o.completedAt, title: o.title })
            }
          >
            {o.completedAt ? 'Mark not done' : 'Complete'}
          </Button>
          <Button onClick={() => set({ snoozeUntil: new Date(Date.now() + 86_400_000).toISOString() })}>
            Snooze
          </Button>
          <Button onClick={() => set({ status: 'someday' })}>Someday</Button>
        </div>
        {o.completedAt ? <Meta>Completed {formatDue(o.completedAt)}</Meta> : null}
      </div>
    </div>
  );
}

export function iconFor(type: string): string {
  const map: Record<string, string> = {
    task: 'Circle', goal: 'Target', project: 'FolderKanban', milestone: 'Diamond',
    habit: 'Repeat', waiting_on: 'Hourglass', person: 'User', interaction: 'MessageSquare',
    note: 'FileText', journal: 'BookOpen', thought: 'Lightbulb', draft: 'PenLine',
    idea: 'Sparkles', decision: 'Scale', quote: 'Quote', save: 'Bookmark', book: 'Book',
    article: 'Newspaper', place: 'MapPin', interest: 'Compass', experience: 'Camera',
    expense: 'Receipt', financial_goal: 'PiggyBank', document: 'Paperclip',
    backlog_item: 'Inbox', workout: 'Dumbbell', trip: 'Plane', event: 'CalendarDays',
  };
  return map[type] ?? 'Circle';
}

function trajectoryOf(o: { progress: string | number; dueAt: string | null; startAt: string | null; completedAt: string | null }) {
  if (o.completedAt) return 'ahead';
  if (!o.dueAt) return 'none';
  const due = new Date(o.dueAt).getTime();
  if (due < Date.now()) return 'overdue';
  const start = o.startAt ? new Date(o.startAt).getTime() : due - 365 * 86_400_000;
  const elapsed = ((Date.now() - start) / (due - start)) * 100;
  const p = Number(o.progress);
  if (p >= elapsed + 5) return 'ahead';
  if (p >= elapsed - 5) return 'on_track';
  return 'behind';
}
