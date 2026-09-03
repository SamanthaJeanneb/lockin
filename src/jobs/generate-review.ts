import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import {
  endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear, subDays,
} from 'date-fns';
import { db } from '@/lib/db/client';
import { activity, appUser, object, review, transaction } from '@/lib/db/schema';
import { askJson } from '@/lib/ai/client';
import { OBSERVATION_SYSTEM } from '@/lib/ai/prompts';
import { promptContext } from '@/lib/ai/context';
import { latestAreaProgress } from '@/lib/db/queries';
import { features } from '@/lib/env';
import { uid } from '@/lib/utils';

export type ReviewPeriod = 'weekly' | 'monthly' | 'annual';

function windowFor(period: ReviewPeriod, ref = new Date()) {
  if (period === 'weekly') {
    return { start: startOfWeek(ref, { weekStartsOn: 1 }), end: endOfWeek(ref, { weekStartsOn: 1 }) };
  }
  if (period === 'monthly') return { start: startOfMonth(ref), end: endOfMonth(ref) };
  return { start: startOfYear(ref), end: endOfYear(ref) };
}

export async function generateReviewJob({
  userId,
  period = 'weekly',
  ref,
}: {
  userId?: string;
  period?: ReviewPeriod;
  ref?: string;
}) {
  const users = userId ? [{ id: userId }] : await db.select({ id: appUser.id }).from(appUser);
  const at = ref ? new Date(ref) : new Date();
  const { start, end } = windowFor(period, at);
  const out: string[] = [];

  for (const u of users) {
    const data = await buildReviewData(u.id, start, end, period);
    const [row] = await db
      .insert(review)
      .values({
        userId: u.id,
        period,
        periodStart: format(start, 'yyyy-MM-dd'),
        periodEnd: format(end, 'yyyy-MM-dd'),
        data,
        shareSlug: period === 'annual' ? `${format(start, 'yyyy')}-${uid().slice(0, 8)}` : null,
      })
      .onConflictDoUpdate({
        target: [review.userId, review.period, review.periodStart],
        set: { data, generatedAt: new Date() },
      })
      .returning({ id: review.id });
    out.push(row!.id);
  }
  return { reviews: out };
}

export async function buildReviewData(
  userId: string,
  start: Date,
  end: Date,
  period: ReviewPeriod,
) {
  const [completed, created, postponed, areas, journals, spend, people] = await Promise.all([
    db
      .select({
        id: object.id, title: object.title, type: object.type, area: object.area,
        at: object.completedAt, minutes: object.estimateMinutes,
      })
      .from(object)
      .where(
        and(eq(object.userId, userId), gte(object.completedAt, start), lt(object.completedAt, end),
            isNull(object.deletedAt)),
      )
      .orderBy(desc(object.completedAt))
      .limit(300),

    db.execute(sql`select count(*)::text as n from object
        where user_id = ${userId}
          and created_at >= ${start.toISOString()}::timestamptz
          and created_at < ${end.toISOString()}::timestamptz
          and deleted_at is null`),

    db
      .select({ id: object.id, title: object.title, type: object.type })
      .from(object)
      .where(
        and(
          eq(object.userId, userId), isNull(object.completedAt), isNull(object.deletedAt),
          sql`exists (select 1 from activity a where a.object_id = ${object.id}
                       and a.verb = 'snoozed'
                       and a.at >= ${start.toISOString()}::timestamptz
                       and a.at < ${end.toISOString()}::timestamptz)`,
        ),
      )
      .limit(40),

    latestAreaProgress(userId),

    db
      .select({ id: object.id, title: object.title, body: object.body, props: object.props,
                at: object.createdAt })
      .from(object)
      .where(and(eq(object.userId, userId), eq(object.type, 'journal'),
                 gte(object.createdAt, start), lt(object.createdAt, end)))
      .orderBy(desc(object.createdAt))
      .limit(60),

    db.execute(sql`
      select coalesce(category,'other') as category, sum(abs(amount))::text as total
        from "transaction"
       where user_id = ${userId} and amount < 0 and is_transfer = false
         and posted_at >= ${format(start, 'yyyy-MM-dd')}
         and posted_at < ${format(end, 'yyyy-MM-dd')}
       group by 1 order by 2 desc limit 12`),

    db.execute(sql`
      select o.id, o.title, count(i.id)::text as interactions
        from object o
        left join edge e on e.to_id = o.id and e.rel = 'with'
        left join object i on i.id = e.from_id and i.type = 'interaction'
             and i.created_at >= ${start.toISOString()}::timestamptz
             and i.created_at < ${end.toISOString()}::timestamptz
       where o.user_id = ${userId} and o.type = 'person' and o.deleted_at is null
       group by o.id, o.title having count(i.id) > 0 order by 3 desc limit 20`),
  ]);

  const themes = new Map<string, number>();
  for (const j of journals) {
    for (const t of ((j.props as { themes?: string[] }).themes ?? [])) {
      themes.set(t, (themes.get(t) ?? 0) + 1);
    }
  }

  const effort = new Map<string, number>();
  for (const c of completed) {
    const key = c.area ?? 'unlinked';
    effort.set(key, (effort.get(key) ?? 0) + (c.minutes ?? 30));
  }

  const data = {
    period,
    start: start.toISOString(),
    end: end.toISOString(),
    counts: {
      completed: completed.length,
      created: Number((created as unknown as { n: string }[])[0]?.n ?? 0),
      postponed: postponed.length,
      journals: journals.length,
    },
    completed: completed.slice(0, 60),
    postponed,
    areas,
    effort: [...effort.entries()].map(([area, minutes]) => ({ area, minutes })),
    themes: [...themes.entries()].sort((a, b) => b[1] - a[1]).map(([theme, count]) => ({ theme, count })),
    spending: (spend as unknown as { category: string; total: string }[]).map((s) => ({
      category: s.category,
      total: Number(s.total),
    })),
    people: (people as unknown as { id: string; title: string; interactions: string }[]).map((p) => ({
      id: p.id,
      title: p.title,
      interactions: Number(p.interactions),
    })),
    observations: [] as { title: string; body: string; url?: string }[],
  };

  if (features.ai && completed.length) {
    const ctx = await promptContext(userId, { withOpenItems: false });
    const obs = await askJson<{ observations: { title: string; body: string; url?: string }[] }>({
      system: OBSERVATION_SYSTEM(ctx),
      user: JSON.stringify({
        counts: data.counts,
        effort: data.effort,
        areas: data.areas,
        themes: data.themes,
        postponed: postponed.map((p) => p.title),
      }),
      maxTokens: 900,
      fallback: { observations: [] },
    });
    data.observations = obs.observations.slice(0, 3);
  }

  return data;
}
