import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok } from '@/lib/api';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [row] = await db
      .update(object)
      .set({ deletedAt: null })
      .where(and(eq(object.id, id), eq(object.userId, user.id)))
      .returning({ id: object.id });
    if (!row) return fail('Not found', 404);
    return ok({ restored: row.id });
  } catch (e) {
    return handleError(e);
  }
}
