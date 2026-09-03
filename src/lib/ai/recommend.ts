import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '@/lib/db/client';
import { activity, calendarEvent, modelFact, object } from '@/lib/db/schema';
import { blockers, unblockCounts, whyChain } from '@/lib/db/graph';
import { computeTrajectory } from '@/lib/db/rollup';
import { freeBlocks, type FreeBlock } from '@/lib/calendar/freeblocks';

export interface RankedItem {
  object: typeof object.$inferSelect;
  score: number;
  why: string;
  factors: Record<string, number>;
  unblocks: number;
  blockedBy: { id: string; title: string }[];
  suggestedSlot: { start: string; end: string } | null;
  goalPath: { id: string; title: string; type: string }[];
}

/**
 * The Today ranking. Nine weighted factors, recomputed each morning and after
 * any change. Every item carries a one-sentence `why` generated from whichever
 * factor dominated — that string is what the user actually reads.
 */
export async function rankToday(
  userId: string,
  opts: { availableMinutes?: number; limit?: number; areaPriority?: string[] } = {},
): Promise<RankedItem[]> {
  const candidates = await db
    .select()
    .from(object)
    .where(
      and(
        eq(object.userId, userId),
        isNull(object.deletedAt),
        isNull(object.completedAt),
        isNull(object.archivedAt),
        sql`${object.type} in ('task','habit','milestone','waiting_on')`,
        // A milestone is a checkpoint, not an action. It only belongs on Today
        // when it is close enough that it is actually the thing to work on.
        sql`(${object.type} <> 'milestone'
             or (${object.dueAt} is not null
                 and ${object.dueAt} < now() + interval '14 days'))`,
        or(isNull(object.snoozeUntil), sql`${object.snoozeUntil} <= now()`)!,
        sql`(${object.status} is null or ${object.status} not in ('done','dropped','received'))`,
      ),
    )
    .orderBy(asc(object.dueAt))
    .limit(200);

  if (!candidates.length) return [];

  const ids = candidates.map((c) => c.id);
  const [unblocks, blocked, postponeCounts, energyWindow, blocks] = await Promise.all([
    unblockCounts(userId, ids),
    blockers(userId, ids),
    postponementCounts(userId, ids),
    bestFocusWindow(userId),
    freeBlocks(userId, new Date()),
  ]);

  const areaRank = new Map((opts.areaPriority ?? []).map((a, i) => [a, i]));
  const now = new Date();
  const projectCounts = new Map<string, number>();

  const scored = candidates.map((o) => {
    const factors: Record<string, number> = {};

    // Deadline pressure. Overdue and due-today dominate everything else.
    if (o.dueAt) {
      const days = differenceInCalendarDays(o.dueAt, now);
      factors.deadline = days < 0 ? 1 : days === 0 ? 0.9 : days <= 2 ? 0.6 : days <= 7 ? 0.3 : 0.1;
    } else {
      factors.deadline = 0;
    }

    // Unblock value.
    const n = unblocks.get(o.id) ?? 0;
    factors.unblock = Math.min(1, n * 0.35);

    // Goal priority: stated area rank × horizon proximity.
    const rank = areaRank.get(o.area ?? '') ?? areaRank.size;
    factors.goal = o.area ? Math.max(0, 1 - rank * 0.15) : 0.15;

    // Status intent.
    factors.status =
      o.status === 'doing' ? 0.9 : o.status === 'today' ? 0.75 : o.status === 'next' ? 0.4 : 0.1;

    // Priority field.
    factors.priority = o.priority ? (5 - o.priority) / 4 : 0.3;

    // Calendar fit: does the estimate actually fit a free block today.
    const est = o.estimateMinutes ?? 30;
    const fits = blocks.find((b) => b.minutes >= est);
    factors.calendar = fits ? 0.5 : 0;

    // Energy match against the historically best focus window.
    factors.energy =
      o.energy === 'focus' && energyWindow && now.getHours() >= energyWindow.start && now.getHours() < energyWindow.end
        ? 0.4
        : 0;

    // Avoidance: postponed twice or more gets a boost, not a penalty.
    const postponed = postponeCounts.get(o.id) ?? 0;
    factors.avoidance = postponed >= 2 ? Math.min(0.6, 0.25 * postponed) : 0;

    // Relationship debt.
    factors.relationship = o.type === 'waiting_on' ? 0.3 : 0;

    // Blocked items sink.
    const blockedList = blocked.get(o.id) ?? [];
    factors.blocked = blockedList.length ? -0.8 : 0;

    // At equal deadline pressure a task beats the milestone that contains it,
    // because one is doable in an afternoon and the other is not.
    factors.actionable = o.type === 'milestone' ? -0.35 : 0;

    const score =
      factors.deadline * 2.2 +
      factors.unblock * 1.6 +
      factors.goal * 1.2 +
      factors.status * 1.4 +
      factors.priority * 0.8 +
      factors.calendar * 0.6 +
      factors.energy * 0.5 +
      factors.avoidance * 0.7 +
      factors.relationship * 0.5 +
      factors.blocked +
      factors.actionable;

    return { o, score, factors, unblocks: n, blockedBy: blockedList };
  });

  scored.sort((a, b) => b.score - a.score);

  // Diversity penalty: three items from one project in a row is a bad list.
  const ordered: typeof scored = [];
  const remaining = [...scored];
  while (remaining.length) {
    let pickIndex = 0;
    for (let i = 0; i < remaining.length; i++) {
      const projectKey = String((remaining[i]!.o.props as { project_id?: string }).project_id ?? '');
      const seen = projectCounts.get(projectKey) ?? 0;
      if (!projectKey || seen < 2) {
        pickIndex = i;
        break;
      }
    }
    const picked = remaining.splice(pickIndex, 1)[0]!;
    const key = String((picked.o.props as { project_id?: string }).project_id ?? '');
    if (key) projectCounts.set(key, (projectCounts.get(key) ?? 0) + 1);
    ordered.push(picked);
  }

  const top = ordered.slice(0, opts.limit ?? 8);
  const slots = assignSlots(top.map((t) => t.o.estimateMinutes ?? 30), blocks);

  return Promise.all(
    top.map(async (t, i) => {
      const chain = await whyChain(userId, t.o.id);
      return {
        object: t.o,
        score: Number(t.score.toFixed(3)),
        factors: t.factors,
        unblocks: t.unblocks,
        blockedBy: t.blockedBy,
        suggestedSlot: slots[i] ?? null,
        goalPath: chain.map((c) => ({ id: c.id, title: c.title, type: c.type })),
        why: whyLine(t, chain),
      };
    }),
  );
}

