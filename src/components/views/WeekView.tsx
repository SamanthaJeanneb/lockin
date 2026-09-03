'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { api, type SerializedObject } from '@/lib/client-api';
import { formatMinutes, formatTime } from '@/lib/format';
import { AREA_SERIES } from '@/lib/constants';
import { useOptimisticComplete } from '@/hooks/useObjects';
import { useContextPane } from '@/hooks/useContextPane';
import {
  Checkbox, EmptyState, IconButton, Meta, ProgressBar, SectionHeader, Skeleton, Tooltip,
} from '@/components/ui';

interface Day {
  date: string;
  key: string;
  label: string;
  dayOfMonth: string;
  isToday: boolean;
  items: SerializedObject[];
  events: { id: string; title: string; startsAt: string; allDay: boolean }[];
  done: number;
}

interface WeekData {
  from: string;
  to: string;
  offset: number;
  days: Day[];
  overdue: SerializedObject[];
  totals: { planned: number; done: number; minutes: number; overdue: number };
}

/**
 * The week at a glance, and then one day in full. Seven columns is the shape of
 * a week; a list of 40 tasks is not. Clicking a day drills in rather than
 * navigating away, so you never lose the overview.
 */
export function WeekView() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const complete = useOptimisticComplete();
  const { open } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['week', offset],
    queryFn: () => api.get<WeekData>(`/api/week?offset=${offset}`),
  });

  const today = data?.days.find((d) => d.isToday);
  const activeKey = selected ?? today?.key ?? data?.days[0]?.key;
  const active = data?.days.find((d) => d.key === activeKey);

  if (isLoading) {
    return (
      <section>
        <SectionHeader title="This week" size="heading" as="h2" />
        <Skeleton className="h-[96px] w-full" />
      </section>
    );
  }

  return (
    <section aria-label="This week">
      <div className="flex flex-wrap items-baseline justify-between gap-md pb-md">
        <div className="flex items-baseline gap-sm">
          <h2 className="t-heading">
            {offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : 'Week'}
          </h2>
          {data ? (
            <Meta className="tabular">
              {data.totals.done} of {data.totals.planned} done
              {data.totals.minutes ? ` · ${formatMinutes(data.totals.minutes)} planned` : ''}
            </Meta>
          ) : null}
        </div>
        <div className="flex items-center gap-xxs">
          <IconButton label="Previous week" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={14} strokeWidth={1.5} />
          </IconButton>
          <span className="t-caption w-[110px] text-center text-ink-subtle">
            {data ? `${format(new Date(data.from), 'd MMM')} – ${format(new Date(data.to), 'd MMM')}` : ''}
          </span>
          <IconButton label="Next week" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight size={14} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>

      {/* Seven columns. Height reads as load, the bar reads as done. */}
      <div className="grid grid-cols-7 gap-xs">
        {(data?.days ?? []).map((d) => {
          const isActive = d.key === activeKey;
          return (
            <button
              key={d.key}
              onClick={() => setSelected(d.key)}
              aria-pressed={isActive}
              className={cn(
                'flex flex-col gap-xs rounded-md border p-sm text-left transition-colors duration-[120ms]',
                isActive
                  ? 'border-hairline-strong bg-surface-2'
                  : 'border-hairline hover:bg-surface-1',
              )}
            >
              <div className="flex items-baseline justify-between gap-xxs">
                <span className={cn('t-micro', d.isToday ? 'text-ink' : 'text-ink-subtle')}>
                  {d.label}
                </span>
                <span className={cn('t-numeric tabular', d.isToday ? 'text-ink' : 'text-ink-muted')}>
                  {d.dayOfMonth}
                </span>
              </div>

              {/* One fixed track per day so the week reads as a single scale.
                  Fill is what is done; the count carries the load. */}
              <ProgressBar
                value={d.items.length ? (d.done / d.items.length) * 100 : 0}
                label={`${d.label} ${d.dayOfMonth}`}
              />

              <div className="flex items-baseline justify-between gap-xxs">
                <span className="t-caption text-ink-subtle tabular">
                  {d.items.length ? `${d.done}/${d.items.length}` : '·'}
                </span>
                {d.events.length ? (
                  <Tooltip
                    content={`${d.events.length} calendar ${d.events.length === 1 ? 'event' : 'events'}`}
                  >
                    <span
                      className="t-micro text-ink-faint tabular"
                      aria-label={`${d.events.length} calendar events`}
                    >
                      {d.events.length}
                    </span>
                  </Tooltip>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* The selected day in full. */}
      {active ? (
        <div className="mt-lg">
          <SectionHeader
            title={format(new Date(active.date), 'EEEE d MMMM')}
            size="micro"
            as="h3"
            count={active.items.length || undefined}
          />

          {active.events.length ? (
            <div className="mb-sm flex flex-col">
              {active.events.map((e) => (
                <div key={e.id} className="flex h-row-compact items-center gap-sm px-xs">
                  <span className="t-numeric w-[52px] shrink-0 text-ink-subtle tabular">
                    {e.allDay ? 'all day' : formatTime(e.startsAt)}
                  </span>
                  <span className="t-body-sm truncate text-ink-muted">{e.title}</span>
                </div>
              ))}
            </div>
          ) : null}

          {active.items.length ? (
            <div role="list" className="flex flex-col">
              {active.items.map((o) => (
                <div
                  key={o.id}
                  role="listitem"
                  className="group/row flex h-row items-center gap-sm border-b border-hairline px-xs hover:bg-surface-1"
                >
                  <Checkbox
                    checked={Boolean(o.completedAt)}
                    label={`Complete ${o.title}`}
                    onCheckedChange={(next) =>
                      complete.mutate({ id: o.id, completed: next, title: o.title })
                    }
                  />
                  {o.area ? (
                    <Tooltip content={o.area}>
                      <span
                        aria-hidden
                        className="size-[6px] shrink-0 rounded-full"
                        style={{ background: `var(--series-${AREA_SERIES[o.area] ?? 10})` }}
                      />
                    </Tooltip>
                  ) : (
                    <span className="size-[6px] shrink-0" />
                  )}
                  <button
                    onClick={() => open(o.id)}
                    className={cn(
                      't-body-sm min-w-0 flex-1 truncate text-left',
                      o.completedAt && 'text-ink-faint line-through',
                    )}
                  >
                    {o.title}
                  </button>
                  <Meta className="hidden shrink-0 tablet:block">
                    {o.type === 'habit' ? 'habit' : o.type === 'milestone' ? 'milestone' : ''}
                  </Meta>
                  {o.estimateMinutes ? (
                    <Meta className="shrink-0 tabular">{formatMinutes(o.estimateMinutes)}</Meta>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState className="py-md" message="Nothing on this day." />
          )}
        </div>
      ) : null}

      {data?.overdue.length ? (
        <div className="mt-lg">
          <SectionHeader
            title="Past due"
            size="micro"
            as="h3"
            count={data.overdue.length}
          />
          <div role="list" className="flex flex-col">
            {data.overdue.slice(0, 6).map((o) => (
              <div
                key={o.id}
                role="listitem"
                className="flex h-row items-center gap-sm border-b border-hairline px-xs hover:bg-surface-1"
              >
                <Checkbox
                  checked={false}
                  label={`Complete ${o.title}`}
                  onCheckedChange={() => complete.mutate({ id: o.id, completed: true, title: o.title })}
                />
                <button onClick={() => open(o.id)} className="t-body-sm min-w-0 flex-1 truncate text-left">
                  {o.title}
                </button>
                <Meta className="shrink-0">{o.dueAt ? format(new Date(o.dueAt), 'd MMM') : ''}</Meta>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
