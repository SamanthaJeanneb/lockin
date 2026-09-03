import webpush from 'web-push';
import { and, eq, lt, lte, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { notification, pushSubscription } from '@/lib/db/schema';
import { env, features } from '@/lib/env';
import { sendEmail } from './email';

let configured = false;

function configure() {
  if (configured) return;
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublic!, env.vapidPrivate!);
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string;
}

/**
 * Web Push is per-browser. A person may have Chrome on a desktop, Firefox on a
 * laptop and an installed PWA on Android — all of them get the morning brief.
 * When none of them are live (iOS Safari, permission denied), email is the
 * documented fallback rather than a silent drop.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload,
  fallbackEmail?: string,
): Promise<{ delivered: number; fallback: boolean }> {
  if (!features.push) {
    if (fallbackEmail) await emailFallback(fallbackEmail, payload);
    return { delivered: 0, fallback: Boolean(fallbackEmail) };
  }
  configure();

  const subs = await db
    .select()
    .from(pushSubscription)
    .where(and(eq(pushSubscription.userId, userId), lt(pushSubscription.failureCount, 5)));

  if (!subs.length) {
    if (fallbackEmail) await emailFallback(fallbackEmail, payload);
    return { delivered: 0, fallback: Boolean(fallbackEmail) };
  }

  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      delivered++;
      await db
        .update(pushSubscription)
        .set({ lastUsedAt: new Date(), failureCount: 0 })
        .where(eq(pushSubscription.id, s.id));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
      } else {
        await db
          .update(pushSubscription)
          .set({ failureCount: s.failureCount + 1 })
          .where(eq(pushSubscription.id, s.id));
      }
    }
  }

  if (delivered === 0 && fallbackEmail) {
    await emailFallback(fallbackEmail, payload);
    return { delivered: 0, fallback: true };
  }
  return { delivered, fallback: false };
}

async function emailFallback(to: string, payload: PushPayload) {
  if (!features.email) return;
  await sendEmail({
    to,
    subject: payload.title,
    html: `<p>${payload.body ?? ''}</p>${payload.url ? `<p><a href="${env.appUrl}${payload.url}">Open LockIn</a></p>` : ''}`,
  });
}

/** Everything due now, respecting the per-user attention budget. */
export async function flushDueNotifications(limitPerUser = 5) {
  const due = await db
    .select()
    .from(notification)
    .where(and(isNull(notification.sentAt), lte(notification.scheduledFor, new Date())))
    .limit(200);

  const byUser = new Map<string, typeof due>();
  for (const n of due) {
    const list = byUser.get(n.userId) ?? [];
    if (list.length < limitPerUser) list.push(n);
    byUser.set(n.userId, list);
  }

  let sent = 0;
  for (const [userId, list] of byUser) {
    for (const n of list) {
      await pushToUser(userId, { title: n.title, body: n.body, url: n.url, tag: n.kind });
      await db.update(notification).set({ sentAt: new Date() }).where(eq(notification.id, n.id));
      sent++;
    }
  }
  return sent;
}

export async function queueNotification(
  userId: string,
  values: { kind: string; title: string; body?: string; url?: string; at?: Date; channel?: string },
) {
  await db.insert(notification).values({
    userId,
    kind: values.kind,
    title: values.title,
    body: values.body,
    url: values.url,
    channel: values.channel ?? 'webpush',
    scheduledFor: values.at ?? new Date(),
  });
}
