import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { searchObjects } from '@/lib/db/queries';
import { similarObjects } from '@/lib/ai/embeddings';
import { askText } from '@/lib/ai/client';
import { features } from '@/lib/env';

const Body = z.object({ query: z.string().min(1).max(500), answer: z.boolean().default(false) });

/** Full text + trigram + vector, merged by best score. A conversational answer
 *  is opt-in because most searches want a list, not a paragraph. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { query, answer } = await parseBody(req, Body);

    const [lexical, semantic] = await Promise.all([
      searchObjects(user.id, query, 25),
      similarObjects(user.id, query, { limit: 10 }),
    ]);

    const byId = new Map(lexical.map((r) => [r.id, { ...r, score: Number(r.score) }]));
    for (const s of semantic) {
      const existing = byId.get(s.id);
      if (existing) existing.score = Math.max(existing.score, s.score);
      else if (s.score > 0.35) {
        byId.set(s.id, {
          id: s.id, type: s.type, title: s.title, body: null, status: null, area: null,
          progress: '0', due_at: null, completed_at: null, score: s.score,
        } as never);
      }
    }

    const results = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 20);

    let text: string | undefined;
    if (answer && features.ai && results.length) {
      text = await askText({
        system:
          'Answer the question using only the records provided. Two sentences at most. If the records do not contain the answer, say so plainly.',
        user: `Question: ${query}\n\nRecords:\n${results
          .slice(0, 12)
          .map((r) => `- [${r.type}] ${r.title}${r.body ? `: ${String(r.body).slice(0, 200)}` : ''}`)
          .join('\n')}`,
        maxTokens: 300,
      });
    }

    return ok({ results, answer: text });
  } catch (e) {
    return handleError(e);
  }
}
