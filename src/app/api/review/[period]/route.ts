import { and, desc, eq } from 'drizzle-orm';
import { parseISO, format } from 'date-fns';
import { db } from '@/lib/db/client';
import { review } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok } from '@/lib/api';
import { generateReviewJob, type ReviewPeriod } from '@/jobs/generate-review';

export const dynamic = 'force-dynamic';

const PERIODS = ['weekly', 'monthly', 'annual'];

export async function GET(req: Request, { params }: { params: Promise<{ period: string }> }) {
  try {
    const user = await requireUser();
    const { period } = await params;
    if (!PERIODS.includes(period)) return fail('Unknown period', 404);

    const start = new URL(req.url).searchParams.get('start');

    const existing = await db
      .select()
      .from(review)
      .where(
        and(
          eq(review.userId, user.id),
          eq(review.period, period),
          start ? eq(review.periodStart, start) : undefined,
        ),
      )
      .orderBy(desc(review.periodStart))
      .limit(1);

    if (existing.length && !start) return ok({ review: existing[0] });

    // Generate on demand — a review the user opens should never be empty.
    await generateReviewJob({
      userId: user.id,
      period: period as ReviewPeriod,
      ref: start ? parseISO(start).toISOString() : undefined,
    });

    const [fresh] = await db
      .select()
      .from(review)
      .where(and(eq(review.userId, user.id), eq(review.period, period)))
      .orderBy(desc(review.periodStart))
      .limit(1);

    return ok({ review: fresh });
  } catch (e) {
    return handleError(e);
  }
}
