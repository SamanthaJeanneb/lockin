import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { savedView } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** A saved view is a named filter over the existing tables. It creates no data
 *  and duplicates nothing — the same set, a different lens. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const surface = new URL(req.url).searchParams.get('surface');
    const rows = await db
      .select()
      .from(savedView)
      .where(
        and(eq(savedView.userId, user.id), surface ? eq(savedView.surface, surface) : undefined),
      )
      .orderBy(asc(savedView.position), asc(savedView.name));
    return ok({ views: rows });
  } catch (e) {
    return handleError(e);
  }
}

const Body = z.object({
  name: z.string().min(1).max(80),
  surface: z.enum([
    'board', 'projects', 'backlog', 'people', 'library', 'timeline', 'transactions', 'brain',
  ]),
  filters: z.record(z.string(), z.unknown()).default({}),
  sort: z.record(z.string(), z.unknown()).default({}),
  columns: z.array(z.string()).optional(),
  isPinned: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);
    const [row] = await db
      .insert(savedView)
      .values({ userId: user.id, ...b })
      .onConflictDoUpdate({
        target: [savedView.userId, savedView.surface, savedView.name],
        set: { filters: b.filters, sort: b.sort, columns: b.columns, isPinned: b.isPinned },
      })
      .returning();
    return ok({ view: row }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
