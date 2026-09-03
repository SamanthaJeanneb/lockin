import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok, parseBody } from '@/lib/api';
import { getObject } from '@/lib/db/queries';
import { oneHop, whyChain } from '@/lib/db/graph';
import { rollupProgress } from '@/lib/db/rollup';
import { storeObjectEmbedding } from '@/lib/ai/embeddings';
import { dispatch } from '@/lib/inngest/client';
import { rollupProgressJob } from '@/jobs';
import { uid } from '@/lib/utils';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await getObject(user.id, id);
    if (!row) return fail('Not found', 404);
    const [edges, why] = await Promise.all([oneHop(user.id, id), whyChain(user.id, id)]);
    return ok({ object: row, edges, why: why.map((w) => ({ id: w.id, title: w.title, type: w.type })) });
  } catch (e) {
    return handleError(e);
  }
}

const Patch = z.object({
  title: z.string().min(1).optional(),
  body: z.string().nullish(),
  status: z.string().nullish(),
  area: z.string().nullish(),
  horizon: z.string().nullish(),
  priority: z.number().int().min(1).max(4).nullish(),
  progress: z.number().min(0).max(100).optional(),
  dueAt: z.string().nullish(),
  startAt: z.string().nullish(),
  completedAt: z.string().nullish(),
  snoozeUntil: z.string().nullish(),
  scheduledStart: z.string().nullish(),
  scheduledEnd: z.string().nullish(),
  estimateMinutes: z.number().int().nullish(),
  energy: z.string().nullish(),
  targetValue: z.number().nullish(),
  currentValue: z.number().nullish(),
  unit: z.string().nullish(),
  rrule: z.string().nullish(),
  props: z.record(z.string(), z.unknown()).optional(),
  position: z.number().optional(),
  archivedAt: z.string().nullish(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await parseBody(req, Patch);

    const before = await getObject(user.id, id);
    if (!before) return fail('Not found', 404);

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      if (
        ['dueAt', 'startAt', 'completedAt', 'snoozeUntil', 'scheduledStart', 'scheduledEnd', 'archivedAt'].includes(k)
      ) {
        patch[k] = v === null ? null : new Date(v as string);
      } else if (['progress', 'targetValue', 'currentValue'].includes(k)) {
        patch[k] = v === null ? null : String(v);
      } else {
        patch[k] = v;
      }
    }

    // Any interaction confirms an inferred value, which is what removes the
    // dashed underline.
    if (before.inferredFields.length) {
      patch.inferredFields = before.inferredFields.filter(
        (f) => !Object.keys(b).includes(f.replace(/_(\w)/g, (_, c) => c.toUpperCase())),
      );
    }

    const [row] = await db
      .update(object)
      .set(patch)
      .where(and(eq(object.id, id), eq(object.userId, user.id)))
      .returning();

    if (b.title || b.body !== undefined) {
      void storeObjectEmbedding(id, `${row!.title} ${row!.body ?? ''}`);
    }

    let deltas: Record<string, number> | undefined;
    if (b.completedAt !== undefined) {
      await dispatch({ name: 'object/completed', data: { userId: user.id, objectId: id } }, () =>
        rollupProgressJob({ userId: user.id }),
      );
      await rollupProgress(user.id);
      deltas = {};
    }

    return ok({ object: row, deltas });
  } catch (e) {
    return handleError(e);
  }
}

/** Soft delete with a five-second undo window backed by the activity log. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const token = uid();
    const [row] = await db
      .update(object)
      .set({ deletedAt: new Date(), props: undefined })
      .where(and(eq(object.id, id), eq(object.userId, user.id)))
      .returning({ id: object.id });
    if (!row) return fail('Not found', 404);
    return ok({ undoToken: token });
  } catch (e) {
    return handleError(e);
  }
}
