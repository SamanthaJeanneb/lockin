'use client';
import { useState } from 'react';
import { api } from '@/lib/client-api';
import { AREA_SERIES, HORIZON_LABEL, type Horizon } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button, CategoryChip, Input, Meta, Textarea } from '@/components/ui';

export interface DraftGoal {
  horizon: Horizon;
  title: string;
  area: string;
}

/**
 * The five horizons, asked in the order a person can actually answer them:
 * this week is concrete, ten years is not, and starting at ten years is why
 * people stall on goal-setting screens.
 */
const LANES: { horizon: Horizon; label: string; ask: string; hint: string }[] = [
  {
    horizon: '1w',
    label: 'This week',
    ask: 'What would make the next seven days count?',
    hint: 'Finish the deck. Book the dentist. Run three times.',
  },
  {
    horizon: '1m',
    label: 'This month',
    ask: 'What should be different by the end of the month?',
    hint: 'Ship the new pricing page. Save £400.',
  },
  {
    horizon: '3m',
    label: 'Three months',
    ask: 'What are you building towards this quarter?',
    hint: 'Have a working prototype. Run 10k without stopping.',
  },
  {
    horizon: '1y',
    label: 'A year',
    ask: 'Where do you want to be in a year?',
    hint: 'In a job I want. Three months of expenses saved.',
  },
  {
    horizon: '10y',
    label: 'Ten years',
    ask: 'What is the long version?',
    hint: 'Vague is fine here — it is supposed to be.',
  },
];

/**
 * Goal setting as writing, not data entry.
 *
 * People do not think in rows with an area and a horizon attached. They think
 * in "what do I want this year", and the horizon is already answered by which
 * box they are typing in. So: write freely in five boxes, then the model reads
 * it back as goals you can correct. Nothing is saved until it is confirmed —
 * a model rewording someone's own words about their own life is a proposal,
 * never a decision.
 */
export function GoalWorkspace({
  drafts,
  setDrafts,
  goals,
  setGoals,
  areas,
}: {
  drafts: Record<string, string>;
  setDrafts: (next: Record<string, string>) => void;
  goals: DraftGoal[] | null;
  setGoals: (next: DraftGoal[] | null) => void;
  areas: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const written = LANES.filter((l) => drafts[l.horizon]?.trim());

  async function sort() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await api.post<{ goals: DraftGoal[]; sorted: boolean }>('/api/goals/sort', {
        entries: written.map((l) => ({ horizon: l.horizon, text: drafts[l.horizon] })),
      });
      setGoals(res.goals);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  // ---- Review: what the model made of it, still editable ------------------
  if (goals) {
    return (
      <div className="mt-lg flex flex-col gap-lg">
        <Meta>
          {goals.length} goal{goals.length === 1 ? '' : 's'}, in your words. Fix any of it — the
          text, or the area if it guessed wrong. Anything you delete is gone.
        </Meta>

        {LANES.filter((l) => goals.some((g) => g.horizon === l.horizon)).map((lane) => (
          <section key={lane.horizon} className="flex flex-col gap-xs">
            <h3 className="t-micro text-ink-subtle">{HORIZON_LABEL[lane.horizon]}</h3>
            {goals.map((g, i) =>
              g.horizon !== lane.horizon ? null : (
                <div key={i} className="flex items-center gap-sm border-b border-hairline py-xs">
                  <Input
                    aria-label={`Goal, ${HORIZON_LABEL[lane.horizon]}`}
                    value={g.title}
                    onChange={(e) =>
                      setGoals(goals.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                    }
                    className="flex-1 border-0 px-0"
                  />
                  <CategoryChip
                    series={AREA_SERIES[g.area] ?? 1}
                    className="cursor-pointer"
                    onClick={() =>
                      setGoals(
                        goals.map((x, j) =>
                          j === i
                            ? { ...x, area: areas[(areas.indexOf(x.area) + 1) % areas.length]! }
                            : x,
                        ),
                      )
                    }
                    title="Click to change area"
                  >
                    {g.area}
                  </CategoryChip>
                  <button
                    type="button"
                    aria-label={`Remove ${g.title}`}
                    onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                    className="t-caption shrink-0 text-ink-faint hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              ),
            )}
          </section>
        ))}

        <div>
          <Button onClick={() => setGoals(null)}>Back to writing</Button>
        </div>
      </div>
    );
  }

  // ---- Write --------------------------------------------------------------
  return (
    <div className="mt-lg flex flex-col gap-lg">
      <Meta>
        Write what you want at each distance. Plain sentences, one per line — no need to phrase
        them as goals, that part is handled for you. Skip any box that has nothing in it yet.
      </Meta>

      {LANES.map((lane) => (
        <section key={lane.horizon} className="flex flex-col gap-xs">
          <div className="flex items-baseline gap-sm">
            <h3 className="t-body-sm">{lane.label}</h3>
            <Meta>{lane.ask}</Meta>
          </div>
          <Textarea
            autoGrow
            rows={2}
            aria-label={lane.label}
            value={drafts[lane.horizon] ?? ''}
            placeholder={lane.hint}
            onChange={(e) => setDrafts({ ...drafts, [lane.horizon]: e.target.value })}
          />
        </section>
      ))}

      {failed ? (
        <p role="alert" className="t-caption rounded-md border border-hairline-focus p-sm text-ink">
          Could not sort those just now. Your text is still here — try again.
        </p>
      ) : null}

      <div className={cn('flex items-center gap-sm', !written.length && 'opacity-60')}>
        <Button variant="primary" onClick={() => void sort()} disabled={busy || !written.length}>
          {busy ? 'Reading…' : 'Sort into goals'}
        </Button>
        <Meta>
          {written.length
            ? `${written.length} of 5 filled in`
            : 'Fill in at least one to continue'}
        </Meta>
      </div>
    </div>
  );
}
