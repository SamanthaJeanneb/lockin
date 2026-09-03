'use client';
import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '@/lib/client-api';
import { AREA_SERIES } from '@/lib/constants';
import { formatMinutes, formatMoney } from '@/lib/format';
import { useContextPane } from '@/hooks/useContextPane';
import { BarChart } from '@/components/charts/Chart';
import {
  Button, Divider, EmptyState, Meta, SectionHeader, Segmented, Skeleton, Textarea, useToast,
} from '@/components/ui';
import { useRouter } from 'next/navigation';

interface ReviewData {
  counts: { completed: number; created: number; postponed: number; journals: number };
  completed: { id: string; title: string; type: string; area: string | null }[];
  postponed: { id: string; title: string; type: string }[];
  areas: { key: string; label: string; value: number; delta: number; series: number }[];
  effort: { area: string; minutes: number }[];
  themes: { theme: string; count: number }[];
  spending: { category: string; total: number }[];
  people: { id: string; title: string; interactions: number }[];
  observations: { title: string; body: string; url?: string }[];
  start: string;
  end: string;
}

export default function ReviewPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { open } = useContextPane();
  const [answer, setAnswer] = useState('');
  const [decisions, setDecisions] = useState<Record<string, 'do' | 'park' | 'drop'>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['review', period],
    queryFn: () =>
      api.get<{
        review: {
          data: ReviewData; periodStart: string; periodEnd: string;
          shareSlug: string | null; isPublic: boolean;
        };
      }>(`/api/review/${period}`),
  });

  const share = useMutation({
    mutationFn: (isPublic: boolean) =>
      api.post(`/api/review/${period}/confirm`, { answers: {}, changes: [], isPublic }),
    onSuccess: (_d, isPublic) => {
      void qc.invalidateQueries({ queryKey: ['review', period] });
      toast.show(isPublic ? 'Public link is live' : 'Link turned off');
    },
  });

  const confirm = useMutation({
    mutationFn: () =>
      api.post(`/api/review/${period}/confirm`, {
        answers: { next: answer },
        changes: Object.entries(decisions).map(([objectId, action]) => ({ objectId, action })),
      }),
    onSuccess: () => {
      toast.show('Review complete');
      void qc.invalidateQueries({ queryKey: ['objects'] });
      router.push('/');
    },
  });

  if (isLoading) return <Skeleton className="m-xl h-[400px]" />;
  const r = data?.review?.data;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col p-xl">
      <header className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="t-display">{period.charAt(0).toUpperCase() + period.slice(1)} review</h1>
          {data?.review ? (
            <Meta className="mt-xxs block">
              {format(new Date(data.review.periodStart), 'd MMM')} –{' '}
              {format(new Date(data.review.periodEnd), 'd MMM yyyy')}
            </Meta>
          ) : null}
        </div>
        <Segmented
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'annual', label: 'Annual' },
          ]}
          value={period as never}
          onChange={(v) => router.push(`/review/${v}`)}
        />
      </header>

      {!r ? (
        <EmptyState message="Nothing to review yet." />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-lg tablet:grid-cols-4">
            {[
              ['Completed', r.counts.completed],
              ['Created', r.counts.created],
              ['Postponed', r.counts.postponed],
              ['Journal entries', r.counts.journals],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex flex-col gap-xxs border-b border-hairline py-sm">
                <span className="t-micro text-ink-subtle">{label}</span>
                <span className="t-numeric-lg">{value}</span>
              </div>
            ))}
          </section>

          <Divider clearance="lg" />

          <section>
            <SectionHeader title="Where the effort went" size="heading-sm" as="h2" />
            {r.effort.length ? (
              <BarChart
                data={r.effort.map((e) => ({
                  key: e.area,
                  label: e.area,
                  series: AREA_SERIES[e.area] ?? 10,
                  value: e.minutes,
                }))}
                formatValue={(v) => formatMinutes(v)}
              />
            ) : (
              <Meta>No completed work in this window.</Meta>
            )}
          </section>

          <Divider clearance="lg" />

          <section>
            <SectionHeader title="Goal movement" size="heading-sm" as="h2" />
            <div className="flex flex-col">
              {r.areas.map((a) => (
                <div key={a.key} className="flex h-row items-center gap-md border-b border-hairline px-xs">
                  <span className="t-body-sm w-[130px] truncate">{a.label}</span>
                  <span className="t-numeric flex-1 tabular">{a.value}%</span>
                  <span className="t-caption text-ink-subtle tabular">
                    {a.delta > 0 ? `+${a.delta}` : a.delta}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {r.observations.length ? (
            <>
              <Divider clearance="lg" />
              <section>
                <SectionHeader title="Observations" size="heading-sm" as="h2" />
                {r.observations.map((o) => (
                  <div key={o.title} className="mb-md">
                    <h3 className="t-heading-sm">{o.title}</h3>
                    <p className="t-body mt-xxs max-w-measure text-ink-muted">{o.body}</p>
                  </div>
                ))}
              </section>
            </>
          ) : null}

          {r.themes.length ? (
            <>
              <Divider clearance="lg" />
              <section>
                <SectionHeader title="Journal themes" size="heading-sm" as="h2" />
                <div className="flex flex-col">
                  {r.themes.map((t) => (
                    <div key={t.theme} className="flex h-row items-center gap-md border-b border-hairline px-xs">
                      <span className="t-body-sm flex-1">“{t.theme}”</span>
                      <span className="t-numeric text-ink-subtle tabular">{t.count}×</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {r.spending.length ? (
            <>
              <Divider clearance="lg" />
              <section>
                <SectionHeader title="Money" size="heading-sm" as="h2" />
                <div className="flex flex-col">
                  {r.spending.slice(0, 6).map((s) => (
                    <div key={s.category} className="flex h-row items-center gap-md border-b border-hairline px-xs">
                      <span className="t-body-sm flex-1">{s.category}</span>
                      <span className="t-numeric tabular">{formatMoney(s.total)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {r.postponed.length ? (
            <>
              <Divider clearance="lg" />
              <section>
                <SectionHeader title="Postponed" size="heading-sm" as="h2" count={r.postponed.length} />
                <div className="flex flex-col">
                  {r.postponed.map((p) => (
                    <div key={p.id} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                      <button onClick={() => open(p.id)} className="t-body-sm min-w-0 flex-1 truncate text-left">
                        {p.title}
                      </button>
                      {(['do', 'park', 'drop'] as const).map((action) => (
                        <Button
                          key={action}
                          size="sm"
                          variant={decisions[p.id] === action ? 'secondary' : 'ghost'}
                          onClick={() => setDecisions((d) => ({ ...d, [p.id]: action }))}
                        >
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </Button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <Divider clearance="lg" />

          <section>
            <SectionHeader title="What should change next week?" size="heading-sm" as="h2" />
            <Textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="One thing." />
          </section>

          {period === 'annual' && data?.review.shareSlug ? (
            <>
              <Divider clearance="lg" />
              <section>
                <SectionHeader title="Share this year" size="heading-sm" as="h2" />
                <Meta className="mb-sm block">
                  A public page with counts, milestones, themes and people. No journal text, no
                  money, no open work.
                </Meta>
                <div className="flex flex-wrap items-center gap-sm">
                  <Button onClick={() => share.mutate(!data.review.isPublic)}>
                    {data.review.isPublic ? 'Turn the link off' : 'Create a public link'}
                  </Button>
                  {data.review.isPublic ? (
                    <a className="t-body-sm" href={`/r/${data.review.shareSlug}`} target="_blank" rel="noreferrer">
                      /r/{data.review.shareSlug}
                    </a>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          <div className="mt-lg flex gap-sm">
            <Button variant="primary" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              Finish review
            </Button>
            {period === 'monthly' ? <Button onClick={() => router.push('/review/reset')}>Run the monthly reset</Button> : null}
          </div>
        </>
      )}
    </div>
  );
}
