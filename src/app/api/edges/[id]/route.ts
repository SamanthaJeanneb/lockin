import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { unlink } from '@/lib/db/graph';
import { rollupProgress } from '@/lib/db/rollup';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await unlink(user.id, id);
    await rollupProgress(user.id);
    return ok({ deleted: id });
  } catch (e) {
    return handleError(e);
  }
}
