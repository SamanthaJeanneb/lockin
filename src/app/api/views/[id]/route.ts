import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { savedView } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok, parseBody } from '@/lib/api';

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sort: z.record(z.string(), z.unknown()).optional(),
  columns: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  position: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await parseBody(req, Patch);
    const [row] = await db
      .update(savedView)
      .set(b)
      .where(and(eq(savedView.id, id), eq(savedView.userId, user.id)))
      .returning();
    if (!row) return fail('Not found', 404);
    return ok({ view: row });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await db.delete(savedView).where(and(eq(savedView.id, id), eq(savedView.userId, user.id)));
    return ok({ deleted: id });
  } catch (e) {
    return handleError(e);
  }
}
