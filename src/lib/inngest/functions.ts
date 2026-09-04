import { inngest } from './client';
import {
  detectInterestsJob, detectPatternsJob, extractCaptureJob, generateRecurrencesJob,
  generateReviewJob, learnCadenceJob, rolloverJob, rollupProgressJob, scheduleNotificationsJob,
  sendNotificationsJob, syncCalendarJob, syncPlaidJob,
} from '@/jobs';

export const extractCapture = inngest.createFunction(
  // 5 is the Inngest free-plan ceiling. Asking for more is not a soft cap: the
  // whole app is refused at sync, no function registers, and every event queues
  // in the cloud with nothing on the other end to run it.
  { id: 'extract-capture', retries: 3, concurrency: { limit: 5 } },
  { event: 'capture/created' },
  async ({ event, step }) => step.run('extract', () => extractCaptureJob({ captureId: event.data.captureId })),
);

export const rollupOnCompletion = inngest.createFunction(
  { id: 'rollup-on-completion', retries: 2, debounce: { period: '10s', key: 'event.data.userId' } },
  { event: 'object/completed' },
  async ({ event, step }) => step.run('rollup', () => rollupProgressJob({ userId: event.data.userId })),
);

export const nightlyRollup = inngest.createFunction(
  { id: 'nightly-rollup' },
  { cron: '0 3 * * *' },
  async ({ step }) => step.run('rollup', () => rollupProgressJob()),
);

export const nightlyRollover = inngest.createFunction(
  { id: 'nightly-rollover' },
  { cron: '5 0 * * *' },
  async ({ step }) => step.run('rollover', () => rolloverJob()),
);

export const calendarSync = inngest.createFunction(
  { id: 'sync-calendar' },
  [{ cron: '*/30 * * * *' }, { event: 'sync/calendar' }],
  async ({ event, step }) =>
    step.run('sync', () => syncCalendarJob({ userId: (event as { data?: { userId?: string } })?.data?.userId })),
);

export const plaidSync = inngest.createFunction(
  { id: 'sync-plaid' },
  [{ cron: '0 6,14,22 * * *' }, { event: 'sync/plaid' }],
  async ({ event, step }) =>
    step.run('sync', () => syncPlaidJob({ userId: (event as { data?: { userId?: string } })?.data?.userId })),
);

export const patterns = inngest.createFunction(
  { id: 'detect-patterns' },
  { cron: '0 2 * * *' },
  async ({ step }) => step.run('detect', () => detectPatternsJob()),
);

export const weeklyReview = inngest.createFunction(
  { id: 'weekly-review' },
  [{ cron: '0 18 * * 0' }, { event: 'review/generate' }],
  async ({ event, step }) =>
    step.run('generate', () =>
      generateReviewJob({
        period: (event as { data?: { period?: 'weekly' } })?.data?.period ?? 'weekly',
        userId: (event as { data?: { userId?: string } })?.data?.userId,
      }),
    ),
);

export const monthlyReview = inngest.createFunction(
  { id: 'monthly-review' },
  { cron: '0 18 28-31 * *' },
  async ({ step }) => step.run('generate', () => generateReviewJob({ period: 'monthly' })),
);

export const notifications = inngest.createFunction(
  { id: 'send-notifications' },
  { cron: '*/15 * * * *' },
  async ({ step }) => step.run('send', () => sendNotificationsJob()),
);

export const scheduleNotifications = inngest.createFunction(
  { id: 'schedule-notifications' },
  { cron: '0 * * * *' },
  async ({ step }) => step.run('schedule', () => scheduleNotificationsJob()),
);

export const recurrences = inngest.createFunction(
  { id: 'generate-recurrences' },
  { cron: '30 0 * * *' },
  async ({ step }) => step.run('generate', () => generateRecurrencesJob()),
);

export const relationships = inngest.createFunction(
  { id: 'learn-cadence' },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const cadence = await step.run('cadence', () => learnCadenceJob());
    const interests = await step.run('interests', () => detectInterestsJob());
    return { cadence, interests };
  },
);

export const functions = [
  extractCapture, rollupOnCompletion, nightlyRollup, nightlyRollover, calendarSync,
  plaidSync, patterns, weeklyReview, monthlyReview, notifications,
  scheduleNotifications, recurrences, relationships,
];
