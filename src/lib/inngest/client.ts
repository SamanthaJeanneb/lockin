import { Inngest } from 'inngest';
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
 * Fire an event if Inngest is configured; otherwise run the work inline,
 * detached from the request. Capture still acknowledges in under 100ms either
 * way — the difference is durability, not latency.
 */
export async function dispatch(event: JobEvent, inline: () => Promise<unknown>) {
  if (features.jobs) {
    await inngest.send(event as never);
    return { queued: true };
  }
  void inline().catch((e) => console.error(`[job:${event.name}]`, e));
  return { queued: false };
}
