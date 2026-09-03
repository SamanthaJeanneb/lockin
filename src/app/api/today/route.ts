import { requireUser, getSettings } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { rankToday } from '@/lib/ai/recommend';
import { freeBlocks } from '@/lib/calendar/freeblocks';
import { latestAreaProgress } from '@/lib/db/queries';
import { db } from '@/lib/db/client';
import { calendarEvent } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { endOfDay, startOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

/** The ranked list plus the day's periphery — calendar, free blocks, area
 *  progress — in one round trip, because Home renders all of it at once. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const settings = await getSettings(user.id);
    const minutes = new URL(req.url).searchParams.get('available_minutes');

    const [items, blocks, areas, events] = await Promise.all([
      rankToday(user.id, {
        availableMinutes: minutes ? Number(minutes) : undefined,
        areaPriority: settings?.areaPriority ?? [],
        limit: 8,
      }),
      freeBlocks(user.id, new Date()),
      latestAreaProgress(user.id),
      db
        .select()
        .from(calendarEvent)
        .where(
          and(
            eq(calendarEvent.userId, user.id),
            gte(calendarEvent.endsAt, startOfDay(new Date())),
            lte(calendarEvent.startsAt, endOfDay(new Date())),
          ),
        )
        .orderBy(calendarEvent.startsAt)
        .limit(12),
    ]);

    return ok({
      items: items.map((i) => ({
        object: i.object,
        why: i.why,
        unblocks: i.unblocks,
        blockedBy: i.blockedBy,
        suggestedSlot: i.suggestedSlot,
        goalPath: i.goalPath,
      })),
      freeBlocks: blocks,
      areas,
      events,
      oneThing: items[0]
        ? { id: items[0].object.id, title: items[0].object.title, why: items[0].why }
        : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
