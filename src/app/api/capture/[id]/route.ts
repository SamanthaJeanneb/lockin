import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { capture, object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [row] = await db
      .select()
      .from(capture)
      .where(and(eq(capture.id, id), eq(capture.userId, user.id)))
      .limit(1);
    if (!row) return fail('Not found', 404);

    // Completions reference existing objects by id. The review card has to name
    // them, so resolve the titles here rather than making the client fetch each.
    const completionIds = (row.extraction?.completions ?? []).map((c) => c.object_id);
    const notDoneIds = (row.extraction?.not_done ?? []).map((n) => n.object_id);
    const ids = [...new Set([...completionIds, ...notDoneIds])].filter(Boolean);

    const referenced = ids.length
      ? await db
          .select({
            id: object.id,
            title: object.title,
            type: object.type,
            unit: object.unit,
            completedAt: object.completedAt,
          })
          .from(object)
          .where(and(eq(object.userId, user.id), inArray(object.id, ids)))
      : [];

    return ok({
      rawText: row.rawText,
      transcript: row.transcript,
      processedAt: row.processedAt,
      resolvedAt: row.resolvedAt,
      extraction: row.extraction,
      referenced,
      error: row.error,
    });
  } catch (e) {
    return handleError(e);
  }
}
