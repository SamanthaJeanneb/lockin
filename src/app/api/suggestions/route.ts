import { and, eq, isNull, sql } from 'drizzle-orm';
import { differenceInCalendarDays, startOfMonth } from 'date-fns';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser, getSettings } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { computeTrajectory } from '@/lib/db/rollup';

export const dynamic = 'force-dynamic';

export interface Suggestion {
  id: string;
  kind: 'pace' | 'unlinked' | 'overdue' | 'unblock' | 'drift' | 'relationship' | 'empty' | 'stale';
  title: string;
  body: string;
  weight: number;
  action?: { label: string; href?: string; objectId?: string };
}

/**
 * Grounded suggestions only. Every one of these is a count or a date the user
 * could verify themselves — nothing here is a guess about how they feel, and
 * nothing appears unless the underlying number crosses a threshold. An empty
 * list is a correct answer.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getSettings(user.id);
    const out: Suggestion[] = [];
    const now = new Date();

    // 1. Goals behind pace, worst first.
    const goals = await db
      .select()
      .from(object)
      .where(
        and(
          eq(object.userId, user.id),
          eq(object.type, 'goal'),
          isNull(object.deletedAt),
          isNull(object.archivedAt),
          isNull(object.completedAt),
        ),
      );

    const behind = goals
      .map((g) => ({
        g,
        trajectory: computeTrajectory({
          progress: Number(g.progress),
          startAt: g.startAt,
          dueAt: g.dueAt,
          horizon: g.horizon,
          completedAt: g.completedAt,
        }),
        daysLeft: g.dueAt ? differenceInCalendarDays(g.dueAt, now) : null,
      }))
      .filter((x) => x.trajectory === 'behind' || x.trajectory === 'overdue');

    for (const b of behind.slice(0, 2)) {
      out.push({
        id: `pace-${b.g.id}`,
        kind: 'pace',
        title: `${b.g.title} is ${b.trajectory === 'overdue' ? 'past its date' : 'behind pace'}`,
        body:
          b.daysLeft == null
            ? `${Math.round(Number(b.g.progress))}% done.`
            : b.daysLeft < 0
              ? `${Math.round(Number(b.g.progress))}% done, ${Math.abs(b.daysLeft)} days past the date.`
              : `${Math.round(Number(b.g.progress))}% done with ${b.daysLeft} days left.`,
        weight: b.trajectory === 'overdue' ? 0.95 : 0.8,
        action: { label: 'Open', objectId: b.g.id },
      });
    }

    // 2. Goals with nothing linked. A goal nothing supports cannot move.
    const unlinked = (await db.execute(sql`
      select o.id, o.title
        from object o
       where o.user_id = ${user.id} and o.type = 'goal'
         and o.deleted_at is null and o.archived_at is null and o.completed_at is null
         and not exists (
           select 1 from edge e join object c on c.id = e.from_id
            where e.to_id = o.id and e.rel = 'supports' and c.deleted_at is null)
       limit 2
    `)) as unknown as { id: string; title: string }[];

    for (const u of unlinked) {
      out.push({
        id: `unlinked-${u.id}`,
        kind: 'unlinked',
        title: `Nothing supports “${u.title}”`,
        body: 'A goal with no projects or tasks beneath it cannot move. Break it down.',
        weight: 0.7,
        action: { label: 'Break it down', objectId: u.id },
      });
    }

    // 3. Overdue work.
    const overdue = (await db.execute(sql`
      select count(*)::text as n from object
       where user_id = ${user.id} and deleted_at is null and completed_at is null
         and type in ('task','milestone') and due_at < now()
    `)) as unknown as { n: string }[];
    const overdueCount = Number(overdue[0]?.n ?? 0);
    if (overdueCount > 0) {
      out.push({
        id: 'overdue',
        kind: 'overdue',
        title: `${overdueCount} item${overdueCount === 1 ? '' : 's'} past due`,
        body: 'Reschedule what still matters and drop what does not.',
        weight: 0.75,
        action: { label: 'Open the board', href: '/work/board' },
      });
    }

    // 4. The highest-leverage unblock.
    const unblock = (await db.execute(sql`
      select o.id, o.title, count(*)::text as n
        from edge e
        join object o on o.id = e.from_id
        join object t on t.id = e.to_id
       where e.user_id = ${user.id} and e.rel = 'blocks'
         and o.completed_at is null and o.deleted_at is null
         and t.completed_at is null and t.deleted_at is null
       group by o.id, o.title
       having count(*) >= 2
       order by count(*) desc limit 1
    `)) as unknown as { id: string; title: string; n: string }[];

    if (unblock[0]) {
      out.push({
        id: `unblock-${unblock[0].id}`,
        kind: 'unblock',
        title: `“${unblock[0].title}” is holding up ${unblock[0].n} things`,
        body: 'Finishing this one frees the most work.',
        weight: 0.85,
        action: { label: 'Open', objectId: unblock[0].id },
      });
    }

    // 5. Stated priority against where the effort actually went this month.
    const stated = settings?.areaPriority ?? [];
    if (stated.length) {
      const effort = (await db.execute(sql`
        select coalesce(area,'unlinked') as area, sum(coalesce(minutes,30))::text as minutes
          from activity
         where user_id = ${user.id} and verb = 'completed'
           and at >= ${startOfMonth(now).toISOString()}::timestamptz
         group by 1 order by 2 desc
      `)) as unknown as { area: string; minutes: string }[];

      const total = effort.reduce((s, e) => s + Number(e.minutes), 0);
      if (total > 0) {
        const rank = new Map(effort.map((e, i) => [e.area, i + 1]));
        for (const [i, area] of stated.slice(0, 4).entries()) {
          const actual = rank.get(area);
          const share = Math.round(
            ((Number(effort.find((e) => e.area === area)?.minutes ?? 0)) / total) * 100,
          );
          if (actual == null || actual - (i + 1) >= 2) {
            out.push({
              id: `drift-${area}`,
              kind: 'drift',
              title: `${area.charAt(0).toUpperCase() + area.slice(1)} is your #${i + 1} priority and got ${share}% of your effort`,
              body: 'Either the ranking is wrong or the month was.',
              weight: 0.65,
              action: { label: 'See the drift', href: '/goals/drift' },
            });
            break;
          }
        }
      }
    }

    // 6. Relationships past their learned cadence.
    const people = await db
      .select({ id: object.id, title: object.title, props: object.props })
      .from(object)
      .where(and(eq(object.userId, user.id), eq(object.type, 'person'), isNull(object.deletedAt)))
      .limit(200);

    const overdueContacts = people
      .map((p) => {
        const props = p.props as { cadence_days?: number | null; last_interaction?: string };
        if (!props.cadence_days || !props.last_interaction) return null;
        const days = differenceInCalendarDays(now, new Date(props.last_interaction));
        return days > props.cadence_days * 1.4
          ? { ...p, days, cadence: props.cadence_days }
          : null;
      })
      .filter(Boolean) as { id: string; title: string; days: number; cadence: number }[];

    const worst = overdueContacts.sort((a, b) => b.days - a.days)[0];
    if (worst) {
      out.push({
        id: `person-${worst.id}`,
        kind: 'relationship',
        title: `${worst.title} — ${worst.days} days`,
        body: `You normally talk about every ${worst.cadence} days.`,
        weight: 0.6,
        action: { label: 'Open', objectId: worst.id },
      });
    }

    // 7. An empty week is worth saying out loud.
    const planned = (await db.execute(sql`
      select count(*)::text as n from object
       where user_id = ${user.id} and deleted_at is null and completed_at is null
         and type in ('task','habit') and status in ('today','doing','next')
    `)) as unknown as { n: string }[];
    if (Number(planned[0]?.n ?? 0) === 0) {
      out.push({
        id: 'empty',
        kind: 'empty',
        title: 'Nothing is queued up',
        body: 'Capture a sentence about what you want to move and it will sort itself out.',
        weight: 0.9,
        action: { label: 'Capture', href: '#capture' },
      });
    }

    // 8. Backlog rot.
    const stale = (await db.execute(sql`
      select count(*)::text as n from object
       where user_id = ${user.id} and deleted_at is null and archived_at is null
         and completed_at is null and type in ('task','backlog_item')
         and created_at < now() - interval '365 days'
    `)) as unknown as { n: string }[];
    const staleCount = Number(stale[0]?.n ?? 0);
    if (staleCount >= 3) {
      out.push({
        id: 'stale',
        kind: 'stale',
        title: `${staleCount} things have sat untouched for over a year`,
        body: 'Promote the ones you still mean, archive the rest.',
        weight: 0.5,
        action: { label: 'Open the backlog', href: '/work/backlog' },
      });
    }

    return ok({ suggestions: out.sort((a, b) => b.weight - a.weight).slice(0, 5) });
  } catch (e) {
    return handleError(e);
  }
}
