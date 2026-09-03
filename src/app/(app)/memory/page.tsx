'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { relative } from '@/lib/format';
import { useContextPane } from '@/hooks/useContextPane';
import {
  Button, Divider, EmptyState, Input, Meta, SectionHeader, Skeleton, useToast,
} from '@/components/ui';

interface Fact {
  id: string;
  statement: string;
  confidence: number;
  status: string;
  sourceCount: number;
  updatedAt: string;
  sources: { id: string; title: string; type: string; created_at: string }[];
}

interface MemoryData {
  categories: { key: string; label: string; facts: Fact[] }[];
  total: number;
}

const ACTIONS = [
  ['confirmed', 'Right'],
  ['wrong', 'Wrong'],
  ['changed', 'Changed'],
  ['private', 'Make private'],
  ['forgotten', 'Forget'],
] as const;

/** Every fact exposes its evidence; clicking a source opens it in the context
 *  pane. Nothing here is asserted that cannot be shown. */
export default function MemoryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { open } = useContextPane();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['memory'],
    queryFn: () => api.get<MemoryData>('/api/memory'),
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/memory/${id}`, { status }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['memory'] });
      toast.show(v.status === 'forgotten' ? 'Forgotten' : 'Thanks — noted');
    },
  });

  const ask = useMutation({
    mutationFn: () => api.post<{ answer: string }>('/api/memory/ask', { question }),
    onSuccess: (res) => setAnswer(res.answer),
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Could not answer'),
  });

  const shown = data?.categories.filter((c) => (category ? c.key === category : true)) ?? [];

  return (
    <div className="flex min-h-full">
      <nav className="hidden w-[180px] shrink-0 border-r border-hairline p-lg compact:block">
        <SectionHeader title="Categories" size="micro" as="h2" />
        <button
          onClick={() => setCategory(null)}
          className={`t-body-sm flex h-row w-full items-center rounded-sm px-xs text-left ${!category ? 'bg-surface-2' : 'hover:bg-surface-1'}`}
        >
          All
        </button>
        {(data?.categories ?? []).map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`t-body-sm flex h-row w-full items-center gap-sm rounded-sm px-xs text-left ${category === c.key ? 'bg-surface-2' : 'hover:bg-surface-1'}`}
          >
            <span className="flex-1 truncate">{c.label}</span>
            <span className="t-micro text-ink-faint tabular">{c.facts.length}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 p-xl">
        <header className="mb-lg">
          <h1 className="t-display">Memory</h1>
          <Meta className="mt-xxs block">
            What the system believes about you, and the evidence for each of it.
          </Meta>
        </header>

        <form
          className="flex gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            ask.mutate();
          }}
        >
          <Input
            value={question}
            placeholder="What do you think you know about me?"
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={ask.isPending}>
            {ask.isPending ? 'Thinking…' : 'Ask'}
          </Button>
        </form>

        {answer ? (
          <p className="t-body mt-md max-w-measure whitespace-pre-line text-ink-muted">{answer}</p>
        ) : null}

        <Divider clearance="lg" />

        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : data?.total ? (
          shown.map((c) =>
            c.facts.length ? (
              <section key={c.key} className="mb-xl">
                <SectionHeader title={c.label} size="heading-sm" as="h2" count={`${c.facts.length} facts`} />
                <div className="flex flex-col gap-lg">
                  {c.facts.map((f) => (
                    <article key={f.id} className="border-b border-hairline pb-md">
                      <p className="t-body max-w-measure">{f.statement}</p>
                      <Meta className="mt-xs block">
                        confidence {Math.round(f.confidence * 100)}% · {f.sourceCount} sources · updated{' '}
                        {relative(f.updatedAt)}
                        {f.status !== 'active' ? ` · ${f.status}` : ''}
                      </Meta>
                      <div className="mt-sm flex flex-wrap gap-xs">
                        {ACTIONS.map(([status, label]) => (
                          <Button
                            key={status}
                            size="sm"
                            onClick={() => update.mutate({ id: f.id, status })}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      {f.sources.length ? (
                        <details className="mt-sm">
                          <summary className="t-caption cursor-default text-ink-subtle">
                            sources
                          </summary>
                          <div className="mt-xs flex flex-col">
                            {f.sources.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => open(s.id)}
                                className="t-caption flex h-row-compact items-center gap-sm rounded-sm px-xs text-left text-ink-muted hover:bg-surface-1"
                              >
                                <span className="w-[70px] shrink-0">{s.type}</span>
                                <span className="truncate">{s.title}</span>
                              </button>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null,
          )
        ) : (
          <EmptyState message="Nothing learned yet. Facts accumulate from journal entries, completions and decisions — usually a couple of weeks in." />
        )}
      </div>
    </div>
  );
}
