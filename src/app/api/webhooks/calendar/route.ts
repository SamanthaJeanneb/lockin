import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { integration } from '@/lib/db/schema';
import { handleError, ok } from '@/lib/api';
import { syncCalendar } from '@/lib/calendar/google';
import { features } from '@/lib/env';

export const runtime = 'nodejs';

/** Google push notification: the channel id identifies the connection; the body
 *  carries nothing useful, so we resync that one calendar. */
export async function POST(req: Request) {
  try {
    if (!features.googleCalendar) return ok({ skipped: true });
    const channelId = req.headers.get('x-goog-channel-id');
    if (!channelId) return ok({ ignored: true });

    const [row] = await db
      .select()
      .from(integration)
      .where(and(eq(integration.kind, 'google_calendar'), eq(integration.externalId, channelId)))
      .limit(1);
    if (!row) return ok({ ignored: 'unknown channel' });

    await syncCalendar(row.userId, row.id);
    return ok({ synced: true });
  } catch (e) {
    return handleError(e);
  }
}
