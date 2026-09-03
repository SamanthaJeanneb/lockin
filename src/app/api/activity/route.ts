import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { recentActivity } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const limit = Number(new URL(req.url).searchParams.get('limit') ?? 50);
    return ok({ activity: await recentActivity(user.id, Math.min(200, limit)) });
  } catch (e) {
    return handleError(e);
  }
}
