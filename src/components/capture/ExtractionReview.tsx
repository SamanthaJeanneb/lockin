'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import type { Extraction } from '@/lib/db/schema';
import { formatDue } from '@/lib/format';
import { Button, Checkbox, Icon, InlineField, Meta, Skeleton } from '@/components/ui';
import { iconFor } from '@/components/composite/ObjectDetail';

export interface ExtractionReviewProps {
  captureId: string;
  extraction: Extraction | null;
  loading: boolean;
  elapsed?: number;
  error?: string | null;
  onDone: (summary: string) => void;
}

/**
 * Add all is the default and fires automatically on dismiss — dismissing means
 * accepting, because the alternative is losing what you typed. Unchecking is the
 * only friction the flow ever asks for, and only when the AI got it wrong.
 */
export function ExtractionReview({
  captureId, extraction, loading, elapsed = 0, error, onDone,
}: ExtractionReviewProps) {
  const [accepted, setAccepted] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const rows = extraction?.objects ?? [];

  useEffect(() => {
    setAccepted(rows.filter((r) => r.confidence >= 0.5).map((r) => r.tmp));
  }, [extraction]); // eslint-disable-line react-hooks/exhaustive-deps

  const links = useMemo(() => {
    const names = new Map(rows.map((r) => [r.tmp, r.title]));
    return (extraction?.edges ?? [])
      .map((e) => names.get(e.to) ?? null)
      .filter(Boolean)
      .slice(0, 4) as string[];
  }, [extraction, rows]);

  async function resolve(noteOnly = false) {
    setSaving(true);
    try {
      const res = await api.post<{ created: { id: string }[] }>(
        `/api/capture/${captureId}/resolve`,
        { accept: noteOnly ? [] : accepted, edits, noteOnly },
      );
      void qc.invalidateQueries({ queryKey: ['objects'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      onDone(
        noteOnly
          ? 'Kept as a note.'
          : `Added ${res.created.length} thing${res.created.length === 1 ? '' : 's'}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col gap-md px-xl py-lg">
        <p className="t-body">Your text is saved, but it could not be read into objects.</p>
        <Meta className="block">{error}</Meta>
        <div className="flex gap-sm">
          <Button variant="primary" onClick={() => void resolve(true)} disabled={saving}>
            Keep as note
          </Button>
        </div>
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

  if (!rows.length) {
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

  return (
    <div className="flex flex-col px-xl py-lg">
      <div className="flex items-baseline justify-between">
        <h3 className="t-heading-sm">Found {rows.length} thing{rows.length === 1 ? '' : 's'}</h3>
        <Meta>from your text</Meta>
      </div>

      <div className="mt-md flex flex-col">
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
                  onCheckedChange={(next) =>
                    setAccepted((a) => (next ? [...a, r.tmp] : a.filter((x) => x !== r.tmp)))
                  }
                />
              </div>
              <span className="pt-xxs text-ink-subtle">
                <Icon name={iconFor(r.type)} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-sm">
                  <span className="t-micro w-[64px] shrink-0 text-ink-subtle">{r.type.replace('_', ' ')}</span>
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
                {dup && !r.match?.object_id ? (
                  <Meta className="mt-xxs block">
                    Possibly the same as “{dup.title}” — uncheck if it is.
                  </Meta>
                ) : null}
                {r.match?.object_id ? (
                  <Meta className="mt-xxs block">Merging into an existing record.</Meta>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

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
          Add all
        </Button>
        <Button onClick={() => void resolve(true)} disabled={saving}>
          Keep as note only
        </Button>
        <span className="t-caption ml-auto text-ink-faint">⌘↵ to add</span>
      </div>
    </div>
  );
}
