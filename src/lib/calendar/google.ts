import { google } from 'googleapis';
import { and, eq } from 'drizzle-orm';
import { addDays, subDays } from 'date-fns';
import { db } from '@/lib/db/client';
import { calendarEvent, integration } from '@/lib/db/schema';
import { decrypt, encrypt } from '@/lib/crypto';
import { env, features } from '@/lib/env';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export function oauthClient() {
  if (!features.googleCalendar) {
    throw new Error('Google Calendar is not configured. See SETUP.md § Calendar.');
  }
  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    `${env.appUrl}/api/integrations/google/callback`,
  );
}

export function authUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

export async function completeOAuth(userId: string, code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const info = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();

  const [row] = await db
    .insert(integration)
    .values({
      userId,
      kind: 'google_calendar',
      externalId: info.data.id ?? info.data.email ?? 'primary',
      accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token) : null,
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      scopes: SCOPES,
      meta: { email: info.data.email, expiry: tokens.expiry_date },
    })
    .onConflictDoUpdate({
      target: [integration.userId, integration.kind, integration.externalId],
      set: {
        accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token) : null,
        ...(tokens.refresh_token ? { refreshTokenEncrypted: encrypt(tokens.refresh_token) } : {}),
        status: 'active',
        error: null,
      },
    })
    .returning();

  await syncCalendar(userId, row!.id);
  return row!;
}

async function authorised(integrationId: string) {
  const [row] = await db.select().from(integration).where(eq(integration.id, integrationId)).limit(1);
  if (!row) throw new Error('Calendar connection not found');
  const client = oauthClient();
  client.setCredentials({
    access_token: row.accessTokenEncrypted ? decrypt(row.accessTokenEncrypted) : undefined,
    refresh_token: row.refreshTokenEncrypted ? decrypt(row.refreshTokenEncrypted) : undefined,
  });
  client.on('tokens', (t) => {
    if (t.access_token) {
      void db
        .update(integration)
        .set({ accessTokenEncrypted: encrypt(t.access_token) })
        .where(eq(integration.id, integrationId));
    }
  });
  return { client, row };
}

/** Incremental where possible, a 90-day window otherwise. */
export async function syncCalendar(userId: string, integrationId: string) {
  const { client, row } = await authorised(integrationId);
  const cal = google.calendar({ version: 'v3', auth: client });

  const params: Record<string, unknown> = {
    calendarId: 'primary',
    singleEvents: true,
    maxResults: 500,
  };
  if (row.cursor) params.syncToken = row.cursor;
  else {
    params.timeMin = subDays(new Date(), 30).toISOString();
    params.timeMax = addDays(new Date(), 90).toISOString();
    params.orderBy = 'startTime';
  }

  let res;
  try {
    res = await cal.events.list(params as never);
  } catch (e) {
    // A 410 means the sync token expired; fall back to a full window.
    if ((e as { code?: number }).code === 410) {
      await db.update(integration).set({ cursor: null }).where(eq(integration.id, integrationId));
      return syncCalendar(userId, integrationId);
    }
    throw e;
  }

  let written = 0;
  for (const e of res.data.items ?? []) {
    if (e.status === 'cancelled') {
      await db
        .delete(calendarEvent)
        .where(and(eq(calendarEvent.userId, userId), eq(calendarEvent.externalId, e.id!)));
      continue;
    }
    const start = e.start?.dateTime ?? e.start?.date;
    const end = e.end?.dateTime ?? e.end?.date;
    if (!start || !end) continue;

    await db
      .insert(calendarEvent)
      .values({
        userId,
        integrationId,
        externalId: e.id!,
        calendarId: 'primary',
        title: e.summary ?? '(no title)',
        description: e.description ?? null,
        location: e.location ?? null,
        startsAt: new Date(start),
        endsAt: new Date(end),
        allDay: Boolean(e.start?.date),
        busy: e.transparency !== 'transparent',
        attendees: (e.attendees ?? []).map((a) => ({ email: a.email, name: a.displayName })),
      })
      .onConflictDoUpdate({
        target: [calendarEvent.userId, calendarEvent.integrationId, calendarEvent.externalId],
        set: {
          title: e.summary ?? '(no title)',
          startsAt: new Date(start),
          endsAt: new Date(end),
          busy: e.transparency !== 'transparent',
          updatedAt: new Date(),
        },
      });
    written++;
  }

  await db
    .update(integration)
    .set({ cursor: res.data.nextSyncToken ?? null, lastSyncAt: new Date(), error: null })
    .where(eq(integration.id, integrationId));

  return { written };
}

/** Scheduling a task writes an event back to the calendar. */
export async function writeBack(
  userId: string,
  integrationId: string,
  ev: { title: string; start: Date; end: Date; objectId: string; description?: string },
) {
  const { client } = await authorised(integrationId);
  const cal = google.calendar({ version: 'v3', auth: client });
  const res = await cal.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: ev.title,
      description: `${ev.description ?? ''}\n\nLockIn: ${env.appUrl}/work/tasks/${ev.objectId}`.trim(),
      start: { dateTime: ev.start.toISOString() },
      end: { dateTime: ev.end.toISOString() },
    },
  });
  await db.insert(calendarEvent).values({
    userId,
    integrationId,
    externalId: res.data.id!,
    title: ev.title,
    startsAt: ev.start,
    endsAt: ev.end,
    objectId: ev.objectId,
  });
  return res.data.id!;
}

export async function syncAllCalendars(userId: string) {
  const rows = await db
    .select()
    .from(integration)
    .where(and(eq(integration.userId, userId), eq(integration.kind, 'google_calendar')));
  for (const r of rows) {
    try {
      await syncCalendar(userId, r.id);
    } catch (e) {
      await db
        .update(integration)
        .set({ status: 'error', error: e instanceof Error ? e.message : 'sync failed' })
        .where(eq(integration.id, r.id));
    }
  }
}
