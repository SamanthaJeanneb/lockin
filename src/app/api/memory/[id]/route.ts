import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { modelFact } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok, parseBody } from '@/lib/api';

const Body = z.object({
  status: z.enum(['active', 'confirmed', 'wrong', 'changed', 'private', 'forgotten']),
  statement: z.string().optional(),
});

/** Right · Wrong · Changed · Make private · Forget. Correcting the model in
 *  plain language is the whole point of this screen. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await parseBody(req, Body);

    const confidence =
      b.status === 'confirmed' ? '0.95' : b.status === 'wrong' ? '0.05' : undefined;

    const [row] = await db
      .update(modelFact)
      .set({
        status: b.status,
        ...(b.statement ? { statement: b.statement } : {}),
        ...(confidence ? { confidence } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(modelFact.id, id), eq(modelFact.userId, user.id)))
      .returning();

    if (!row) return fail('Not found', 404);
    return ok({ fact: row });
  } catch (e) {
    return handleError(e);
  }
}
