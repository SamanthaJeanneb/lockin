'use client';
import { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { AREA_SERIES } from '@/lib/constants';
import { formatMinutes } from '@/lib/format';
import { useContextPane } from '@/hooks/useContextPane';
import { BarChart } from '@/components/charts/Chart';
import { Button, EmptyState, Meta, Select, Skeleton } from '@/components/ui';

interface Drift {
  period: string;
  stated: string[];
  actual: {
    area: string; minutes: number; items: number; share: number;
    actualRank: number; statedRank: number | null;
  }[];
  observations: string[];
}

/** Effort comes from the activity log. Clicking any bar opens the underlying
 *  completions, so every number is auditable. */
export default function DriftPage() {
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'));
  const { open } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['drift', period],
    queryFn: () => api.get<Drift>(`/api/goals/drift?period=${period}`),
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
  });

  if (isLoading) return <Skeleton className="h-[280px] w-full" />;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between gap-md">
        <div>
          <h2 className="t-heading">Goal drift</h2>
          <Meta className="mt-xxs block">What you said matters, against where your effort went.</Meta>
        </div>
        <Select ariaLabel="Month" value={period} onChange={setPeriod} options={months} className="w-[180px]" />
      </div>

      {data?.actual.length ? (
        <>
          <BarChart
            data={data.actual.map((a) => ({
              key: a.area,
              label: `${a.area.charAt(0).toUpperCase()}${a.area.slice(1)}`,
              series: AREA_SERIES[a.area] ?? 10,
              value: a.share,
            }))}
            max={100}
            formatValue={(v) => `${Math.round(v)}%`}
          />

          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Area', 'Stated', 'Actual', 'Effort', 'Items'].map((h, i) => (
                  <th
                    key={h}
                    className={`t-micro h-row-compact border-b border-hairline-strong px-xs text-ink-subtle ${i > 1 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.actual.map((a) => (
                <tr key={a.area} className="h-row border-b border-hairline hover:bg-surface-1">
                  <td className="t-body-sm px-xs">{a.area}</td>
                  <td className="t-body-sm px-xs">{a.statedRank ? `#${a.statedRank}` : '—'}</td>
                  <td className="t-body-sm px-xs text-right tabular">
                    #{a.actualRank}
                    {a.statedRank && a.actualRank - a.statedRank >= 2 ? ' ⚠' : ''}
                  </td>
                  <td className="t-numeric px-xs text-right tabular">{formatMinutes(a.minutes)}</td>
                  <td className="t-numeric px-xs text-right tabular">{a.items}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.observations.map((o) => (
            <p key={o} className="t-body max-w-measure text-ink-muted">
              {o}
            </p>
          ))}

          {data.observations.length ? (
            <div className="flex gap-sm">
              <Button>That&rsquo;s intentional</Button>
              <Button variant="primary">Rebalance next month →</Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState message="No completed work in this month yet. Finish something and the comparison appears." />
      )}
    </div>
  );
}
