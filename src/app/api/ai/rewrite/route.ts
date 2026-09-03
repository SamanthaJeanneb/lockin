import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser, getSettings } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { askText } from '@/lib/ai/client';
import { REWRITE_SYSTEM } from '@/lib/ai/prompts';

const ACTIONS = [
  'improve', 'shorter', 'warmer', 'professional', 'casual', 'clearer', 'sound_like_me',
] as const;

const Body = z.object({
  text: z.string().min(1).max(20_000),
  action: z.enum(ACTIONS),
  personId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`rewrite:${user.id}`, 40)) return tooMany();
    const b = await parseBody(req, Body);
    const settings = await getSettings(user.id);
    const voice = ((settings?.ai as { voice_samples?: string[] })?.voice_samples ?? []).slice(0, 5);

    let recipient = '';
    if (b.personId) {
      const [p] = await db
        .select({ title: object.title, props: object.props })
        .from(object)
        .where(and(eq(object.id, b.personId), eq(object.userId, user.id)))
        .limit(1);
      if (p) recipient = `\n\nWriting to ${p.title}${(p.props as { company?: string }).company ? ` at ${(p.props as { company?: string }).company}` : ''}.`;
    }

    const text = await askText({
      system: REWRITE_SYSTEM(b.action, voice),
      user: b.text + recipient,
      maxTokens: 2000,
      temperature: 0.5,
    });

    return ok({ text: text.trim() });
  } catch (e) {
    return handleError(e);
  }
}
