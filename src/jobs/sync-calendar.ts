import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { integration } from '@/lib/db/schema';
import { syncAllCalendars } from '@/lib/calendar/google';
import { features } from '@/lib/env';

export async function syncCalendarJob({ userId }: { userId?: string } = {}) {
  if (!features.googleCalendar) return { skipped: 'google calendar not configured' };
  const rows = userId
    ? [{ userId }]
    : await db
        .selectDistinct({ userId: integration.userId })
        .from(integration)
        .where(and(eq(integration.kind, 'google_calendar'), eq(integration.status, 'active')));
  for (const r of rows) await syncAllCalendars(r.userId);
  return { users: rows.length };
}
