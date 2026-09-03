import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** One chronological stream over every type, filtered client-side by the
 *  context pane's checkboxes. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams;
    const from = q.get('from') ?? new Date(Date.now() - 365 * 86_400_000).toISOString();
    const to = q.get('to') ?? new Date().toISOString();
    const types = q.getAll('type');

    const rows = (await db.execute(sql`
      select o.id, o.type, o.title, o.area, o.props,
             coalesce(o.completed_at, o.start_at, o.created_at) as at
        from object o
       where o.user_id = ${user.id} and o.deleted_at is null
         and coalesce(o.completed_at, o.start_at, o.created_at) between ${from}::timestamptz and ${to}::timestamptz
         ${types.length ? sql`and o.type = any(${sql.raw(`ARRAY[${types.map((t) => `'${t}'`).join(',')}]`)})` : sql``}
       order by at desc
       limit 500
    `)) as unknown as {
      id: string; type: string; title: string; area: string | null;
      props: Record<string, unknown>; at: string;
    }[];

    // Year view compresses to a heat strip: one row per area, twelve columns.
    const heat = (await db.execute(sql`
      select coalesce(area, 'unlinked') as area,
             to_char(at, 'YYYY-MM') as month,
             count(*)::text as n
        from activity
       where user_id = ${user.id} and verb = 'completed'
         and at between ${from}::timestamptz and ${to}::timestamptz
       group by 1, 2
    `)) as unknown as { area: string; month: string; n: string }[];

    return ok({
      events: rows,
      heat: heat.map((h) => ({ area: h.area, month: h.month, count: Number(h.n) })),
    });
  } catch (e) {
    return handleError(e);
  }
}
