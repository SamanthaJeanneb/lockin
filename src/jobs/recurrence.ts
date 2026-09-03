import { and, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { addDays, addMonths, addWeeks, startOfDay } from 'date-fns';
import { db } from '@/lib/db/client';
import { edge, object } from '@/lib/db/schema';

/**
 * Minimal RRULE support: FREQ plus INTERVAL and BYDAY. Enough for "every
 * weekday", "three times a week", "monthly on the 1st" — which covers what
 * people actually write. A full RFC 5545 parser is not warranted here.
 */
export function nextOccurrence(rrule: string, from: Date): Date | null {
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/i, '')
      .split(';')
      .map((p) => p.split('=') as [string, string]),
  );
  const interval = Number(parts.INTERVAL ?? 1);

  switch ((parts.FREQ ?? '').toUpperCase()) {
    case 'DAILY':
      return addDays(from, interval);
    case 'WEEKLY': {
      if (parts.BYDAY) {
        const days = parts.BYDAY.split(',').map((d) =>
          ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(d.trim().toUpperCase()),
        ).filter((d) => d >= 0).sort((a, b) => a - b);
        for (let i = 1; i <= 14; i++) {
          const candidate = addDays(from, i);
          if (days.includes(candidate.getDay())) return candidate;
        }
        return null;
      }
      return addWeeks(from, interval);
    }
    case 'MONTHLY':
      return addMonths(from, interval);
    case 'YEARLY':
      return addMonths(from, 12 * interval);
    default:
      return null;
  }
}

/** Materialises the next instance of any recurring item whose current one is
 *  complete. One instance ahead, never a year of them. */
export async function generateRecurrencesJob({ userId }: { userId?: string } = {}) {
  const where = [
    isNotNull(object.rrule),
    isNull(object.deletedAt),
    isNotNull(object.completedAt),
  ];
  if (userId) where.push(eq(object.userId, userId));

  const rows = await db.select().from(object).where(and(...where)).limit(500);
  let created = 0;

  for (const r of rows) {
    const next = nextOccurrence(r.rrule!, r.completedAt ?? new Date());
    if (!next) continue;

    // Skip if the next instance already exists.
    const existing = await db
      .select({ id: object.id })
      .from(object)
      .where(
        and(
          eq(object.userId, r.userId),
          eq(object.title, r.title),
          isNull(object.completedAt),
          isNull(object.deletedAt),
        ),
      )
      .limit(1);
    if (existing.length) continue;

    const [instance] = await db
      .insert(object)
      .values({
        userId: r.userId,
        type: r.type,
        title: r.title,
        body: r.body,
        area: r.area,
        status: r.type === 'habit' ? 'active' : 'next',
        priority: r.priority,
        dueAt: startOfDay(next),
        estimateMinutes: r.estimateMinutes,
        energy: r.energy,
        rrule: r.rrule,
        targetValue: r.targetValue,
        unit: r.unit,
        props: { ...(r.props as object), recurrence_of: r.id },
      })
      .returning({ id: object.id });

    // The new instance inherits the old one's structural edges.
    const links = await db.select().from(edge).where(eq(edge.fromId, r.id));
    for (const l of links.filter((l) => l.rel === 'part_of' || l.rel === 'supports')) {
      await db
        .insert(edge)
        .values({ userId: r.userId, fromId: instance!.id, toId: l.toId, rel: l.rel })
        .onConflictDoNothing();
    }

    created++;
  }

  return { created };
}
