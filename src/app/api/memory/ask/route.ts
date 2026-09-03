import { z } from 'zod';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { modelFact } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { askText } from '@/lib/ai/client';
import { MEMORY_SYSTEM } from '@/lib/ai/prompts';
import { promptContext } from '@/lib/ai/context';

const Body = z.object({ question: z.string().default('What do you know about me?') });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`memory:${user.id}`, 20)) return tooMany();
    const b = await parseBody(req, Body);

    const facts = await db
      .select()
      .from(modelFact)
      .where(and(eq(modelFact.userId, user.id), ne(modelFact.status, 'forgotten')))
      .orderBy(desc(modelFact.confidence))
      .limit(60);

    if (!facts.length) {
      return ok({
        answer:
          "Not much yet — I learn from what you journal, complete and decide. Give it a couple of weeks and this will fill in.",
      });
    }

    const ctx = await promptContext(user.id, { identity: user.identityStatement, withOpenItems: false });
    const answer = await askText({
      system: MEMORY_SYSTEM(ctx),
      user: `Question: ${b.question}\n\nStored facts:\n${facts
        .map((f) => `- [${f.category}, confidence ${Math.round(Number(f.confidence) * 100)}%] ${f.statement}`)
        .join('\n')}`,
      maxTokens: 800,
      temperature: 0.4,
    });

    return ok({ answer: answer.trim() });
  } catch (e) {
    return handleError(e);
  }
}