function whyLine(
  t: { o: typeof object.$inferSelect; factors: Record<string, number>; unblocks: number; blockedBy: { title: string }[] },
  chain: { title: string; type: string }[],
): string {
  if (t.blockedBy.length) return `Blocked by ${t.blockedBy[0]!.title}.`;

  // A waiting_on is defined by how long it has been waiting, so lead with that
  // rather than whichever generic factor happened to score highest.
  if (t.o.type === 'waiting_on') {
    const days = Math.max(0, differenceInCalendarDays(new Date(), t.o.createdAt));
    return days === 0 ? 'Waiting since today.' : `Waiting ${days} day${days === 1 ? '' : 's'}.`;
  }
  const top = Object.entries(t.factors)
    .filter(([k]) => k !== 'blocked')
    .sort((a, b) => b[1] - a[1])[0];
  if (!top) return '';
  const [factor] = top;
  switch (factor) {
    case 'deadline': {
      if (!t.o.dueAt) return 'Has a deadline.';
      const days = differenceInCalendarDays(t.o.dueAt, new Date());
      if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue.`;
      if (days === 0) return 'Due today.';
      return `Due in ${days} day${days === 1 ? '' : 's'}.`;
    }
    case 'unblock':
      return `Unblocks ${t.unblocks} task${t.unblocks === 1 ? '' : 's'}.`;
    case 'avoidance':
      return 'Postponed more than once — worth clearing.';
    case 'goal':
      return chain.length ? `Moves ${chain[chain.length - 1]!.title}.` : 'Supports a stated priority.';
    case 'energy':
      return 'Focus work, and this is your best window.';
    case 'calendar':
      return 'Fits a free block today.';
    case 'relationship':
      return 'Someone is waiting on this.';
    case 'status':
      return t.o.status === 'doing' ? 'Already in progress.' : 'You put it on today.';
    default:
      return chain.length ? `Part of ${chain[0]!.title}.` : '';
  }
}

function assignSlots(estimates: number[], blocks: FreeBlock[]) {
  const out: ({ start: string; end: string } | null)[] = [];
  const pool = blocks.map((b) => ({ ...b }));
  for (const est of estimates) {
    const block = pool.find((b) => b.minutes >= est);
    if (!block) {
      out.push(null);
      continue;
    }
    const start = new Date(block.start);
    const end = new Date(start.getTime() + est * 60_000);
    out.push({ start: start.toISOString(), end: end.toISOString() });
    block.start = end.toISOString();
    block.minutes -= est;
  }
  return out;
}

async function postponementCounts(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await db.execute(sql`
    select object_id, count(*)::text as n
      from activity
     where user_id = ${userId} and verb = 'snoozed'
       and object_id = any(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'::uuid`).join(',')}]`)})
     group by object_id
  `);
  return new Map(
    (rows as unknown as { object_id: string; n: string }[]).map((r) => [r.object_id, Number(r.n)]),
  );
}

/** Read the focus window out of the personal model, e.g. "best focused work
 *  between 1pm and 4pm" → { start: 13, end: 16 }. */
async function bestFocusWindow(userId: string): Promise<{ start: number; end: number } | null> {
  const rows = await db
    .select({ statement: modelFact.statement })
    .from(modelFact)
    .where(and(eq(modelFact.userId, userId), eq(modelFact.category, 'patterns')))
    .limit(20);
  for (const r of rows) {
    const m = r.statement.match(/between (\d{1,2})\s?(am|pm)? and (\d{1,2})\s?(am|pm)?/i);
    if (m) {
      const to24 = (h: string, mer?: string) => {
        let n = Number(h);
        if (mer?.toLowerCase() === 'pm' && n < 12) n += 12;
        if (mer?.toLowerCase() === 'am' && n === 12) n = 0;
        return n;
      };
      return { start: to24(m[1]!, m[2]), end: to24(m[3]!, m[4] ?? m[2]) };
    }
  }
  return null;
}
