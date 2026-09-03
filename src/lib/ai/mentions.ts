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
  if (!text.includes('@')) return { mentions: [], unresolved: [] };

  // The picker inserts the full display name, so "@Sarah Chen" is two words.
  // Match the longest known title at each @ first, and only fall back to the
  // single-token form for names that are not on record.
  const known = (await db.execute(sql`
    select id, title, type from object
     where user_id = ${userId} and deleted_at is null and archived_at is null
       and type in ('person','project','goal','group','book','interest')
     order by length(title) desc
     limit 500
  `)) as unknown as { id: string; title: string; type: string }[];

  const mentions: ResolvedMention[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  const lower = text.toLowerCase();
  const consumed: [number, number][] = [];

  for (const k of known) {
    const needle = `@${k.title.toLowerCase()}`;
    let from = 0;
    for (;;) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;
      from = at + needle.length;
      // Skip anything already claimed by a longer title.
      if (consumed.some(([a, b]) => at >= a && at < b)) continue;
      // Must end on a word boundary, so "@Sam" does not match "@Samantha".
      const after = text[at + needle.length];
      if (after && /[\p{L}\p{N}]/u.test(after)) continue;
      consumed.push([at, at + needle.length]);
      if (!seen.has(k.id)) {
        seen.add(k.id);
        mentions.push({ token: k.title, id: k.id, title: k.title, type: k.type, score: 1 });
      }
    }
  }

  const tokens = Array.from(new Set(text.match(/@[\p{L}\p{N}._-]{2,40}/gu) ?? []))
    .map((t) => ({ raw: t, token: t.slice(1), at: lower.indexOf(t.toLowerCase()) }))
    .filter((t) => !consumed.some(([a, b]) => t.at >= a && t.at < b))
    .map((t) => t.token);

  if (!tokens.length) return { mentions, unresolved };

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
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      mentions.push({ token, id: hit.id, title: hit.title, type: hit.type, score: Number(hit.score) });
    } else if (!hit) {
      unresolved.push(token);
    }
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
