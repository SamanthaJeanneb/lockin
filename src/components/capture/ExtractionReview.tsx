'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import type { Extraction } from '@/lib/db/schema';
import { formatDue, formatMoney } from '@/lib/format';
import { Button, Checkbox, Icon, InlineField, Meta, SectionHeader, Skeleton } from '@/components/ui';
import { iconFor } from '@/components/composite/ObjectDetail';

export interface ReferencedObject {
  id: string;
  title: string;
  type: string;
  unit: string | null;
  completedAt: string | null;
}

export interface ExtractionReviewProps {
  captureId: string;
  extraction: Extraction | null;
  referenced?: ReferencedObject[];
  loading: boolean;
  elapsed?: number;
  error?: string | null;
  onDone: (summary: string) => void;
}

/**
 * Everything the capture understood, in one card: what it thinks you finished,
 * what it wants to create, what you spent, and whether to keep the text as a
 * journal entry. Add all is the default and fires on dismiss — dismissing means
 * accepting, because the alternative is losing what you typed.
 *
 * Confidence decides the default, not the visibility: a 0.95 completion arrives
 * checked, a 0.6 one arrives named but unchecked. Unchecking is the only
 * friction the flow asks for, and only when it got something wrong.
 */
export function ExtractionReview({
  captureId, extraction, referenced = [], loading, elapsed = 0, error, onDone,
}: ExtractionReviewProps) {
  const [accepted, setAccepted] = useState<string[]>([]);
  const [completing, setCompleting] = useState<string[]>([]);
  const [snoozing, setSnoozing] = useState<string[]>([]);
  const [keptExpenses, setKeptExpenses] = useState<number[]>([]);
  const [keepJournal, setKeepJournal] = useState(false);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const rows = extraction?.objects ?? [];
  const completions = extraction?.completions ?? [];
  const notDone = extraction?.not_done ?? [];
  const expenses = extraction?.expenses ?? [];
  const journal = extraction?.journal ?? null;

  const byId = useMemo(() => new Map(referenced.map((r) => [r.id, r])), [referenced]);

  useEffect(() => {
    setAccepted(rows.filter((r) => r.confidence >= 0.5).map((r) => r.tmp));
    setCompleting(completions.filter((c) => c.confidence >= 0.85).map((c) => c.object_id));
    setSnoozing(notDone.map((n) => n.object_id));
    setKeptExpenses(expenses.map((_, i) => i));
    // A journal entry is only offered when the text reads as reflection, and
    // only kept if there is nothing else worth structuring.
    setKeepJournal(Boolean(journal?.body) && rows.length === 0 && completions.length === 0);
  }, [extraction]); // eslint-disable-line react-hooks/exhaustive-deps

  const links = useMemo(() => {
    const names = new Map(rows.map((r) => [r.tmp, r.title]));
    return (extraction?.edges ?? [])
      .map((e) => names.get(e.to) ?? byId.get(e.to)?.title ?? null)
      .filter(Boolean)
      .slice(0, 4) as string[];
  }, [extraction, rows, byId]);

  const nothing =
    rows.length === 0 &&
    completions.length === 0 &&
    expenses.length === 0 &&
    notDone.length === 0;

  async function resolve(noteOnly = false) {
    setSaving(true);
    try {
      const res = await api.post<{ created: unknown[]; summary: string[] }>(
        `/api/capture/${captureId}/resolve`,
        noteOnly
          ? { accept: [], noteOnly: true }
          : {
              accept: accepted,
              complete: completing,
              snooze: snoozing,
              expenses: keptExpenses,
              journal: keepJournal,
              edits,
            },
      );
      for (const key of ['objects', 'today', 'areas', 'progression', 'week', 'suggestions', 'goal-tree']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      onDone(noteOnly ? 'Kept as a note.' : (res.summary.join(' · ') || 'Saved.'));
    } finally {
      setSaving(false);
    }
  }

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  if (error) {
    return (
      <div className="flex flex-col gap-md px-xl py-lg">
        <p className="t-body">Your text is saved, but it could not be read into objects.</p>
        <Meta className="block">{error}</Meta>
        <Button variant="primary" className="self-start" onClick={() => void resolve(true)} disabled={saving}>
          Keep as note
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-sm px-xl py-lg">
        <Meta>
          {elapsed > 6 ? 'Still reading — a longer capture takes a few seconds…' : 'Reading what you wrote…'}
        </Meta>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-row w-full" />
        ))}
      </div>
    );
  }

  if (nothing) {
    return (
      <div className="px-xl py-lg">
        <Meta>Nothing structured to pull out — the raw text is saved.</Meta>
        <div className="mt-md">
          <Button variant="primary" onClick={() => void resolve(true)} disabled={saving}>
            Keep as note
          </Button>
        </div>
      </div>
    );
  }

  const found = rows.length + completions.length + expenses.length;

  return (
    <div className="flex flex-col px-xl py-lg">
      <div className="flex items-baseline justify-between">
        <h3 className="t-heading-sm">
          Found {found} thing{found === 1 ? '' : 's'}
        </h3>
        <Meta>from your text</Meta>
      </div>

      {/* What you finished. This is the half people forget a capture can do. */}
      {completions.length ? (
        <section className="mt-md">
          <SectionHeader title="Checking off" size="micro" as="h4" />
          <div className="flex flex-col">
            {completions.map((c) => {
              const target = byId.get(c.object_id);
              const checked = completing.includes(c.object_id);
              return (
                <div key={c.object_id} className="flex items-start gap-sm border-b border-hairline py-sm">
                  <div className="pt-xxs">
                    <Checkbox
                      checked={checked}
                      label={`Complete ${target?.title ?? 'item'}`}
                      onCheckedChange={() => toggle(completing, setCompleting, c.object_id)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="t-body block truncate">{target?.title ?? 'An item on your list'}</span>
                    {c.evidence ? <Meta className="block">“{c.evidence}”</Meta> : null}
                    {c.confidence < 0.85 ? (
                      <Meta className="block">lower confidence — check it if that is right</Meta>
                    ) : null}
                  </div>
                  <span className="t-micro shrink-0 pt-xxs text-ink-subtle tabular">
                    {Math.round(c.confidence * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {notDone.length ? (
        <section className="mt-md">
          <SectionHeader title="Pushing to tomorrow" size="micro" as="h4" />
          {notDone.map((n) => (
            <div key={n.object_id} className="flex items-center gap-sm border-b border-hairline py-sm">
              <Checkbox
                shape="square"
                checked={snoozing.includes(n.object_id)}
                label={`Snooze ${byId.get(n.object_id)?.title ?? 'item'}`}
                onCheckedChange={() => toggle(snoozing, setSnoozing, n.object_id)}
              />
              <span className="t-body-sm min-w-0 flex-1 truncate">
                {byId.get(n.object_id)?.title ?? 'An item on your list'}
              </span>
              <Meta>→ {n.snooze_to}</Meta>
            </div>
          ))}
        </section>
      ) : null}

      {rows.length ? (
        <section className="mt-md">
          {completions.length ? <SectionHeader title="Adding" size="micro" as="h4" /> : null}
          <div className="flex flex-col">
            {rows.map((r) => {
              const checked = accepted.includes(r.tmp);
              const dup = r.match?.candidates?.[0];
              return (
                <div key={r.tmp} className="flex items-start gap-sm border-b border-hairline py-sm">
                  <div className="pt-xxs">
                    <Checkbox
                      shape="square"
                      checked={checked}
                      label={`Include ${r.title}`}
                      onCheckedChange={() =>
                        setAccepted((a) => (checked ? a.filter((x) => x !== r.tmp) : [...a, r.tmp]))
                      }
                    />
                  </div>
                  <span className="pt-xxs text-ink-subtle">
                    <Icon name={iconFor(r.type)} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-sm">
                      <span className="t-micro w-[64px] shrink-0 text-ink-subtle">
                        {r.type.replace('_', ' ')}
                      </span>
                      <InlineField
                        label="Title"
                        value={(edits[r.tmp]?.title as string) ?? r.title}
                        onSave={(v) => setEdits((e) => ({ ...e, [r.tmp]: { ...e[r.tmp], title: v } }))}
                        className="min-w-0 flex-1"
                      />
                      {r.due_at ? <Meta>{formatDue(r.due_at)}</Meta> : null}
                    </div>
                    {r.props && Object.keys(r.props).length ? (
                      <Meta className="mt-xxs block truncate">
                        {Object.entries(r.props)
                          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                          .join(' · ')}
                      </Meta>
                    ) : null}
                    {r.match?.object_id ? (
                      <Meta className="mt-xxs block">Merging into an existing record.</Meta>
                    ) : dup ? (
                      <Meta className="mt-xxs block">
                        Possibly the same as “{dup.title}” — uncheck if it is.
                      </Meta>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {expenses.length ? (
        <section className="mt-md">
          <SectionHeader title="Money" size="micro" as="h4" />
          {expenses.map((e, i) => (
            <div key={`${e.merchant}-${i}`} className="flex items-center gap-sm border-b border-hairline py-sm">
              <Checkbox
                shape="square"
                checked={keptExpenses.includes(i)}
                label={`Record ${e.merchant}`}
                onCheckedChange={() =>
                  setKeptExpenses((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))
                }
              />
              <span className="t-body-sm flex-1 truncate">{e.merchant}</span>
              <Meta>{e.category}</Meta>
              <span className="t-numeric tabular">{formatMoney(e.amount)}</span>
            </div>
          ))}
        </section>
      ) : null}

      {journal?.body ? (
        <label className="mt-md flex items-center gap-sm">
          <Checkbox
            shape="square"
            checked={keepJournal}
            label="Save as a journal entry"
            onCheckedChange={setKeepJournal}
          />
          <span className="t-body-sm">Also save this as a journal entry</span>
          {journal.themes?.length ? <Meta>{journal.themes.join(' · ')}</Meta> : null}
        </label>
      ) : null}

      {links.length ? <Meta className="mt-md block">Linked to: {links.join(' · ')}</Meta> : null}

      {extraction?.questions?.length ? (
        <div className="mt-md flex flex-col gap-xs">
          {extraction.questions.map((q) => (
            <Meta key={q}>{q}</Meta>
          ))}
        </div>
      ) : null}

      <div className="mt-lg flex items-center gap-sm">
        <Button variant="primary" onClick={() => void resolve()} disabled={saving}>
          {completions.length && !rows.length ? 'Check them off' : 'Add all'}
        </Button>
        <Button onClick={() => void resolve(true)} disabled={saving}>
          Keep as note only
        </Button>
        <span className="t-caption ml-auto text-ink-faint">⌘↵ to confirm</span>
      </div>
    </div>
  );
}
