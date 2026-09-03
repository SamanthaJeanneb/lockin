import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { appUser, capture, userSettings } from '@/lib/db/schema';
import { handleError } from '@/lib/api';
import { validateTwilioSignature, sendSms } from '@/lib/notify/sms';
import { extractCaptureJob } from '@/jobs';
import { dispatch } from '@/lib/inngest/client';
import { env, features } from '@/lib/env';

export const runtime = 'nodejs';

function twiml(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`,
    { headers: { 'content-type': 'text/xml' } },
  );
}

/**
 * Texting your LockIn number runs the same pipeline as ⌘K and replies with
 * the summary. The reply is the whole interface on a phone in a grocery store.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;

    if (features.sms) {
      const valid = validateTwilioSignature(
        req.headers.get('x-twilio-signature'),
        `${env.appUrl}/api/webhooks/twilio`,
        params,
      );
      if (!valid) return new Response('Invalid signature', { status: 403 });
    }

    const from = params.From;
    const body = (params.Body ?? '').trim();
    if (!body) return twiml('Nothing to capture.');

    // Match the sender to a user by the phone number stored in their settings.
    const rows = await db
      .select({ userId: userSettings.userId, notify: userSettings.notify })
      .from(userSettings);
    const match = rows.find((r) => (r.notify as { phone?: string }).phone === from);

    if (!match) {
      return twiml(
        'This number is not linked to a LockIn account. Add it under Settings → Notifications.',
      );
    }

    const [row] = await db
      .insert(capture)
      .values({ userId: match.userId, channel: 'sms', rawText: body, meta: { from } })
      .returning({ id: capture.id });

    await dispatch(
      { name: 'capture/created', data: { captureId: row!.id, userId: match.userId } },
      () => extractCaptureJob({ captureId: row!.id }),
    );

    // Give extraction a moment, then reply with what was understood.
    await new Promise((r) => setTimeout(r, 2500));
    const [updated] = await db
      .select({ extraction: capture.extraction })
      .from(capture)
      .where(eq(capture.id, row!.id))
      .limit(1);

    const e = updated?.extraction;
    if (!e) return twiml('Saved.');

    const parts: string[] = [];
    if (e.completions.length) parts.push(`${e.completions.length} completed`);
    if (e.objects.length) parts.push(`${e.objects.length} added`);
    if (e.expenses.length) parts.push(`${e.expenses.length} expense`);
    return twiml(parts.length ? `Got it — ${parts.join(', ')}.` : 'Saved.');
  } catch (e) {
    console.error('[twilio]', e);
    return twiml('Saved, but I could not read it yet. It will be processed shortly.');
  }
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}
