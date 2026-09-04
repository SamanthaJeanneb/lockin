import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
/**
 * Inngest calls back into this route to actually run a function, so the budget
 * here has to cover the slowest one — extraction is a model call, comfortably
 * past Vercel's 10s default. 60s is the ceiling on the current plan.
 */
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  signingKey: env.inngestSigningKey,
});
