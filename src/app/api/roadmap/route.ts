import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  addMonths, addQuarters, addWeeks, eachMonthOfInterval, eachQuarterOfInterval,
  eachWeekOfInterval, endOfMonth, startOfMonth,
} from 'date-fns';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { periodLoad } from '@/lib/calendar/freeblocks';

export const dynamic = 'force-dynamic';

/** Bars are projects, diamonds are milestones, and the load strip shades each
 *  period by committed hours against real calendar capacity. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams;
    const zoom = (q.get('zoom') ?? 'year') as 'week' | 'month' | 'quarter' | 'year' | 'five';
    const from = q.get('from') ? new Date(q.get('from')!) : startOfMonth(new Date());
    const to =
      q.get('to') != null
        ? new Date(q.get('to')!)
        : zoom === 'week'
          ? addWeeks(from, 1)
          : zoom === 'month'
            ? addMonths(from, 1)
            : zoom === 'quarter'
              ? addMonths(from, 3)
              : zoom === 'five'
                ? addMonths(from, 60)
                : addMonths(from, 12);

    const projects = await db
      .select()
      .from(object)
      .where(
        and(
          eq(object.userId, user.id),
          eq(object.type, 'project'),
          isNull(object.deletedAt),
          isNull(object.archivedAt),
        ),
      )
      .orderBy(object.startAt);

    const milestones = (await db.execute(sql`
      select m.id, m.title, m.due_at, m.completed_at, e.to_id as project_id
        from object m
        join edge e on e.from_id = m.id and e.rel = 'part_of'
       where m.user_id = ${user.id} and m.type = 'milestone' and m.deleted_at is null
    `)) as unknown as {
      id: string; title: string; due_at: string | null; completed_at: string | null; project_id: string;
    }[];

    const openTasks = (await db.execute(sql`
      select e.to_id as project_id, count(*)::text as n,
             coalesce(sum(o.estimate_minutes), 0)::text as minutes
        from edge e
        join object o on o.id = e.from_id
       where e.user_id = ${user.id} and e.rel = 'part_of'
         and o.type = 'task' and o.completed_at is null and o.deleted_at is null
       group by e.to_id
    `)) as unknown as { project_id: string; n: string; minutes: string }[];
    const taskLoad = new Map(openTasks.map((t) => [t.project_id, { open: Number(t.n), minutes: Number(t.minutes) }]));

    const bars = projects.map((p) => {
      const start = p.startAt ?? p.createdAt;
      const end = p.dueAt ?? addMonths(start, 3);
      return {
        id: p.id,
        title: p.title,
        area: p.area,
        start: start.toISOString(),
        end: end.toISOString(),
        progress: Number(p.progress),
        status: p.status,
        openTasks: taskLoad.get(p.id)?.open ?? 0,
        weeklyHours: Math.round(((taskLoad.get(p.id)?.minutes ?? 0) / 60) * 10) / 10,
        milestones: milestones
          .filter((m) => m.project_id === p.id && m.due_at)
          .map((m) => ({ id: m.id, title: m.title, at: m.due_at!, reached: Boolean(m.completed_at) })),
      };
    });

    const buckets =
      zoom === 'week'
        ? eachWeekOfInterval({ start: from, end: to }).map((d) => ({ start: d, end: addWeeks(d, 1) }))
        : zoom === 'five'
          ? eachQuarterOfInterval({ start: from, end: to }).map((d) => ({ start: d, end: addQuarters(d, 1) }))
          : eachMonthOfInterval({ start: from, end: to }).map((d) => ({ start: d, end: endOfMonth(d) }));

    const load = await periodLoad(user.id, from, to, buckets);

    return ok({
      from: from.toISOString(),
      to: to.toISOString(),
      zoom,
      buckets: buckets.map((b) => b.start.toISOString()),
      bars,
      load,
    });
  } catch (e) {
    return handleError(e);
  }
}
