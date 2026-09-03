import { z } from 'zod';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { db } from '@/lib/db/client';
import { object, review } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';

const Body = z.object({
  answers: z.record(z.string(), z.unknown()).default({}),
  changes: z
    .array(
      z.object({
        objectId: z.string().uuid(),
        action: z.enum(['do', 'park', 'drop', 'keep', 'edit', 'done']),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .default([]),
  isPublic: z.boolean().optional(),
});

/** Do / Park / Drop on postponed items, plus the horizon-by-horizon verdicts
 *  from the monthly reset. */
export async function POST(req: Request, { params }: { params: Promise<{ period: string }> }) {
  try {
    const user = await requireUser();
    const { period } = await params;
    const b = await parseBody(req, Body);

    for (const c of b.changes) {
      const scope = and(eq(object.userId, user.id), eq(object.id, c.objectId));
      switch (c.action) {
        case 'do':
          await db.update(object).set({ status: 'today', snoozeUntil: null }).where(scope);
          break;
        case 'park':
          await db
            .update(object)
            .set({ status: 'someday', snoozeUntil: addDays(new Date(), 30) })
            .where(scope);
          break;
        case 'drop':
          await db.update(object).set({ archivedAt: new Date(), status: 'dropped' }).where(scope);
          break;
        case 'done':
          await db.update(object).set({ completedAt: new Date(), status: 'done' }).where(scope);
          break;
        case 'edit':
          await db.update(object).set(c.payload as never).where(scope);
          break;
        case 'keep':
          break;
      }
    }

    const [row] = await db
      .select({ id: review.id })
      .from(review)
      .where(and(eq(review.userId, user.id), eq(review.period, period)))
      .orderBy(desc(review.periodStart))
      .limit(1);

    if (row) {
      await db
        .update(review)
        .set({
          answers: b.answers,
          status: 'complete',
          completedAt: new Date(),
          ...(b.isPublic !== undefined ? { isPublic: b.isPublic } : {}),
        })
        .where(eq(review.id, row.id));
    }

    return ok({ applied: b.changes.length });
  } catch (e) {
    return handleError(e);
  }
}
