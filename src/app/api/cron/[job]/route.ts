import { fail, handleError, ok } from '@/lib/api';
import { env } from '@/lib/env';
import {
  detectInterestsJob, detectPatternsJob, generateRecurrencesJob, generateReviewJob, learnCadenceJob,
  rolloverJob, rollupProgressJob, scheduleNotificationsJob, sendNotificationsJob, syncCalendarJob,
  syncPlaidJob,
} from '@/jobs';

export const runtime = 'nodejs';
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<unknown>> = {
  'rollup-progress': () => rollupProgressJob(),
  rollover: () => rolloverJob(),
  'sync-calendar': () => syncCalendarJob(),
  'sync-plaid': () => syncPlaidJob(),
  'detect-patterns': () => detectPatternsJob(),
  'learn-cadence': () => learnCadenceJob(),
  'detect-interests': () => detectInterestsJob(),
  'weekly-review': () => generateReviewJob({ period: 'weekly' }),
  'monthly-review': () => generateReviewJob({ period: 'monthly' }),
  'annual-review': () => generateReviewJob({ period: 'annual' }),
  'schedule-notifications': () => scheduleNotificationsJob(),
  'send-notifications': () => sendNotificationsJob(),
  'generate-recurrences': () => generateRecurrencesJob(),
};

/**
 * The scheduled jobs, reachable without Inngest. Vercel Cron calls these with
 * the CRON_SECRET as a bearer token; `vercel.json` has the schedules.
 */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  try {
    const { job } = await params;
    const auth = req.headers.get('authorization');
    if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) return fail('Unauthorized', 401);

    const fn = JOBS[job];
    if (!fn) return fail(`Unknown job "${job}". Known: ${Object.keys(JOBS).join(', ')}`, 404);

    const started = Date.now();
    const result = await fn();
    return ok({ job, ms: Date.now() - started, result });
  } catch (e) {
    return handleError(e);
  }
}
