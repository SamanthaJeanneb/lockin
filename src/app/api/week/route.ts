import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { addDays, endOfWeek, format, startOfDay, startOfWeek } from 'date-fns';
import { db } from '@/lib/db/client';
import { calendarEvent, object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * The week, one day at a time. Anything with a date lands on its day; anything
 * carried over or overdue is surfaced separately rather than silently folded
 * into today, because "overdue" and "today" are different problems.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const offset = Number(new URL(req.url).searchParams.get('offset') ?? 0);

    const base = addDays(new Date(), offset * 7);
    const from = startOfWeek(base, { weekStartsOn: 1 });
    const to = endOfWeek(base, { weekStartsOn: 1 });

    const scheduled = await db
      .select()
      .from(object)
      .where(
        and(
          eq(object.userId, user.id),
          isNull(object.deletedAt),
          isNull(object.archivedAt),
          sql`${object.type} in ('task','habit','milestone','waiting_on','event')`,
          or(
            and(gte(object.dueAt, from), lte(object.dueAt, to)),
            and(gte(object.scheduledStart, from), lte(object.scheduledStart, to)),
            and(gte(object.completedAt, from), lte(object.completedAt, to)),
          )!,
        ),
      )
      .orderBy(asc(object.dueAt))
      .limit(300);

    // Overdue and undated-but-active work does not belong to a day, but you
    // still need to see it when you look at the week.
    const overdue = await db
      .select()
      .from(object)
      .where(
        and(
          eq(object.userId, user.id),
          isNull(object.deletedAt),
          isNull(object.completedAt),
          sql`${object.type} in ('task','milestone','waiting_on')`,
          sql`${object.dueAt} < ${startOfDay(new Date()).toISOString()}::timestamptz`,
        ),
      )
      .orderBy(asc(object.dueAt))
      .limit(50);

    const events = await db
      .select({
        id: calendarEvent.id,
        title: calendarEvent.title,
        startsAt: calendarEvent.startsAt,
        endsAt: calendarEvent.endsAt,
        allDay: calendarEvent.allDay,
      })
      .from(calendarEvent)
      .where(
        and(
          eq(calendarEvent.userId, user.id),
          gte(calendarEvent.endsAt, from),
          lte(calendarEvent.startsAt, to),
        ),
      )
      .orderBy(asc(calendarEvent.startsAt))
      .limit(100);

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(from, i);
      const key = format(d, 'yyyy-MM-dd');
      const onDay = (v: Date | null) => v && format(v, 'yyyy-MM-dd') === key;

      const items = scheduled.filter(
        (o) => onDay(o.dueAt) || onDay(o.scheduledStart) || (!o.dueAt && onDay(o.completedAt)),
      );

      return {
        date: d.toISOString(),
        key,
        label: format(d, 'EEE'),
        dayOfMonth: format(d, 'd'),
        isToday: key === format(new Date(), 'yyyy-MM-dd'),
        items,
        events: events.filter((e) => format(e.startsAt, 'yyyy-MM-dd') === key),
        done: items.filter((o) => o.completedAt).length,
      };
    });

    const all = days.flatMap((d) => d.items);

    return ok({
      from: from.toISOString(),
      to: to.toISOString(),
      offset,
      days,
      overdue,
      totals: {
        planned: all.length,
        done: all.filter((o) => o.completedAt).length,
        minutes: all.reduce((sum, o) => sum + (o.estimateMinutes ?? 0), 0),
        overdue: overdue.length,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
