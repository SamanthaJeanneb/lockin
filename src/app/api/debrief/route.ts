import { z } from 'zod';
import { db } from '@/lib/db/client';
import { capture, object } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { requireUser, getUser } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { matchDebrief, extractQuantity, extractAmount } from '@/lib/ai/match';
import { askJsonSafe } from '@/lib/ai/client';
import { DEBRIEF_SYSTEM } from '@/lib/ai/prompts';
import { DEBRIEF_SCHEMA } from '@/lib/ai/schemas';
import { promptContext } from '@/lib/ai/context';
import { mentionsPrompt, resolveMentions } from '@/lib/ai/mentions';
import { features } from '@/lib/env';
import { whyChain } from '@/lib/db/graph';

const Body = z.object({ text: z.string().min(1).max(20_000) });

interface ModelResult {
  completions: { object_id: string; confidence: number; evidence: string; value?: number | null; unit?: string | null }[];
  not_done: { object_id: string; snooze_to: string }[];
  objects: { tmp: string; type: string; title: string; props?: Record<string, unknown>; confidence: number }[];
  edges: { from: string; to: string; rel: string; confidence: number }[];
  expenses: { amount: number; merchant: string; category: string }[];
  journal: { body: string; mood: string | null; themes: string[] } | null;
  questions: string[];
}

/**
 * Live matching as you type. The scoring engine runs regardless; the model
 * refines it when a key is present. Without one the debrief still works —
 * keyword and verb proximity carry it.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`debrief:${user.id}`, 40)) return tooMany();
    const { text } = await parseBody(req, Body);

    const [row] = await db
      .insert(capture)
      .values({ userId: user.id, channel: 'debrief', rawText: text })
      .returning({ id: capture.id });

    const scored = await matchDebrief(user.id, text);

    let model: ModelResult = {
      completions: [], not_done: [], objects: [], edges: [], expenses: [], journal: null, questions: [],
    };

    // The same rule as capture: an @mention names a record that already exists,
    // so it is resolved here rather than left for the model to propose again.
    const { mentions, unresolved } = await resolveMentions(user.id, text);
    const mentionBlock = mentionsPrompt(mentions, unresolved);

    if (features.ai) {
      const ctx = await promptContext(user.id, {
        identity: user.identityStatement,
        timezone: user.timezone,
      });
      model = await askJsonSafe<ModelResult>({
        system: DEBRIEF_SYSTEM(ctx) + (mentionBlock ? `\n\n${mentionBlock}` : ''),
        user: text,
        maxTokens: 4000,
        effort: 'low',
        schema: DEBRIEF_SCHEMA as unknown as Record<string, unknown>,
        fallback: model,
      });
    }

    // The model's judgement and the scoring engine agree far more often than
    // not; where they differ, take the higher of the two.
    const byId = new Map(scored.map((s) => [s.id, s]));
    for (const c of model.completions) {
      const existing = byId.get(c.object_id);
      if (existing) {
        existing.score = Math.max(existing.score, c.confidence);
        existing.evidence = c.evidence || existing.evidence;
      }
    }

    const ids = [...byId.keys()];
    const titles = ids.length
      ? await db
          .select({ id: object.id, title: object.title, type: object.type, unit: object.unit })
          .from(object)
          .where(and(eq(object.userId, user.id), inArray(object.id, ids)))
      : [];
    const meta = new Map(titles.map((t) => [t.id, t]));

    const matches = await Promise.all(
      [...byId.values()]
        .filter((m) => m.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(async (m) => {
          const chain = await whyChain(user.id, m.id);
          const modelHit = model.completions.find((c) => c.object_id === m.id);
          // A quantity only belongs to a habit. "Ran 4 miles" must not stamp
          // "mi" onto an unrelated task that happened to match.
          const q = m.type === 'habit' ? extractQuantity(text) : null;
          return {
            id: m.id,
            type: m.type,
            title: meta.get(m.id)?.title ?? m.title,
            status: m.status,
            score: m.score,
            evidence: m.evidence,
            effect: chain.length ? `${chain[0]!.title}` : null,
            value: modelHit?.value ?? q?.value ?? null,
            unit:
              modelHit?.value != null || q ? (modelHit?.unit ?? q?.unit ?? meta.get(m.id)?.unit ?? null) : null,
          };
        }),
    );

    const notDone = await Promise.all(
      model.not_done.map(async (n) => {
        const [o] = await db
          .select({ title: object.title })
          .from(object)
          .where(and(eq(object.id, n.object_id), eq(object.userId, user.id)))
          .limit(1);
        return { id: n.object_id, title: o?.title ?? 'Item', snoozeTo: n.snooze_to || 'tomorrow' };
      }),
    );

    const amount = extractAmount(text);
    const expenses = model.expenses.length
      ? model.expenses
      : amount
        ? [{ amount, merchant: 'unspecified', category: 'other' }]
        : [];

    return ok({
      captureId: row!.id,
      matches,
      notDone: notDone.filter((n) => n.title),
      newObjects: model.objects
        .filter((o) => o.confidence >= 0.5)
        // Never offer to create someone the user pointed at by name.
        .filter(
          (o) => !mentions.some((m) => m.title.toLowerCase().includes(o.title.toLowerCase())),
        ),
      expenses,
      journal: model.journal ?? { body: text, mood: null, themes: [] },
    });
  } catch (e) {
    return handleError(e);
  }
}
