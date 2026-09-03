import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { db } from '@/lib/db/client';
import { appUser, review } from '@/lib/db/schema';
import { AREA_SERIES } from '@/lib/constants';
import { formatMinutes } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface AnnualData {
  counts: { completed: number; created: number; journals: number };
  areas: { key: string; label: string; value: number; delta: number }[];
  effort: { area: string; minutes: number }[];
  themes: { theme: string; count: number }[];
  people: { id: string; title: string; interactions: number }[];
  completed: { id: string; title: string; type: string }[];
  observations: { title: string; body: string }[];
  start: string;
  end: string;
}

/**
 * The shareable annual page. Public only when the owner has toggled it on, and
 * deliberately narrow: counts, themes, milestones and people — no journal text,
 * no money, no open work.
 */
export default async function SharedReview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [row] = await db
    .select({
      data: review.data,
      period: review.period,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      isPublic: review.isPublic,
      userId: review.userId,
    })
    .from(review)
    .where(and(eq(review.shareSlug, slug), eq(review.isPublic, true)))
    .limit(1);

  if (!row) notFound();

  const [owner] = await db
    .select({ name: appUser.name, identity: appUser.identityStatement })
    .from(appUser)
    .where(eq(appUser.id, row.userId))
    .limit(1);

  const d = row.data as unknown as AnnualData;
  const year = format(new Date(row.periodStart), 'yyyy');
  const milestones = (d.completed ?? []).filter((c) => c.type === 'milestone');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-measure flex-col gap-section p-2xl">
      <header>
        <p className="t-micro text-ink-subtle">{owner?.name ?? 'A year'}</p>
        <h1 className="t-display mt-xs">{year}</h1>
        {owner?.identity ? (
          <p className="t-body mt-sm text-ink-muted">“{owner.identity}”</p>
        ) : null}
      </header>

      <section className="grid grid-cols-3 gap-lg">
        {[
          ['Completed', d.counts?.completed ?? 0],
          ['Started', d.counts?.created ?? 0],
          ['Written', d.counts?.journals ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex flex-col gap-xxs border-b border-hairline py-md">
            <span className="t-micro text-ink-subtle">{label}</span>
            <span className="t-numeric-lg">{value}</span>
          </div>
        ))}
      </section>

      {d.effort?.length ? (
        <section>
          <h2 className="t-heading mb-sm">Where the year went</h2>
          <div className="flex flex-col">
            {d.effort.map((e) => {
              const max = Math.max(...d.effort.map((x) => x.minutes));
              return (
                <div key={e.area} className="flex h-row items-center gap-sm">
                  <span
                    aria-hidden
                    className="size-[6px] shrink-0 rounded-full"
                    style={{ background: `var(--series-${AREA_SERIES[e.area] ?? 10})` }}
                  />
                  <span className="t-body-sm w-gutter shrink-0 truncate">{e.area}</span>
                  <span className="h-[8px] flex-1 overflow-hidden rounded-sm bg-surface-2">
                    <span
                      className="block h-full rounded-sm"
                      style={{
                        width: `${(e.minutes / max) * 100}%`,
                        background: `var(--series-${AREA_SERIES[e.area] ?? 10})`,
                      }}
                    />
                  </span>
                  <span className="t-numeric w-[70px] shrink-0 text-right tabular">
                    {formatMinutes(e.minutes)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {milestones.length ? (
        <section>
          <h2 className="t-heading mb-sm">What got finished</h2>
          <ul className="flex flex-col">
            {milestones.slice(0, 24).map((m) => (
              <li key={m.id} className="t-body border-b border-hairline py-sm">
                {m.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.themes?.length ? (
        <section>
          <h2 className="t-heading mb-sm">What kept coming up</h2>
          <div className="flex flex-col">
            {d.themes.slice(0, 10).map((t) => (
              <div key={t.theme} className="flex h-row items-center gap-md border-b border-hairline">
                <span className="t-body flex-1">“{t.theme}”</span>
                <span className="t-numeric text-ink-subtle tabular">{t.count}×</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {d.people?.length ? (
        <section>
          <h2 className="t-heading mb-sm">Who was there</h2>
          <p className="t-body text-ink-muted">
            {d.people.slice(0, 30).map((p) => p.title).join(' · ')}
          </p>
        </section>
      ) : null}

      {d.observations?.length ? (
        <section>
          <h2 className="t-heading mb-sm">How the year went</h2>
          {d.observations.map((o) => (
            <div key={o.title} className="mb-md">
              <h3 className="t-heading-sm">{o.title}</h3>
              <p className="t-read mt-xs text-ink-muted">{o.body}</p>
            </div>
          ))}
        </section>
      ) : null}

      <footer className="t-caption border-t border-hairline pt-lg text-ink-subtle">
        {format(new Date(row.periodStart), 'd MMM yyyy')} –{' '}
        {format(new Date(row.periodEnd), 'd MMM yyyy')} · made with Life OS
      </footer>
    </main>
  );
}
