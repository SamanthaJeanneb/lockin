import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appUser, object } from '@/lib/db/schema';
import { median } from '@/lib/utils';
import { queueNotification } from '@/lib/notify/push';

/**
 * Cadence is learned, not configured: the rolling median gap between logged
 * interactions with a person. A median rather than a mean because one six-month
 * silence should not permanently redefine a weekly friendship.
 *
 * Fewer than three interactions is not enough to claim a rhythm, so no cadence
 * is asserted — the person simply shows their last-contact date.
 */
export async function learnCadenceJob({ userId }: { userId?: string } = {}) {
  const users = userId
    ? await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.id, userId))
    : await db.select({ id: appUser.id }).from(appUser);

  let learned = 0;
  let nudged = 0;

  for (const u of users) {
    const people = await db
      .select({ id: object.id, title: object.title, props: object.props })
      .from(object)
      .where(and(eq(object.userId, u.id), eq(object.type, 'person'), sql`${object.deletedAt} is null`));

    for (const p of people) {
      const interactions = (await db.execute(sql`
        select i.created_at
          from edge e
          join object i on i.id = e.from_id
         where e.to_id = ${p.id}::uuid and e.rel = 'with'
           and i.type = 'interaction' and i.deleted_at is null
         order by i.created_at desc
         limit 20
      `)) as unknown as { created_at: string }[];

      const props = p.props as { cadence_days?: number | null; last_interaction?: string };
      const last = interactions[0]?.created_at ?? props.last_interaction ?? null;

      let cadence = props.cadence_days ?? null;
      if (interactions.length >= 3) {
        const gaps: number[] = [];
        for (let i = 1; i < interactions.length; i++) {
          const a = new Date(interactions[i - 1]!.created_at).getTime();
          const b = new Date(interactions[i]!.created_at).getTime();
          gaps.push(Math.round(Math.abs(a - b) / 86_400_000));
        }
        cadence = Math.max(1, Math.round(median(gaps)));
        learned++;
      }

      await db
        .update(object)
        .set({
          props: sql`${object.props} || ${JSON.stringify({
            cadence_days: cadence,
            ...(last ? { last_interaction: new Date(last).toISOString() } : {}),
          })}::jsonb`,
        })
        .where(eq(object.id, p.id));

      // Overdue by half the cadence again is when a nudge is worth the
      // interruption — earlier than that is noise.
      if (cadence && last) {
        const days = Math.round((Date.now() - new Date(last).getTime()) / 86_400_000);
        if (days > cadence * 1.5) {
          await queueNotification(u.id, {
            kind: 'observation',
            title: `${p.title} — ${days} days`,
            body: `You usually talk about every ${cadence} days.`,
            url: '/people',
          });
          nudged++;
        }
      }
    }
  }

  return { learned, nudged };
}

/**
 * Emerging interests, detected from what someone saves rather than what they
 * say. Three or more saves sharing a theme inside sixty days is the threshold —
 * the same bar the journal patterns use, for the same reason.
 */
export async function detectInterestsJob({ userId }: { userId?: string } = {}) {
  const users = userId
    ? await db.select({ id: appUser.id }).from(appUser).where(eq(appUser.id, userId))
    : await db.select({ id: appUser.id }).from(appUser);

  let created = 0;

  for (const u of users) {
    const clusters = (await db.execute(sql`
      select theme, count(*)::text as n
        from (
          select jsonb_array_elements_text(coalesce(props->'themes', '[]'::jsonb)) as theme
            from object
           where user_id = ${u.id}
             and type in ('save', 'article', 'quote', 'book')
             and deleted_at is null
             and created_at > now() - interval '60 days'
        ) t
       group by theme having count(*) >= 3
    `)) as unknown as { theme: string; n: string }[];

    for (const c of clusters) {
      const existing = await db.execute(sql`
        select id from object
         where user_id = ${u.id} and type = 'interest' and deleted_at is null
           and similarity(title, ${c.theme}) > 0.7
         limit 1
      `);
      if ((existing as unknown as { id: string }[]).length) continue;

      await db.insert(object).values({
        userId: u.id,
        type: 'interest',
        title: c.theme,
        status: 'emerging',
        confidence: '0.6',
        inferredFields: ['status'],
        props: { detected_from: 'saves', count: Number(c.n) },
      });
      created++;
    }
  }

  return { created };
}
