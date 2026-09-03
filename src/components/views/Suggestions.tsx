'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/client-api';
import { useApp } from '@/lib/store';
import { useContextPane } from '@/hooks/useContextPane';
import { Button, Meta, SectionHeader, Skeleton } from '@/components/ui';

interface Suggestion {
  id: string;
  kind: string;
  title: string;
  body: string;
  weight: number;
  action?: { label: string; href?: string; objectId?: string };
}

/**
 * Every line here is a count or a date the user could check themselves. Nothing
 * is a guess about how they feel, and nothing appears unless a threshold is
 * crossed — so an empty list is the right answer most days, and says so.
 */
export function Suggestions() {
  const router = useRouter();
  const openModal = useApp((s) => s.openModal);
  const { open } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.get<{ suggestions: Suggestion[] }>('/api/suggestions'),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <section>
        <SectionHeader title="Worth a look" size="heading" as="h2" />
        <Skeleton className="h-[64px] w-full" />
      </section>
    );
  }

  const items = data?.suggestions ?? [];

  return (
    <section aria-label="Suggestions">
      <SectionHeader title="Worth a look" size="heading" as="h2" count={items.length || undefined} />

      {items.length ? (
        <div role="list" className="flex flex-col">
          {items.map((s) => (
            <div
              key={s.id}
              role="listitem"
              className="group/row flex items-start gap-md border-b border-hairline py-md"
            >
              <span aria-hidden className="mt-xxs shrink-0 text-ink-subtle">
                <ArrowRight size={14} strokeWidth={1.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="t-body">{s.title}</p>
                <Meta className="mt-xxs block">{s.body}</Meta>
              </div>
              {s.action ? (
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    if (s.action?.objectId) open(s.action.objectId);
                    else if (s.action?.href === '#capture') openModal('capture');
                    else if (s.action?.href) router.push(s.action.href);
                  }}
                >
                  {s.action.label}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Meta>
          Nothing is off track, overdue, or unlinked. That is the correct answer most days.
        </Meta>
      )}
    </section>
  );
}
