'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subYears } from 'date-fns';
import { api } from '@/lib/client-api';
import { AREA_SERIES } from '@/lib/constants';
import { useContextPane } from '@/hooks/useContextPane';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isAtLeast } from '@/lib/breakpoints';
import { iconFor } from '@/components/composite/ObjectDetail';
import { HeatStrip } from '@/components/charts/Chart';
import {
  Checkbox, EmptyState, Icon, Meta, SectionHeader, Segmented, Skeleton,
} from '@/components/ui';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  area: string | null;
  at: string;
  props: Record<string, unknown>;
}

const FILTERS = [
  { key: 'milestone', label: 'Milestones' },
  { key: 'experience', label: 'Experiences' },
  { key: 'decision', label: 'Decisions' },
  { key: 'interaction', label: 'People' },
  { key: 'journal', label: 'Journal' },
  { key: 'expense', label: 'Money' },
  { key: 'book', label: 'Media' },
];

export default function LifePage() {
  const bp = useBreakpoint();
  const { open } = useContextPane();
  const [zoom, setZoom] = useState<'day' | 'month' | 'year'>('month');
  const [active, setActive] = useState<string[]>(['milestone', 'experience', 'decision', 'interaction']);

  const from = subYears(new Date(), zoom === 'year' ? 3 : 1).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', zoom, active.join(',')],
    queryFn: () =>
      api.get<{ events: TimelineEvent[]; heat: { area: string; month: string; count: number }[] }>(
        `/api/timeline?from=${from}&${active.map((t) => `type=${t}`).join('&')}`,
      ),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of data?.events ?? []) {
      const key = format(new Date(e.at), zoom === 'day' ? 'yyyy-MM-dd' : 'yyyy-MM');
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    }
    return [...map.entries()];
  }, [data, zoom]);

  const heatRows = useMemo(() => {
    const byArea = new Map<string, Record<string, number>>();
    const months = new Set<string>();
    for (const h of data?.heat ?? []) {
      months.add(h.month);
      const row = byArea.get(h.area) ?? {};
      row[h.month] = h.count;
      byArea.set(h.area, row);
    }
    return {
      rows: [...byArea.entries()].map(([area, counts]) => ({ area, counts })),
      months: [...months].sort().slice(-12),
    };
  }, [data]);

  const filters = (
    <div className="flex flex-col gap-sm">
      <SectionHeader title="Filters" size="micro" as="h2" />
      {FILTERS.map((f) => (
        <label key={f.key} className="flex items-center gap-sm">
          <Checkbox
            shape="square"
            checked={active.includes(f.key)}
            label={f.label}
            onCheckedChange={(next) =>
              setActive((a) => (next ? [...a, f.key] : a.filter((x) => x !== f.key)))
            }
          />
          <span className="t-body-sm">{f.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 p-xl">
        <header className="mb-lg flex items-center justify-between gap-md">
          <h1 className="t-display">Life</h1>
          <Segmented
            options={[
              { value: 'day', label: 'Day' },
              { value: 'month', label: 'Month' },
              { value: 'year', label: 'Year' },
            ]}
            value={zoom}
            onChange={(v) => setZoom(v)}
          />
        </header>

        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : zoom === 'year' ? (
          heatRows.rows.length ? (
            <HeatStrip rows={heatRows.rows} months={heatRows.months} />
          ) : (
            <EmptyState message="Not enough history for the heat strip yet." />
          )
        ) : grouped.length ? (
          grouped.map(([period, events]) => (
            <section key={period} className="mb-xl cv-auto">
              <SectionHeader
                title={format(new Date(`${period}${period.length === 7 ? '-01' : ''}`), period.length === 7 ? 'MMMM yyyy' : 'EEEE d MMMM')}
                size="heading-sm"
                as="h2"
              />
              <div className="flex flex-col">
                {events.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => open(e.id)}
                    className="flex h-row items-center gap-sm border-b border-hairline px-xs text-left hover:bg-surface-1"
                  >
                    <span className="t-caption w-[52px] shrink-0 text-ink-subtle tabular">
                      {format(new Date(e.at), 'd MMM')}
                    </span>
                    {e.area ? (
                      <span
                        aria-hidden
                        className="size-[6px] shrink-0 rounded-full"
                        style={{ background: `var(--series-${AREA_SERIES[e.area] ?? 10})` }}
                      />
                    ) : (
                      <span className="size-[6px] shrink-0" />
                    )}
                    <span className="text-ink-subtle">
                      <Icon name={iconFor(e.type)} size={14} />
                    </span>
                    <span className="t-body-sm min-w-0 flex-1 truncate">{e.title}</span>
                    <Meta>{e.type.replace('_', ' ')}</Meta>
                  </button>
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState message="Nothing in this window. Widen the filters, or capture something." />
        )}

        {!isAtLeast(bp, 'compact') ? <div className="mt-xl border-t border-hairline pt-lg">{filters}</div> : null}
      </div>

      {isAtLeast(bp, 'compact') ? (
        <aside className="w-[220px] shrink-0 border-l border-hairline p-lg">{filters}</aside>
      ) : null}
    </div>
  );
}
