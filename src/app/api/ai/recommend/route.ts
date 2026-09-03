import { z } from 'zod';
import { requireUser, getSettings } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { rankToday } from '@/lib/ai/recommend';

const Body = z.object({
  availableMinutes: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`recommend:${user.id}`, 60)) return tooMany();
    const b = await parseBody(req, Body);
    const settings = await getSettings(user.id);

    const items = await rankToday(user.id, {
      availableMinutes: b.availableMinutes,
      limit: b.limit,
      areaPriority: settings?.areaPriority ?? [],
    });

    return ok({
      items: items.map((i) => ({
        object: i.object,
        why: i.why,
        score: i.score,
        factors: i.factors,
        suggestedSlot: i.suggestedSlot,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
