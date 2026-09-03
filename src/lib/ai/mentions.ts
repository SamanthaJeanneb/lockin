import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export interface ResolvedMention {
  token: string;
  id: string;
  title: string;
  type: string;
  score: number;
}

/**
 * `@alex` is an instruction, not a hint.
 *
 * When someone types an @mention they are pointing at a record they know
 * exists, so it is resolved here against the database rather than left to the
 * model to notice. The resolved ids are handed to the prompt as facts, and the
 * edges are enforced afterwards — a mention that silently failed to link would
 * be worse than no mention at all.
 */
export async function resolveMentions(
  userId: string,
  text: string,
): Promise<{ mentions: ResolvedMention[]; unresolved: string[] }> {
  const tokens = Array.from(new Set(text.match(/@[\p{L}\p{N}._-]{2,40}/gu) ?? [])).map((t) =>
    t.slice(1),
  );
  if (!tokens.length) return { mentions: [], unresolved: [] };

  const mentions: ResolvedMention[] = [];
  const unresolved: string[] = [];

  for (const token of tokens) {
    // A mention usually names a person, but people @-reference projects and
    // goals too, so the search spans the types you would plausibly point at.
    const rows = (await db.execute(sql`
      select id, title, type,
             greatest(
               similarity(title, ${token}),
               similarity(split_part(title, ' ', 1), ${token})
             ) as score
        from object
       where user_id = ${userId}
         and deleted_at is null
         and type in ('person','project','goal','group','book','interest')
         and (
           similarity(title, ${token}) > 0.35
           or lower(split_part(title, ' ', 1)) = lower(${token})
         )
       order by
         case when lower(split_part(title, ' ', 1)) = lower(${token}) then 0 else 1 end,
         type = 'person' desc,
         score desc
       limit 1
    `)) as unknown as { id: string; title: string; type: string; score: string }[];

    const hit = rows[0];
    if (hit) mentions.push({ token, id: hit.id, title: hit.title, type: hit.type, score: Number(hit.score) });
    else unresolved.push(token);
  }

  return { mentions, unresolved };
}

/** The block handed to the model, stating the resolutions as fact. */
export function mentionsPrompt(mentions: ResolvedMention[], unresolved: string[]): string {
  if (!mentions.length && !unresolved.length) return '';
  const lines: string[] = ['EXPLICIT @MENTIONS — the user pointed at these deliberately:'];
  for (const m of mentions) {
    lines.push(`  @${m.token} IS the existing ${m.type} "${m.title}", id ${m.id}. Use that id in edges. Do not create a duplicate.`);
  }
  for (const u of unresolved) {
    lines.push(`  @${u} matches nothing on record. Create it — most likely a person — and link it.`);
  }
  return lines.join('\n');
}
