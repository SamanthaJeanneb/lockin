import { sql } from 'drizzle-orm';
import { endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { db } from '@/lib/db/client';
import { requireUser, getSettings } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Effort comes from the activity log: completed items weighted by estimated
 * time, grouped by the area of the goal they support. Every number drills into
 * the underlying completions, so nothing here is unauditable.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const settings = await getSettings(user.id);
    const period = new URL(req.url).searchParams.get('period');
    const ref = period ? parseISO(`${period}-01`) : new Date();
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);

    const rows = (await db.execute(sql`
      select coalesce(area, 'unlinked') as area,
             sum(coalesce(minutes, 30))::text as minutes,
             count(*)::text as items
        from activity
       where user_id = ${user.id} and verb = 'completed'
         and at >= ${from.toISOString()}::timestamptz and at < ${to.toISOString()}::timestamptz
       group by 1 order by 2 desc
    `)) as unknown as { area: string; minutes: string; items: string }[];

    const total = rows.reduce((a, r) => a + Number(r.minutes), 0) || 1;
    const stated = settings?.areaPriority ?? [];

    const actual = rows.map((r, i) => ({
      area: r.area,
      minutes: Number(r.minutes),
      items: Number(r.items),
      share: Math.round((Number(r.minutes) / total) * 100),
      actualRank: i + 1,
      statedRank: stated.indexOf(r.area) === -1 ? null : stated.indexOf(r.area) + 1,
    }));

    // Flatness: how long since an area's progress last moved.
    const flat = (await db.execute(sql`
      select area, extract(day from now() - max(at))::text as days
        from activity
       where user_id = ${user.id} and verb = 'completed' and area is not null
       group by area
    `)) as unknown as { area: string; days: string }[];
    const flatByArea = new Map(flat.map((f) => [f.area, Number(f.days)]));

    const observations: string[] = [];
    for (const a of actual) {
      if (a.statedRank == null) continue;
      const gap = a.actualRank - a.statedRank;
      if (gap >= 2) {
        const days = flatByArea.get(a.area);
        observations.push(
          `${cap(a.area)} is your ${ordinal(a.statedRank)} priority and received ${a.share}% of your effort this month.` +
            (days && days > 14 ? ` It has also been flat for ${Math.round(days)} days.` : ''),
        );
      }
    }

    return ok({ period: from.toISOString().slice(0, 7), stated, actual, observations });
  } catch (e) {
    return handleError(e);
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function ordinal(n: number) {
  return ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n] ?? `${n}th`;
}
