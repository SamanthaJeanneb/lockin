import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appUser, notification, object, userSettings } from '@/lib/db/schema';
import { queueNotification } from '@/lib/notify/push';
import { rankToday } from '@/lib/ai/recommend';
import { formatMinutes } from '@/lib/format';

/**
 * The scheduler, not the sender. It decides what is worth interrupting someone
 * for and queues it; `send-notifications` flushes the queue every fifteen
 * minutes. The attention budget is enforced here, at the point of decision.
 */
export async function scheduleNotificationsJob({ userId }: { userId?: string } = {}) {
  const users = userId
    ? await db.select().from(appUser).where(eq(appUser.id, userId))
    : await db.select().from(appUser);

  let queued = 0;

  for (const u of users) {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, u.id))
      .limit(1);
    const notify = (settings?.notify ?? {}) as {
      morning?: string; afternoon?: string; evening?: string;
      proactive_per_day?: number; quiet_hours?: [string, string];
    };

    // One proactive message a day, at most. Reminders tied to a schedule the
    // user set are not proactive and do not count against it.
    const sentToday = await db
      .select({ n: sql<string>`count(*)::text` })
      .from(notification)
      .where(
        and(
          eq(notification.userId, u.id),
          gte(notification.createdAt, sql`date_trunc('day', now())`),
        ),
      );
    if (Number(sentToday[0]?.n ?? 0) >= 4) continue;

    const local = new Date();
    const hour = local.getHours();
    const [mh] = (notify.morning ?? '07:30').split(':').map(Number);
    const [ah] = (notify.afternoon ?? '13:00').split(':').map(Number);
    const [eh] = (notify.evening ?? '21:00').split(':').map(Number);

    if (hour === mh) {
      const items = await rankToday(u.id, { limit: 3, areaPriority: settings?.areaPriority ?? [] });
      if (items.length) {
        await queueNotification(u.id, {
          kind: 'morning',
          title: `${items.length} things today`,
          body: `${items[0]!.object.title} — ${items[0]!.why}`,
          url: '/',
        });
        queued++;
      }
    }

    if (hour === ah) {
      const remaining = await db
        .select({ n: sql<string>`count(*)::text` })
        .from(object)
        .where(
          and(
            eq(object.userId, u.id),
            eq(object.status, 'today'),
            isNull(object.completedAt),
            isNull(object.deletedAt),
          ),
        );
      const n = Number(remaining[0]?.n ?? 0);
      if (n > 0) {
        const items = await rankToday(u.id, { limit: 1, areaPriority: settings?.areaPriority ?? [] });
        const slot = items[0]?.suggestedSlot;
        await queueNotification(u.id, {
          kind: 'afternoon',
          title: `${n} left today`,
          body: items[0]
            ? `${items[0].object.title}${slot ? ` — fits your ${formatMinutes(items[0].object.estimateMinutes ?? 30)} gap` : ''}`
            : undefined,
          url: '/',
        });
        queued++;
      }
    }

    if (hour === eh) {
      await queueNotification(u.id, {
        kind: 'evening',
        title: 'How did today go?',
        body: 'A paragraph is enough. It checks everything off for you.',
        url: '/?debrief=1',
      });
      queued++;
    }
  }

  return { queued };
}
