import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { askJson } from '@/lib/ai/client';
import { SHOULD_I_SYSTEM } from '@/lib/ai/prompts';
import { promptContext } from '@/lib/ai/context';

const Body = z.object({ question: z.string().min(3).max(1000), save: z.boolean().default(false) });

interface Analysis {
  improves: string[];
  costs: string[];
  conflicts: string[];
  net: string;
  recommendation: string;
  confidence: number;
}

/** Answers honestly, including when the honest answer is "this conflicts with
 *  what you said mattered." */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`shouldi:${user.id}`, 20)) return tooMany();
    const b = await parseBody(req, Body);

    const commitments = await db
      .select({
        type: object.type, title: object.title, area: object.area,
        progress: object.progress, dueAt: object.dueAt, status: object.status,
      })
      .from(object)
      .where(
        and(
          eq(object.userId, user.id),
          isNull(object.deletedAt),
          isNull(object.completedAt),
          sql`${object.type} in ('goal','project','financial_goal')`,
        ),
      )
      .limit(60);

    const ctx = await promptContext(user.id, {
      identity: user.identityStatement,
      withOpenItems: false,
      withFacts: true,
    });

    const analysis = await askJson<Analysis>({
      system: SHOULD_I_SYSTEM(ctx),
      user: `Question: ${b.question}\n\nActive commitments:\n${commitments
        .map((c) => `- [${c.type}${c.area ? `/${c.area}` : ''}] ${c.title} — ${Math.round(Number(c.progress))}%${c.dueAt ? `, due ${c.dueAt.toISOString().slice(0, 10)}` : ''}`)
        .join('\n')}`,
      maxTokens: 1500,
      fallback: { improves: [], costs: [], conflicts: [], net: '', recommendation: '', confidence: 0 },
    });

    let decisionId: string | null = null;
    if (b.save) {
      const [row] = await db
        .insert(object)
        .values({
          userId: user.id,
          type: 'decision',
          title: b.question,
          body: analysis.net,
          status: 'considering',
          props: {
            improves: analysis.improves,
            costs: analysis.costs,
            conflicts: analysis.conflicts,
            recommendation: analysis.recommendation,
          },
        })
        .returning({ id: object.id });
      decisionId = row!.id;
    }

    return ok({ ...analysis, decisionId });
  } catch (e) {
    return handleError(e);
  }
}
