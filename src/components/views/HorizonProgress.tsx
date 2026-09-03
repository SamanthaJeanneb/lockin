'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type SerializedObject } from '@/lib/client-api';
import { formatDelta, formatShortDate } from '@/lib/format';
import { AREA_SERIES, type Trajectory } from '@/lib/constants';
import { useContextPane } from '@/hooks/useContextPane';
import {
  Button, EmptyState, Meta, ProgressBar, Segmented, Skeleton, Tooltip, TrajectoryChip,
} from '@/components/ui';

export interface ProgressionGoal {
  id: string;
  title: string;
  area: string | null;
  horizon: string | null;
  status: string | null;
  progress: number;
  elapsed: number | null;
  pacing: number | null;
  delta7: number;
  trajectory: string;
  dueAt: string | null;
  daysLeft: number | null;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  openChildren: number;
  totalChildren: number;
  completedAt: string | null;
}

export interface ProgressionData {
  horizons: { key: string; count: number }[];
  goals: ProgressionGoal[];
  summary: Record<string, number>;
}

/** Short labels — the horizon key is the vocabulary, this is the reading of it. */
const HORIZON_TABS: { value: string; label: string }[] = [
  { value: '1w', label: 'Week' },
  { value: '1m', label: 'Month' },
  { value: '3m', label: 'Quarter' },
  { value: '1y', label: 'Year' },
  { value: '3y', label: '3 years' },
  { value: '5y', label: '5 years' },
  { value: '10y', label: '10 years' },
];

/**
 * The question the whole product exists to answer: are your days moving your
 * years? Pick a horizon, and every goal at it shows how far along it is against
 * how far through its window you are.
 */
