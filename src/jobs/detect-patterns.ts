import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { db } from '@/lib/db/client';
import { appUser, modelFact, object } from '@/lib/db/schema';
import { askJsonSafe } from '@/lib/ai/client';
import { PATTERN_SYSTEM } from '@/lib/ai/prompts';
import { promptContext } from '@/lib/ai/context';
import { features } from '@/lib/env';

interface PatternResult {
  patterns: { theme: string; count: number; entries: string[]; observation: string }[];
  facts: { category: string; statement: string; confidence: number; evidence: string[] }[];
}

/**
 * Themes are only surfaced at three or more occurrences in thirty days. Below
 * that it is noise, and the product's credibility depends on not saying
 * anything it cannot show evidence for.
 */
export async function detectPatternsJob({ userId }: { userId?: string } = {}) {
  const users = userId ? [{ id: userId }] : await db.select({ id: appUser.id }).from(appUser);
  let written = 0;

  for (const u of users) {
    const entries = await db
      .select({ id: object.id, title: object.title, body: object.body, createdAt: object.createdAt })
      .from(object)
      .where(
        and(
          eq(object.userId, u.id),
          sql`${object.type} in ('journal','thought','decision')`,
          isNull(object.deletedAt),
          gte(object.createdAt, subDays(new Date(), 30)),
        ),
      )
      .orderBy(desc(object.createdAt))
      .limit(60);

    if (entries.length < 3 || !features.ai) continue;

    const ctx = await promptContext(u.id, { withOpenItems: false });
    const result = await askJsonSafe<PatternResult>({
      system: PATTERN_SYSTEM(ctx),
      user: entries
        .map((e) => `[${e.id}] ${e.createdAt.toISOString().slice(0, 10)}\n${e.body ?? e.title}`)
        .join('\n\n---\n\n'),
      maxTokens: 2000,
      fallback: { patterns: [], facts: [] },
    });

    for (const f of result.facts) {
      if (f.confidence < 0.5) continue;
      const existing = await db.execute(sql`
        select id, source_count, confidence from model_fact
         where user_id = ${u.id} and status not in ('forgotten','wrong')
           and similarity(statement, ${f.statement}) > 0.7
         limit 1
      `);
      const match = (existing as unknown as { id: string; source_count: number }[])[0];
      const evidence = f.evidence.map((id) => ({
        object_id: id,
        kind: 'journal',
        note: '',
        at: new Date().toISOString(),
      }));

      if (match) {
        // Repetition is what raises confidence — never a single observation.
        await db
          .update(modelFact)
          .set({
            sourceCount: match.source_count + 1,
            confidence: Math.min(0.95, 0.5 + (match.source_count + 1) * 0.08).toString(),
            evidence: sql`${modelFact.evidence} || ${JSON.stringify(evidence)}::jsonb` as never,
            updatedAt: new Date(),
          })
          .where(eq(modelFact.id, match.id));
      } else {
        await db.insert(modelFact).values({
          userId: u.id,
          category: f.category,
          statement: f.statement,
          confidence: f.confidence.toString(),
          evidence,
          sourceCount: f.evidence.length || 1,
        });
      }
      written++;
    }

    // Themes with three or more occurrences become a queryable prop on the
    // journal entries themselves, which is what the Brain stream reads.
    for (const p of result.patterns.filter((x) => x.count >= 3)) {
      for (const id of p.entries) {
        await db
          .update(object)
          .set({
            props: sql`${object.props} || jsonb_build_object('themes',
              coalesce(${object.props}->'themes','[]'::jsonb) || ${JSON.stringify([p.theme])}::jsonb)`,
          })
          .where(and(eq(object.id, id), eq(object.userId, u.id)));
      }
    }
  }

  return { users: users.length, facts: written };
}
