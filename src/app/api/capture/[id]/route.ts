import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { capture } from '@/lib/db/schema';
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
    return ok({
      rawText: row.rawText,
      transcript: row.transcript,
      processedAt: row.processedAt,
      resolvedAt: row.resolvedAt,
      extraction: row.extraction,
      error: row.error,
    });
  } catch (e) {
    return handleError(e);
  }
}