export function HorizonProgress({
  data,
  loading,
}: {
  data?: ProgressionData;
  loading?: boolean;
}) {
  const { open } = useContextPane();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Open on the horizon carrying the most goals, tie-breaking toward the
  // nearer one. Landing on a horizon with a single goal reads as an empty
  // product even when it is not.
  const defaultHorizon = useMemo(() => {
    const counts = new Map((data?.horizons ?? []).map((h) => [h.key, h.count]));
    let best = '1y';
    let bestCount = -1;
    for (const t of HORIZON_TABS) {
      const n = counts.get(t.value) ?? 0;
      if (n > bestCount) {
        best = t.value;
        bestCount = n;
      }
    }
    return bestCount > 0 ? best : '1y';
  }, [data]);

  const [horizon, setHorizon] = useState<string | null>(null);
  const active = horizon ?? defaultHorizon;

  const goals = useMemo(
    () =>
      (data?.goals ?? [])
        .filter((g) => g.horizon === active)
        .sort((a, b) => (a.pacing ?? 0) - (b.pacing ?? 0)),
    [data, active],
  );

  if (loading) {
    return (
      <section>
        <Skeleton className="mb-md h-control-md w-[380px]" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="mb-sm h-[52px] w-full" />
        ))}
      </section>
    );
  }

  const behind = goals.filter((g) => g.trajectory === 'behind' || g.trajectory === 'overdue');

  return (
    <section aria-label="Goal progression">
      <div className="flex flex-wrap items-baseline justify-between gap-md pb-md">
        <h2 className="t-heading">Progression</h2>
        <div className="overflow-x-auto">
          <Segmented
            size="sm"
            value={active as never}
            onChange={setHorizon}
            options={HORIZON_TABS.map((t) => ({
              ...t,
              count: data?.horizons.find((h) => h.key === t.value)?.count || undefined,
            }))}
          />
        </div>
      </div>

      {goals.length ? (
        <>
          <div role="list" className="flex flex-col">
            {goals.map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                expanded={expanded === g.id}
                onToggle={() => setExpanded(expanded === g.id ? null : g.id)}
                onOpen={() => open(g.id)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-md pt-md">
            {behind.length ? (
              <Meta>
                {behind.length} of {goals.length} {behind.length === 1 ? 'is' : 'are'} behind pace.
              </Meta>
            ) : (
              <Meta>Everything at this horizon is on pace or ahead.</Meta>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          message={`Nothing at ${HORIZON_TABS.find((t) => t.value === active)?.label.toLowerCase()}. Goals at other horizons are still moving.`}
        />
      )}
    </section>
  );
}

function GoalRow({
  goal,
  expanded,
  onToggle,
  onOpen,
}: {
  goal: ProgressionGoal;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { open } = useContextPane();

  const { data: children, isLoading } = useQuery({
    queryKey: ['objects', { goal: goal.id }],
    queryFn: () => api.get<{ objects: SerializedObject[] }>(`/api/objects?goal=${goal.id}&limit=40`),
    enabled: expanded,
    staleTime: 30_000,
  });

  const pacing = goal.pacing;
  const paceLine =
    pacing == null
      ? goal.daysLeft == null
        ? 'No deadline set'
        : ''
      : pacing >= 5
        ? `${pacing} points ahead of pace`
        : pacing <= -5
          ? `${Math.abs(pacing)} points behind pace`
          : 'On pace';

  return (
    <div role="listitem" className="border-b border-hairline">
      <div className="group/row flex items-center gap-sm py-sm">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${goal.title}` : `Expand ${goal.title}`}
          className="flex size-control-sm shrink-0 items-center justify-center rounded-sm text-ink-subtle hover:bg-surface-2 hover:text-ink"
        >
          {expanded ? (
            <ChevronDown size={14} strokeWidth={1.5} />
          ) : (
            <ChevronRight size={14} strokeWidth={1.5} />
          )}
        </button>

        {goal.area ? (
          <Tooltip content={goal.area}>
            <span
              aria-hidden
              className="size-[6px] shrink-0 rounded-full"
              style={{ background: `var(--series-${AREA_SERIES[goal.area] ?? 10})` }}
            />
          </Tooltip>
        ) : (
          <span className="size-[6px] shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-xs">
          <div className="flex min-w-0 items-baseline gap-sm">
            <button onClick={onOpen} className="t-body min-w-0 truncate text-left hover:underline">
              {goal.title}
            </button>
            {goal.targetValue ? (
              <Meta className="shrink-0 tabular">
                {goal.currentValue ?? 0} / {goal.targetValue} {goal.unit ?? ''}
              </Meta>
            ) : null}
          </div>

          <Tooltip
            content={
              goal.elapsed == null
                ? `${goal.progress}% done`
                : `${goal.progress}% done · ${goal.elapsed}% of the time gone`
            }
          >
            <div>
              <ProgressBar value={goal.progress} label={goal.title} height="md" />
            </div>
          </Tooltip>
        </div>

        <div className="flex shrink-0 items-center gap-md">
          <span className="t-numeric w-[40px] text-right tabular">{goal.progress}%</span>
          <span className="t-caption hidden w-[42px] text-right text-ink-subtle tabular tablet:block">
            {goal.delta7 ? formatDelta(goal.delta7) : ''}
          </span>
          <span className="hidden w-[74px] compact:block">
            <TrajectoryChip trajectory={goal.trajectory as Trajectory} />
          </span>
          <span className="t-caption hidden w-[84px] text-right text-ink-subtle tablet:block">
            {goal.daysLeft == null
              ? '—'
              : goal.daysLeft < 0
                ? `${Math.abs(goal.daysLeft)}d over`
                : `${goal.daysLeft}d left`}
          </span>
        </div>
      </div>

      {paceLine ? (
        <div className="flex items-center gap-md pb-sm pl-[calc(var(--control-sm)+var(--space-sm)+14px)]">
          <Meta>{paceLine}</Meta>
          {goal.totalChildren ? (
            <Meta>
              {goal.openChildren} open of {goal.totalChildren}
            </Meta>
          ) : (
            <Meta>Nothing linked to it yet</Meta>
          )}
        </div>
      ) : null}

      {expanded ? (
        <div className="pb-md pl-[calc(var(--control-sm)+var(--space-sm)+14px)]">
          {isLoading ? (
            <Skeleton className="h-row w-full" />
          ) : children?.objects.length ? (
            <div className="flex flex-col">
              {children.objects.map((c) => (
                <button
                  key={c.id}
                  onClick={() => open(c.id)}
                  className="flex h-row items-center gap-sm rounded-sm px-xs text-left hover:bg-surface-1"
                >
                  <span className="t-micro w-[64px] shrink-0 text-ink-subtle">
                    {c.type.replace('_', ' ')}
                  </span>
                  <span
                    className={cn(
                      't-body-sm min-w-0 flex-1 truncate',
                      c.completedAt && 'text-ink-faint line-through',
                    )}
                  >
                    {c.title}
                  </span>
                  <ProgressBar
                    value={Number(c.progress)}
                    className="w-[80px] shrink-0"
                    label={c.title}
                  />
                  <span className="t-numeric w-[38px] shrink-0 text-right tabular">
                    {Math.round(Number(c.progress))}%
                  </span>
                  <span className="t-caption hidden w-[70px] shrink-0 text-right text-ink-subtle tablet:block">
                    {c.dueAt ? formatShortDate(c.dueAt) : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              className="py-sm"
              message="Nothing supports this goal yet, so it cannot move."
              action={
                <Button size="sm" onClick={onOpen}>
                  Open it
                </Button>
              }
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
