import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { edge, object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { askJson } from '@/lib/ai/client';
import { BREAKDOWN_SYSTEM } from '@/lib/ai/prompts';
import { BREAKDOWN_SCHEMA } from '@/lib/ai/schemas';
import { promptContext } from '@/lib/ai/context';
import { rollupProgress } from '@/lib/db/rollup';
import { storeObjectEmbedding } from '@/lib/ai/embeddings';

const Body = z.object({
  objectId: z.string().uuid(),
  apply: z.boolean().default(false),
});

interface Result {
  milestones: {
    title: string;
    due_at: string | null;
    tasks: { title: string; estimate_minutes?: number; energy?: string }[];
  }[];
}

/** Regenerating preserves anything already completed — the model is told which
 *  titles those are and instructed to keep them. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`breakdown:${user.id}`, 20)) return tooMany();
    const b = await parseBody(req, Body);

    const [project] = await db
      .select()
      .from(object)
      .where(and(eq(object.id, b.objectId), eq(object.userId, user.id)))
      .limit(1);
    if (!project) return fail('Not found', 404);

    const existing = (await db.execute(sql`
      select o.id, o.title, o.type, o.completed_at
        from edge e join object o on o.id = e.from_id
       where e.to_id = ${b.objectId}::uuid and e.rel = 'part_of' and o.deleted_at is null
    `)) as unknown as { id: string; title: string; type: string; completed_at: string | null }[];
    const done = existing.filter((e) => e.completed_at);

    const ctx = await promptContext(user.id, { identity: user.identityStatement, withOpenItems: false });
    const result = await askJson<Result>({
      system: BREAKDOWN_SYSTEM(ctx),
      user: `Project: ${project.title}
${project.body ?? ''}
Area: ${project.area ?? 'unspecified'}
Starts: ${(project.startAt ?? project.createdAt).toISOString().slice(0, 10)}
Due: ${project.dueAt?.toISOString().slice(0, 10) ?? 'unspecified'}
${done.length ? `Already completed, keep these exactly: ${done.map((d) => d.title).join('; ')}` : ''}`,
      maxTokens: 6000,
      schema: BREAKDOWN_SCHEMA as unknown as Record<string, unknown>,
      fallback: { milestones: [] },
    });

    if (!b.apply) return ok(result);

    const doneTitles = new Set(done.map((d) => d.title.toLowerCase()));
    const created: string[] = [];

    for (const [i, m] of result.milestones.entries()) {
      if (doneTitles.has(m.title.toLowerCase())) continue;
      const [ms] = await db
        .insert(object)
        .values({
          userId: user.id,
          type: 'milestone',
          title: m.title,
          area: project.area,
          status: 'open',
          dueAt: m.due_at ? new Date(m.due_at) : null,
          position: i,
        })
        .returning({ id: object.id });
      await db.insert(edge).values({ userId: user.id, fromId: ms!.id, toId: project.id, rel: 'part_of' }).onConflictDoNothing();
      created.push(ms!.id);
      void storeObjectEmbedding(ms!.id, m.title);

      for (const [j, t] of m.tasks.entries()) {
        if (doneTitles.has(t.title.toLowerCase())) continue;
        const [task] = await db
          .insert(object)
          .values({
            userId: user.id,
            type: 'task',
            title: t.title,
            area: project.area,
            status: 'backlog',
            estimateMinutes: t.estimate_minutes ?? null,
            energy: t.energy ?? null,
            position: j,
            inferredFields: ['estimate_minutes', 'energy'],
            props: { project_id: project.id },
          })
          .returning({ id: object.id });
        await db.insert(edge).values({ userId: user.id, fromId: task!.id, toId: ms!.id, rel: 'part_of' }).onConflictDoNothing();
        created.push(task!.id);
        void storeObjectEmbedding(task!.id, t.title);
      }
    }

    await rollupProgress(user.id);
    return ok({ ...result, created });
  } catch (e) {
    return handleError(e);
  }
}
