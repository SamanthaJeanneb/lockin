import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';

/**
 * Midnight rollover. Nothing breaks when a day is missed: open Today items
 * carry over, tagged so the debrief can offer "also log yesterday?".
 */
export async function rolloverJob({ userId }: { userId?: string } = {}) {
  const where = [
    eq(object.status, 'today'),
    isNull(object.completedAt),
    isNull(object.deletedAt),
    lt(object.updatedAt, sql`date_trunc('day', now())`),
  ];
  if (userId) where.push(eq(object.userId, userId));

  const rows = await db
    .update(object)
    .set({ props: sql`${object.props} || jsonb_build_object('carried_over', true)` })
    .where(and(...where))
    .returning({ id: object.id });

  // Snoozes that have expired come back into view.
  await db
    .update(object)
    .set({ snoozeUntil: null })
    .where(and(sql`${object.snoozeUntil} < now()`, isNull(object.completedAt)));

  return { carried: rows.length };
}
