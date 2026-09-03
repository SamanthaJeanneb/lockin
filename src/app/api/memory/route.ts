import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { modelFact, object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { MODEL_FACT_CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/** Every fact exposes its evidence. Nothing is asserted the user cannot audit. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const includeForgotten = new URL(req.url).searchParams.get('all') === 'true';

    const facts = await db
      .select()
      .from(modelFact)
      .where(
        and(
          eq(modelFact.userId, user.id),
          includeForgotten ? undefined : ne(modelFact.status, 'forgotten'),
        ),
      )
      .orderBy(desc(modelFact.confidence));

    const evidenceIds = [
      ...new Set(
        facts.flatMap((f) => (f.evidence ?? []).map((e) => e.object_id).filter(Boolean) as string[]),
      ),
    ];

    const sources = evidenceIds.length
      ? ((await db.execute(sql`
          select id, title, type, created_at from object
           where user_id = ${user.id}
             and id = any(${sql.raw(`ARRAY[${evidenceIds.map((i) => `'${i}'::uuid`).join(',')}]`)})
        `)) as unknown as { id: string; title: string; type: string; created_at: string }[])
      : [];
    const byId = new Map(sources.map((s) => [s.id, s]));

    const categories = MODEL_FACT_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      facts: facts
        .filter((f) => f.category === c.key)
        .map((f) => ({
          id: f.id,
          statement: f.statement,
          confidence: Number(f.confidence),
          status: f.status,
          sourceCount: f.sourceCount,
          updatedAt: f.updatedAt,
          sources: (f.evidence ?? [])
            .map((e) => (e.object_id ? byId.get(e.object_id) : null))
            .filter(Boolean),
        })),
    }));

    return ok({ categories, total: facts.length });
  } catch (e) {
    return handleError(e);
  }
}
