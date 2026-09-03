import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export interface MentionCandidate {
  id: string;
  title: string;
  type: string;
  subtitle: string | null;
}

/**
 * Typeahead for `@`. People first — that is what an @ almost always means —
 * then the projects and goals worth pointing at.
 *
 * An empty query returns the most recently touched records rather than nothing,
 * so pressing `@` alone is useful instead of an empty box.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();

    const rows = (await db.execute(sql`
      select id, title, type, props,
             case
               when ${q} = '' then 0
               when lower(title) like lower(${q}) || '%' then 3
               when lower(split_part(title, ' ', 2)) like lower(${q}) || '%' then 2
               else 1
             end as rank,
             similarity(title, ${q}) as score
        from object
       where user_id = ${user.id}
         and deleted_at is null
         and archived_at is null
         and type in ('person','project','goal','group','book','interest')
         and (
           ${q} = ''
           or lower(title) like '%' || lower(${q}) || '%'
           or similarity(title, ${q}) > 0.2
         )
       order by
         rank desc,
         case type when 'person' then 0 when 'group' then 1 when 'project' then 2 else 3 end,
         score desc,
         updated_at desc
       limit 8
    `)) as unknown as {
      id: string;
      title: string;
      type: string;
      props: Record<string, unknown>;
    }[];

    return ok({
      candidates: rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        subtitle:
          (r.props?.company as string) ??
          (r.props?.role as string) ??
          (r.props?.author as string) ??
          null,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
