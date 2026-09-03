'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SerializedObject } from '@/lib/client-api';
import { HORIZONS, HORIZON_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  Button, Divider, EmptyState, Meta, ProgressBar, SectionHeader, Skeleton, Textarea, useToast,
} from '@/components/ui';

const STEPS = [
  { key: 'happened', title: 'What happened' },
  { key: 'mattered', title: 'What mattered' },
  { key: 'goals', title: 'Goals by horizon' },
  { key: 'projects', title: 'Projects' },
  { key: 'backlog', title: 'Backlog' },
  { key: 'money', title: 'Money' },
  { key: 'next', title: 'Next month' },
] as const;

type Verdict = 'keep' | 'edit' | 'done' | 'drop';

/**
 * The one place a wizard is right. One step per screen, a progress rail down
 * the left, every step skippable. Ten minutes.
 */
export default function MonthlyResetPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: review } = useQuery({
    queryKey: ['review', 'monthly'],
    queryFn: () => api.get<{ review: { data: { counts: Record<string, number>; areas: { key: string; label: string; value: number; delta: number }[]; themes: { theme: string; count: number }[] } } }>('/api/review/monthly'),
  });

  const { data: goals } = useQuery({
    queryKey: ['objects', { type: 'goal', reset: true }],
    queryFn: () => api.get<{ objects: SerializedObject[] }>('/api/objects?type=goal&completed=false&limit=200'),
  });

  const { data: projects } = useQuery({
    queryKey: ['objects', { type: 'project', reset: true }],
    queryFn: () => api.get<{ objects: SerializedObject[] }>('/api/objects?type=project&limit=200'),
  });

  const finish = useMutation({
    mutationFn: () =>
      api.post('/api/review/monthly/confirm', {
        answers: notes,
        changes: Object.entries(verdicts).map(([objectId, action]) => ({ objectId, action })),
      }),
    onSuccess: () => {
      toast.show('Next month is set');
      void qc.invalidateQueries({ queryKey: ['objects'] });
      router.push('/');
    },
  });

  const active = projects?.objects.filter((p) => p.status === 'active') ?? [];
  const overloaded = active.length > 4;
  const current = STEPS[step]!;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[900px] gap-xl p-xl">
      <nav aria-label="Reset steps" className="hidden w-[160px] shrink-0 flex-col gap-xxs tablet:flex">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            className={cn(
              't-body-sm flex h-row items-center gap-sm rounded-sm px-xs text-left',
              i === step ? 'bg-surface-2 text-ink' : 'text-ink-subtle hover:bg-surface-1',
            )}
          >
            <span className="t-numeric w-[16px] tabular">{i + 1}</span>
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <header className="mb-lg">
          <Meta>
            Step {step + 1} of {STEPS.length}
          </Meta>
          <h1 className="t-display mt-xxs">{current.title}</h1>
        </header>

        {current.key === 'happened' ? (
          review ? (
            <div className="flex flex-col gap-lg">
              <div className="grid grid-cols-2 gap-lg tablet:grid-cols-4">
                {Object.entries(review.review.data.counts).map(([k, v]) => (
                  <div key={k} className="flex flex-col border-b border-hairline py-sm">
                    <span className="t-micro text-ink-subtle">{k}</span>
                    <span className="t-numeric-lg">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                {review.review.data.areas.map((a) => (
                  <div key={a.key} className="flex h-row items-center gap-md border-b border-hairline px-xs">
                    <span className="t-body-sm w-[130px]">{a.label}</span>
                    <ProgressBar value={a.value} className="flex-1" label={a.label} />
                    <span className="t-numeric w-[44px] text-right tabular">{a.value}%</span>
                    <span className="t-caption w-[36px] text-right text-ink-subtle tabular">
                      {a.delta > 0 ? `+${a.delta}` : a.delta}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Skeleton className="h-[240px] w-full" />
          )
        ) : null}

        {current.key === 'mattered' ? (
          <div className="flex flex-col gap-md">
            {review?.review.data.themes.length ? (
              <>
                <SectionHeader title="What you kept writing about" size="micro" as="h2" />
                {review.review.data.themes.map((t) => (
                  <div key={t.theme} className="flex h-row items-center gap-md border-b border-hairline px-xs">
                    <span className="t-body-sm flex-1">“{t.theme}”</span>
                    <span className="t-numeric text-ink-subtle tabular">{t.count}×</span>
                  </div>
                ))}
              </>
            ) : (
              <Meta>No recurring themes this month.</Meta>
            )}
            <Textarea
              rows={4}
              placeholder="What actually mattered this month?"
              value={notes.mattered ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, mattered: e.target.value }))}
            />
          </div>
        ) : null}

        {current.key === 'goals' ? (
          <div className="flex flex-col gap-xl">
            {HORIZONS.map((h) => {
              const items = goals?.objects.filter((g) => g.horizon === h) ?? [];
              if (!items.length) return null;
              return (
                <section key={h}>
                  <SectionHeader title={HORIZON_LABEL[h]} size="heading-sm" as="h2" count={items.length} />
                  {items.map((g) => (
                    <div key={g.id} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                      <span className="t-body-sm min-w-0 flex-1 truncate">{g.title}</span>
                      <span className="t-numeric w-[44px] text-right tabular">
                        {Math.round(Number(g.progress))}%
                      </span>
                      {(['keep', 'edit', 'done', 'drop'] as Verdict[]).map((v) => (
                        <Button
                          key={v}
                          size="sm"
                          variant={verdicts[g.id] === v ? 'secondary' : 'ghost'}
                          onClick={() => setVerdicts((s) => ({ ...s, [g.id]: v }))}
                        >
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </Button>
                      ))}
                    </div>
                  ))}
                </section>
              );
            })}
            {!goals?.objects.length ? <EmptyState message="No goals yet." /> : null}
          </div>
        ) : null}

        {current.key === 'projects' ? (
          <div className="flex flex-col gap-md">
            {overloaded ? (
              <p className="t-body max-w-measure text-ink">
                {active.length} active projects. Four is usually the point past which everything
                slows down. Park two and the rest move faster.
              </p>
            ) : (
              <Meta>{active.length} active projects. That is a workable number.</Meta>
            )}
            {active.map((p) => (
              <div key={p.id} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                <span className="t-body-sm min-w-0 flex-1 truncate">{p.title}</span>
                <span className="t-numeric w-[44px] text-right tabular">
                  {Math.round(Number(p.progress))}%
                </span>
                {(['keep', 'park', 'drop'] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={verdicts[p.id] === (v as Verdict) ? 'secondary' : 'ghost'}
                    onClick={() => setVerdicts((s) => ({ ...s, [p.id]: (v === 'park' ? 'edit' : v) as Verdict }))}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {current.key === 'backlog' ? (
          <div className="flex flex-col gap-md">
            <Meta>Anything you have not touched in a year is worth a decision.</Meta>
            <Button onClick={() => router.push('/work/backlog')}>Open the backlog</Button>
          </div>
        ) : null}

        {current.key === 'money' ? (
          <div className="flex flex-col gap-md">
            <Meta>Check the goals that are behind and pick one lever.</Meta>
            <Button onClick={() => router.push('/money')}>Open Money</Button>
          </div>
        ) : null}

        {current.key === 'next' ? (
          <div className="flex flex-col gap-md">
            <Textarea
              rows={5}
              placeholder="What does next month look like if it goes well?"
              value={notes.next ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, next: e.target.value }))}
            />
          </div>
        ) : null}

        <Divider clearance="lg" />

        <div className="flex items-center gap-sm">
          <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <>
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
              <Button onClick={() => setStep((s) => s + 1)}>Skip</Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => finish.mutate()} disabled={finish.isPending}>
              Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
