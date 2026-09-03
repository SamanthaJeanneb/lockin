import { and, eq, isNull, sql } from 'drizzle-orm';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { computeTrajectory, progressDeltas } from '@/lib/db/rollup';
import { HORIZONS, HORIZON_DAYS, type Horizon } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Every goal, with the two numbers that matter side by side: how far along it
 * is, and how far through its window you are. One fetch for all seven horizons
 * so switching between them is instant rather than a round trip.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const goals = await db
      .select()
      .from(object)
      .where(
        and(
          eq(object.userId, user.id),
          eq(object.type, 'goal'),
          isNull(object.deletedAt),
          isNull(object.archivedAt),
        ),
      )
      .orderBy(object.horizon, object.position);

    const deltas = await progressDeltas(user.id, goals.map((g) => g.id));

    // How many things hang off each goal — an empty goal is a wish, and the
    // count is what tells you which is which.
    const childCounts = goals.length
      ? ((await db.execute(sql`
          select e.to_id as goal_id,
                 count(*) filter (where c.completed_at is null)::text as open,
                 count(*)::text as total
            from edge e
            join object c on c.id = e.from_id
           where e.user_id = ${user.id} and e.rel = 'supports'
             and c.deleted_at is null and c.archived_at is null
           group by e.to_id
        `)) as unknown as { goal_id: string; open: string; total: string }[])
      : [];
    const byGoal = new Map(childCounts.map((c) => [c.goal_id, c]));

    const now = Date.now();

    const rows = goals.map((g) => {
      const progress = Number(g.progress ?? 0);
      const due = g.dueAt ? g.dueAt.getTime() : null;
      const horizonDays = HORIZON_DAYS[(g.horizon ?? '1y') as Horizon] ?? 365;
      const start = g.startAt
        ? g.startAt.getTime()
        : due
          ? due - horizonDays * 86_400_000
          : g.createdAt.getTime();

      // Percentage of the window that has gone by. Null when there is no
      // deadline — an undated goal has no pace to be off.
      const elapsed =
        due && due > start ? Math.max(0, Math.min(100, ((now - start) / (due - start)) * 100)) : null;

      const counts = byGoal.get(g.id);

      return {
        id: g.id,
        title: g.title,
        area: g.area,
        horizon: g.horizon,
        status: g.status,
        progress: Math.round(progress),
        elapsed: elapsed == null ? null : Math.round(elapsed),
        pacing: elapsed == null ? null : Math.round(progress - elapsed),
        delta7: Math.round(deltas.get(g.id) ?? 0),
        trajectory: computeTrajectory({
          progress,
          startAt: g.startAt,
          dueAt: g.dueAt,
          horizon: g.horizon,
          completedAt: g.completedAt,
        }),
        startAt: g.startAt?.toISOString() ?? null,
        dueAt: g.dueAt?.toISOString() ?? null,
        daysLeft: due ? differenceInCalendarDays(new Date(due), new Date()) : null,
        currentValue: g.currentValue == null ? null : Number(g.currentValue),
        targetValue: g.targetValue == null ? null : Number(g.targetValue),
        unit: g.unit,
        openChildren: counts ? Number(counts.open) : 0,
        totalChildren: counts ? Number(counts.total) : 0,
        completedAt: g.completedAt?.toISOString() ?? null,
      };
    });

    const summary = { ahead: 0, on_track: 0, behind: 0, overdue: 0, none: 0 };
    for (const r of rows) summary[r.trajectory as keyof typeof summary]++;

    return ok({
      horizons: HORIZONS.map((h) => ({ key: h, count: rows.filter((r) => r.horizon === h).length })),
      goals: rows,
      summary,
    });
  } catch (e) {
    return handleError(e);
  }
}
