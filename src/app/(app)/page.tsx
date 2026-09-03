'use client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { api, type AreaProgress, type TodayItem } from '@/lib/client-api';
import { greeting, formatTime, formatMinutes } from '@/lib/format';
import { useApp } from '@/lib/store';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { isAtLeast } from '@/lib/breakpoints';
import { useContextPane } from '@/hooks/useContextPane';
import { Button, Divider, Meta, SectionHeader } from '@/components/ui';
import { TodayList } from '@/components/views/TodayList';
import { ProgressStrip } from '@/components/views/ProgressStrip';

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

  const subline =
    period === 'morning'
      ? items.length
        ? `${items.length === 1 ? 'One thing' : `${items.length} things`} today. Here's what matters.`
        : 'Nothing on the list yet.'
      : period === 'afternoon' && nextFree && bestFit
        ? `${formatMinutes(nextFree.minutes)} free — ${bestFit.object.title} fits.`
        : '';

  // At tablet and below the periphery moves inline as cards beneath Progress.
  const inlinePeriphery = !isAtLeast(bp, 'compact');

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 p-xl">
        <header className="mb-xl flex items-baseline justify-between gap-md">
          <div>
            <h1 className="t-display">{headline}</h1>
            {subline ? <Meta className="mt-xxs block">{subline}</Meta> : null}
          </div>
          <div className="flex shrink-0 items-center gap-sm">
            <Meta>{format(new Date(), 'EEE d MMM')}</Meta>
            {period === 'evening' ? (
              <Button variant="primary" onClick={() => openModal('debrief')}>
                Debrief
              </Button>
            ) : null}
          </div>
        </header>

        <TodayList items={items} loading={isLoading} />

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
        <aside className="w-[300px] shrink-0 border-l border-hairline p-lg">
          <Periphery data={data} />
        </aside>
      ) : null}
    </div>
  );
}

function Periphery({ data, inline }: { data?: HomeData; inline?: boolean }) {
  const openModal = useApp((s) => s.openModal);

  return (
    <div className={inline ? 'grid gap-lg tablet:grid-cols-3' : 'flex flex-col gap-xl'}>
      <section>
        <SectionHeader title="Up next" size="micro" as="h2" />
        {data?.events?.length ? (
          <div className="flex flex-col">
            {data.events.slice(0, 4).map((e) => (
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

        {data?.freeBlocks?.length ? (
          <div className="mt-sm border-t border-hairline pt-sm">
            <Meta>
              {formatTime(data.freeBlocks[0]!.start)}–{formatTime(data.freeBlocks[0]!.end)} free ·{' '}
              {formatMinutes(data.freeBlocks[0]!.minutes)}
            </Meta>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeader title="Signals" size="micro" as="h2" />
        <div className="flex flex-col gap-sm">
          <Meta>
            Journal, people and money signals appear here once there is enough history to say
            something specific.
          </Meta>
          <Button size="sm" onClick={() => openModal('capture')} className="self-start">
            Capture something
          </Button>
        </div>
      </section>
    </div>
  );
}
