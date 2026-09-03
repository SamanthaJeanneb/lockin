import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userSettings } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import type { UiState } from '@/lib/db/schema';

/** Shell state — pane width, sidebar collapse, tree expansion. Written on a
 *  debounce, read once on mount, never queried by its contents. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const ui = (await req.json()) as UiState;
    await db
      .update(userSettings)
      .set({ ui, updatedAt: new Date() })
      .where(eq(userSettings.userId, user.id));
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}
