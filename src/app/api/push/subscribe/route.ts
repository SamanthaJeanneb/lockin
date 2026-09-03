import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { pushSubscription } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  userAgent: z.string().optional(),
  label: z.string().optional(),
});

/** Web Push is per-browser: the same person may have three live endpoints. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);
    await db
      .insert(pushSubscription)
      .values({
        userId: user.id,
        endpoint: b.endpoint,
        p256dh: b.keys.p256dh,
        auth: b.keys.auth,
        userAgent: b.userAgent ?? null,
        label: b.label ?? null,
      })
      .onConflictDoUpdate({
        target: [pushSubscription.userId, pushSubscription.endpoint],
        set: { p256dh: b.keys.p256dh, auth: b.keys.auth, failureCount: 0 },
      });
    return ok({ subscribed: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const endpoint = new URL(req.url).searchParams.get('endpoint');
    if (endpoint) {
      await db
        .delete(pushSubscription)
        .where(and(eq(pushSubscription.userId, user.id), eq(pushSubscription.endpoint, endpoint)));
    }
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
