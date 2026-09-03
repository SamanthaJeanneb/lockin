'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { api, type AreaProgress, type TodayItem } from '@/lib/client-api';
import { greeting, formatMinutes, formatTime } from '@/lib/format';
import { useApp } from '@/lib/store';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isAtLeast } from '@/lib/breakpoints';
import { useContextPane } from '@/hooks/useContextPane';
import { Button, Divider, Meta, SectionHeader } from '@/components/ui';
import { TodayList } from '@/components/views/TodayList';
import { ProgressStrip } from '@/components/views/ProgressStrip';
import { WeekView } from '@/components/views/WeekView';
import { Suggestions } from '@/components/views/Suggestions';
import { HorizonProgress, type ProgressionData } from '@/components/views/HorizonProgress';

interface HomeData {
  items: TodayItem[];
  freeBlocks: { start: string; end: string; minutes: number }[];
  areas: AreaProgress[];
  events: { id: string; title: string; startsAt: string; endsAt: string; allDay: boolean }[];
  oneThing: { id: string; title: string; why: string } | null;
}

export default function HomePage() {
  const bp = useBreakpoint();
  const router = useRouter();
  const openModal = useApp((s) => s.openModal);
  const { open } = useContextPane();
  const period = greeting();

  const { data, isLoading } = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get<HomeData>('/api/today'),
  });

  const { data: progression, isLoading: progressionLoading } = useQuery({
    queryKey: ['progression'],
    queryFn: () => api.get<ProgressionData>('/api/progression'),
  });

  const items = data?.items ?? [];
  const remaining = items.filter((i) => !i.object.completedAt);
  const nextFree = data?.freeBlocks?.[0];
  const bestFit =
    nextFree && remaining.find((i) => (i.object.estimateMinutes ?? 30) <= nextFree.minutes);

  const headline =
    period === 'morning'
      ? 'Good morning.'
      : period === 'afternoon'
        ? `Good afternoon. ${remaining.length} left.`
        : 'How did today go?';

  // One line that says where things actually stand, rather than a greeting that
  // says nothing.
  const status = useMemo(() => {
    const s = progression?.summary;
    if (!s) return '';
    const off = (s.behind ?? 0) + (s.overdue ?? 0);
    const on = (s.on_track ?? 0) + (s.ahead ?? 0);
    if (!off && !on) return 'No goals yet. Start with three.';
    if (!off) return `${on} goal${on === 1 ? '' : 's'} on pace.`;
    return `${off} goal${off === 1 ? '' : 's'} behind pace, ${on} on track.`;
  }, [progression]);

  const subline =
    period === 'afternoon' && nextFree && bestFit
      ? `${formatMinutes(nextFree.minutes)} free — ${bestFit.object.title} fits.`
      : status;

  const inlinePeriphery = !isAtLeast(bp, 'compact');

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 p-xl">
        <header className="mb-section flex flex-wrap items-baseline justify-between gap-md">
          <div className="min-w-0">
            <h1 className="t-display">{headline}</h1>
            {subline ? <Meta className="mt-xs block">{subline}</Meta> : null}
          </div>
          <div className="flex shrink-0 items-center gap-sm">
            <Meta>{format(new Date(), 'EEE d MMM')}</Meta>
            <Button onClick={() => openModal('capture')}>Capture</Button>
            <Button
              variant={period === 'evening' ? 'primary' : 'ghost'}
              onClick={() => openModal('debrief')}
            >
              Debrief
            </Button>
          </div>
        </header>

        {/* Progression first. It is the reason the product exists, and burying
            it under a task list was the original mistake. */}
        <HorizonProgress data={progression} loading={progressionLoading} />

        <Divider clearance="lg" />

        <TodayList items={items} loading={isLoading} />

        <Divider clearance="lg" />

        <WeekView />

        <Divider clearance="lg" />

        <Suggestions />

        <Divider clearance="lg" />

        <ProgressStrip
          areas={data?.areas ?? []}
          onSelect={(area) => router.push(`/goals/tree?area=${area}`)}
        />

        {data?.oneThing ? (
          <>
            <Divider clearance="lg" />
            <p className="t-body max-w-measure text-ink-muted">
              If you only do one thing today:{' '}
              <button
                onClick={() => open(data.oneThing!.id)}
                className="text-ink underline decoration-hairline-strong"
              >
                {data.oneThing.title}
              </button>
              . {data.oneThing.why}
            </p>
          </>
        ) : null}

        {inlinePeriphery ? (
          <>
            <Divider clearance="lg" />
            <Periphery data={data} inline />
          </>
        ) : null}
      </div>

      {!inlinePeriphery ? (
        <aside className="w-[280px] shrink-0 border-l border-hairline p-lg">
          <Periphery data={data} />
        </aside>
      ) : null}
    </div>
  );
}

function Periphery({ data, inline }: { data?: HomeData; inline?: boolean }) {
  return (
    <div className={inline ? 'grid gap-lg tablet:grid-cols-2' : 'flex flex-col gap-xl'}>
      <section>
        <SectionHeader title="Up next" size="micro" as="h2" />
        {data?.events?.length ? (
          <div className="flex flex-col">
            {data.events.slice(0, 5).map((e) => (
              <div key={e.id} className="flex h-row items-center gap-sm">
                <span className="t-numeric w-[52px] shrink-0 text-ink-subtle tabular">
                  {e.allDay ? 'all day' : formatTime(e.startsAt)}
                </span>
                <span className="t-body-sm truncate">{e.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <Meta>No calendar connected.</Meta>
        )}
      </section>

      <section>
        <SectionHeader title="Free time" size="micro" as="h2" />
        {data?.freeBlocks?.length ? (
          <div className="flex flex-col">
            {data.freeBlocks.slice(0, 4).map((b) => (
              <div key={b.start} className="flex h-row items-center justify-between gap-sm">
                <span className="t-body-sm tabular">
                  {formatTime(b.start)}–{formatTime(b.end)}
                </span>
                <Meta className="tabular">{formatMinutes(b.minutes)}</Meta>
              </div>
            ))}
          </div>
        ) : (
          <Meta>Nothing computed — connect a calendar.</Meta>
        )}
      </section>
    </div>
  );
}
