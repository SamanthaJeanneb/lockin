import { and, eq, gte, lte } from 'drizzle-orm';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { db } from '@/lib/db/client';
import { calendarEvent } from '@/lib/db/schema';

export interface FreeBlock {
  start: string;
  end: string;
  minutes: number;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

/**
 * Gaps between busy calendar events inside the working day. Drives the Today
 * "fits a free block" factor, the afternoon Home state, and the roadmap load
 * strip. With no calendar connected the whole day is one free block, which is
 * the right default rather than an error.
 */
export async function freeBlocks(userId: string, day: Date): Promise<FreeBlock[]> {
  const from = startOfDay(day);
  const to = endOfDay(day);

  const events = await db
    .select({ startsAt: calendarEvent.startsAt, endsAt: calendarEvent.endsAt, busy: calendarEvent.busy })
    .from(calendarEvent)
    .where(
      and(
        eq(calendarEvent.userId, userId),
        gte(calendarEvent.endsAt, from),
        lte(calendarEvent.startsAt, to),
        eq(calendarEvent.busy, true),
      ),
    );

  const windowStart = new Date(from);
  windowStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(from);
  windowEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const now = new Date();
  let cursor = now > windowStart && now < windowEnd ? now : windowStart;

  const busy = events
    .map((e) => ({ start: new Date(e.startsAt), end: new Date(e.endsAt) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const blocks: FreeBlock[] = [];
  for (const b of busy) {
    if (b.start > cursor) {
      const end = b.start < windowEnd ? b.start : windowEnd;
      pushBlock(blocks, cursor, end);
    }
    if (b.end > cursor) cursor = b.end;
    if (cursor >= windowEnd) break;
  }
  if (cursor < windowEnd) pushBlock(blocks, cursor, windowEnd);

  return blocks.filter((b) => b.minutes >= 15);
}

function pushBlock(out: FreeBlock[], start: Date, end: Date) {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes > 0) out.push({ start: start.toISOString(), end: end.toISOString(), minutes });
}

/** Committed hours vs. available hours per period, for the roadmap load strip. */
export async function periodLoad(
  userId: string,
  from: Date,
  to: Date,
  buckets: { start: Date; end: Date }[],
): Promise<{ start: string; committedHours: number; availableHours: number; ratio: number }[]> {
  const events = await db
    .select({ startsAt: calendarEvent.startsAt, endsAt: calendarEvent.endsAt })
    .from(calendarEvent)
    .where(
      and(
        eq(calendarEvent.userId, userId),
        eq(calendarEvent.busy, true),
        gte(calendarEvent.endsAt, from),
        lte(calendarEvent.startsAt, to),
      ),
    );

  return buckets.map((b) => {
    const days = Math.max(1, Math.round((b.end.getTime() - b.start.getTime()) / 86_400_000));
    const workingDays = Math.round(days * (5 / 7));
    const availableHours = workingDays * (DAY_END_HOUR - DAY_START_HOUR);
    const committedHours = events
      .filter((e) => e.startsAt < b.end && e.endsAt > b.start)
      .reduce((acc, e) => {
        const start = Math.max(e.startsAt.getTime(), b.start.getTime());
        const end = Math.min(e.endsAt.getTime(), b.end.getTime());
        return acc + Math.max(0, end - start) / 3_600_000;
      }, 0);
    return {
      start: b.start.toISOString(),
      committedHours: Math.round(committedHours),
      availableHours,
      ratio: availableHours ? Math.min(1, committedHours / availableHours) : 0,
    };
  });
}

export function nextDays(n: number, from = new Date()) {
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}
