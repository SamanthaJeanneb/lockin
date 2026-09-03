import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { latestAreaProgress } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ areas: await latestAreaProgress(user.id) });
  } catch (e) {
    return handleError(e);
  }
}
