import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { addHours } from 'date-fns';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { rollupProgress } from '@/lib/db/rollup';
import { link } from '@/lib/db/graph';
import { SNOOZE_OPTIONS } from '@/lib/constants';

const Body = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum([
    'complete', 'uncomplete', 'status', 'priority', 'area', 'snooze', 'delete',
    'archive', 'link_goal', 'link_project', 'schedule',
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/** Bulk editing matters most when reorganising after a monthly reset. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);
    const scope = and(eq(object.userId, user.id), inArray(object.id, b.ids));
    let updated = 0;

    switch (b.action) {
      case 'complete':
      case 'uncomplete': {
        const rows = await db
          .update(object)
          .set({
            completedAt: b.action === 'complete' ? new Date() : null,
            status: b.action === 'complete' ? 'done' : 'today',
          })
          .where(scope)
          .returning({ id: object.id });
        updated = rows.length;
        await rollupProgress(user.id);
        break;
      }
      case 'status': {
        const rows = await db
          .update(object)
          .set({ status: String(b.payload.status ?? 'backlog') })
          .where(scope)
          .returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'priority': {
        const rows = await db
          .update(object)
          .set({ priority: Number(b.payload.priority) })
          .where(scope)
          .returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'area': {
        const rows = await db
          .update(object)
          .set({ area: String(b.payload.area) })
          .where(scope)
          .returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'snooze': {
        const opt = SNOOZE_OPTIONS.find((s) => s.key === b.payload.option) ?? SNOOZE_OPTIONS[1];
        const rows = await db
          .update(object)
          .set({ snoozeUntil: addHours(new Date(), opt.hours || 24) })
          .where(scope)
          .returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'schedule': {
        const rows = await db
          .update(object)
          .set({
            scheduledStart: b.payload.start ? new Date(String(b.payload.start)) : null,
            scheduledEnd: b.payload.end ? new Date(String(b.payload.end)) : null,
          })
          .where(scope)
          .returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'delete': {
        const rows = await db.update(object).set({ deletedAt: new Date() }).where(scope).returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'archive': {
        const rows = await db.update(object).set({ archivedAt: new Date() }).where(scope).returning({ id: object.id });
        updated = rows.length;
        break;
      }
      case 'link_goal':
      case 'link_project': {
        const rel = b.action === 'link_goal' ? 'supports' : 'part_of';
        for (const id of b.ids) await link(user.id, id, String(b.payload.targetId), rel);
        updated = b.ids.length;
        await rollupProgress(user.id);
        break;
      }
    }

    return ok({ updated });
  } catch (e) {
    return handleError(e);
  }
}
