import { sql } from 'drizzle-orm';
import { db } from './client';
import { HORIZON_DAYS, type Horizon, type Trajectory } from '@/lib/constants';

/** Runs the SQL rollup: children roll into parents, leaves keep their own
 *  measure, and goal / project / area snapshots land in `metric`. */
export async function rollupProgress(userId: string): Promise<number> {
  const rows = await db.execute<{ rollup_progress: number }>(
    sql`select rollup_progress(${userId}::uuid) as rollup_progress`,
  );
  return Number((rows as unknown as { rollup_progress: number }[])[0]?.rollup_progress ?? 0);
}

export interface TrajectoryInput {
  progress: number;
  startAt?: Date | string | null;
  dueAt?: Date | string | null;
  horizon?: string | null;
  completedAt?: Date | string | null;
}

/**
 * Progress against elapsed time. Five points of slack either side of the line
 * so a goal doesn't flip between "ahead" and "behind" on a single completion.
 */
export function computeTrajectory(input: TrajectoryInput): Trajectory {
  if (input.completedAt) return 'ahead';
  if (input.progress >= 100) return 'ahead';
  const due = input.dueAt ? new Date(input.dueAt) : null;
  if (!due) return 'none';

  const now = Date.now();
  if (due.getTime() < now) return 'overdue';

  const start = input.startAt
    ? new Date(input.startAt).getTime()
    : due.getTime() -
      (HORIZON_DAYS[(input.horizon ?? '1y') as Horizon] ?? 365) * 86_400_000;

  const span = due.getTime() - start;
  if (span <= 0) return 'none';

  const elapsedPct = ((now - start) / span) * 100;
  if (elapsedPct <= 0) return 'on_track';

  if (input.progress >= elapsedPct + 5) return 'ahead';
  if (input.progress >= elapsedPct - 5) return 'on_track';
  return 'behind';
}

/** Seven-day movement, read from the metric history. */
export async function progressDeltas(
  userId: string,
  objectIds: string[],
  days = 7,
): Promise<Map<string, number>> {
  if (!objectIds.length) return new Map();
  const rows = await db.execute<{ object_id: string; delta: string }>(sql`
    select o.id as object_id, (o.progress - coalesce(m.value, o.progress)) as delta
      from object o
      left join lateral (
        select value from metric
         where object_id = o.id and key = 'progress'
           and at < now() - (${days} || ' days')::interval
         order by at desc limit 1
      ) m on true
     where o.user_id = ${userId}
       and o.id = any(${sql.raw(`ARRAY[${objectIds.map((i) => `'${i}'::uuid`).join(',')}]`)})
  `);
  return new Map(
    (rows as unknown as { object_id: string; delta: string }[]).map((r) => [
      r.object_id,
      Number(r.delta ?? 0),
    ]),
  );
}

/** Sparkline series for a goal or an area. */
export async function progressHistory(
  userId: string,
  opts: { objectId?: string; area?: string; key?: string; days?: number },
): Promise<{ at: string; value: number }[]> {
  const days = opts.days ?? 90;
  const key = opts.key ?? (opts.objectId ? 'progress' : 'area_progress');
  const rows = await db.execute<{ at: string; value: string }>(sql`
    select date_trunc('day', at) as at, avg(value) as value
      from metric
     where user_id = ${userId}
       and key = ${key}
       ${opts.objectId ? sql`and object_id = ${opts.objectId}::uuid` : sql``}
       ${opts.area ? sql`and area = ${opts.area}` : sql``}
       and at > now() - (${days} || ' days')::interval
     group by 1 order by 1
  `);
  return (rows as unknown as { at: string; value: string }[]).map((r) => ({
    at: String(r.at),
    value: Number(r.value),
  }));
}
