import { z } from 'zod';
import { db } from '@/lib/db/client';
import { capture } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { dispatch } from '@/lib/inngest/client';
import { extractCaptureJob } from '@/jobs';
import { CAPTURE_CHANNELS } from '@/lib/constants';

export const runtime = 'nodejs';
/**
 * The response returns in milliseconds, but when Inngest is not carrying the
 * work `dispatch` finishes extraction in `after()` — which runs on this
 * function's clock. Without the budget the model call is cut off at 10s and the
 * capture stays unprocessed with nothing to show for it.
 */
export const maxDuration = 60;

const Body = z.object({
  channel: z.enum(CAPTURE_CHANNELS).default('app'),
  rawText: z.string().max(20_000).optional(),
  mediaUrl: z.string().url().optional(),
  transcript: z.string().max(20_000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Store first, extract second. The raw row is written and acknowledged before
 * any model call happens, so nothing the user typed can be lost to an API
 * outage and the request returns in well under 100ms.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`capture:${user.id}`, 60)) return tooMany();

    const body = await parseBody(req, Body);
    if (!body.rawText && !body.transcript && !body.mediaUrl) {
      return fail('Nothing to capture', 422);
    }

    const [row] = await db
      .insert(capture)
      .values({
        userId: user.id,
        channel: body.channel,
        rawText: body.rawText ?? null,
        mediaUrl: body.mediaUrl ?? null,
        transcript: body.transcript ?? null,
        meta: body.meta ?? {},
      })
      .returning({ id: capture.id });

    await dispatch(
      { name: 'capture/created', data: { captureId: row!.id, userId: user.id } },
      () => extractCaptureJob({ captureId: row!.id }),
    );

    return ok({ captureId: row!.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
