import { Inngest } from 'inngest';
import { after } from 'next/server';
import { env, features } from '@/lib/env';

export const inngest = new Inngest({
  id: 'lockin',
  eventKey: env.inngestEventKey ?? 'local',
});

export type JobEvent =
  | { name: 'capture/created'; data: { captureId: string; userId: string } }
  | { name: 'object/completed'; data: { userId: string; objectId: string } }
  | { name: 'sync/calendar'; data: { userId?: string } }
  | { name: 'sync/plaid'; data: { userId?: string } }
  | { name: 'review/generate'; data: { userId?: string; period: 'weekly' | 'monthly' | 'annual' } };

/**
 * Queue work that must not delay the response.
 *
 * Two things this has to get right, both learned the hard way:
 *
 * 1. Having an Inngest key is not the same as Inngest being able to run your
 *    functions. It is a callback service — it takes an event, then calls back
 *    into `/api/inngest`. It cannot reach `http://localhost:3000`, so on a local
 *    URL a configured key means every event queues in the cloud and nothing
 *    executes. `features.jobsReachable` is the check that matters.
 *
 * 2. A bare `void promise` is dropped. The floating promise lives in a request
 *    scope that Next tears down when the handler returns, so the work silently
 *    never ran. `after()` runs it post-response and keeps the runtime alive.
 *
 * Whatever happens, the work runs: a failed send falls through to inline.
 */
export async function dispatch(event: JobEvent, inline: () => Promise<unknown>) {
  if (features.jobsReachable) {
    try {
      await inngest.send(event as never);
      return { queued: true };
    } catch (e) {
      console.error(`[dispatch] inngest send failed, running inline`, e);
    }
  }

  const run = async () => {
    try {
      await inline();
    } catch (e) {
      console.error(`[job:${event.name}]`, e);
    }
  };

  try {
    after(run);
  } catch {
    // `after` throws outside a request scope (a script, a test). Awaiting is
    // slower but always correct.
    await run();
  }
  return { queued: false };
}
