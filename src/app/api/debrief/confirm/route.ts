import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { db } from '@/lib/db/client';
import { capture, edge, metric, object, transaction } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { rollupProgress } from '@/lib/db/rollup';
import { latestAreaProgress, logActivity } from '@/lib/db/queries';
import { fromPropertyBag, resolveDate } from '@/lib/ai/extract';
import { storeObjectEmbedding } from '@/lib/ai/embeddings';
import { whyChain } from '@/lib/db/graph';

const Body = z.object({
  captureId: z.string().uuid().nullable(),
  text: z.string().default(''),
  completed: z.array(z.string().uuid()).default([]),
  notDone: z.array(z.object({ id: z.string().uuid(), snoozeTo: z.string() })).default([]),
  newObjects: z.array(z.string()).default([]),
  expenses: z
    .array(z.object({ amount: z.number(), merchant: z.string(), category: z.string() }))
    .default([]),
  journal: z
    .object({ body: z.string(), mood: z.string().nullable(), themes: z.array(z.string()) })
    .nullable()
    .default(null),
  mood: z.string().nullable().default(null),
  tomorrow: z.string().default(''),
  habitValues: z.record(z.string(), z.object({ value: z.number(), unit: z.string() })).default({}),
});

/**
 * Completes checked items · logs activity · advances milestones · recalculates
 * progress · logs habit metrics · creates new objects and edges · records the
 * expense · saves the raw text as a journal entry · snoozes what wasn't done.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);

    const before = await latestAreaProgress(user.id);
    const beforeByArea = new Map(before.map((a) => [a.key, a.value]));

    const summary: string[] = [];
    const milestones: string[] = [];

    // 1. Completions
    if (b.completed.length) {
      const rows = await db
        .update(object)
        .set({ completedAt: new Date(), status: 'done' })
        .where(and(eq(object.userId, user.id), inArray(object.id, b.completed)))
        .returning({ id: object.id, title: object.title, type: object.type, area: object.area, unit: object.unit });

      for (const r of rows) {
        const hv = b.habitValues[r.id];
        if (r.type === 'habit') {
          await db.insert(metric).values({
            userId: user.id,
            objectId: r.id,
            key: 'habit',
            area: r.area,
            value: (hv?.value ?? 1).toString(),
            unit: hv?.unit ?? r.unit ?? null,
          });
          // A habit is never "done" — it goes back to active for tomorrow.
          await db.update(object).set({ completedAt: null, status: 'active' }).where(eq(object.id, r.id));
        }
        const chain = await whyChain(user.id, r.id);
        const reached = chain.find((c) => c.type === 'milestone');
        if (reached) milestones.push(reached.title);
      }

      // Milestones whose children are all complete advance automatically.
      await db.execute(sql`
        update object m set completed_at = now(), status = 'reached'
         where m.user_id = ${user.id} and m.type = 'milestone' and m.completed_at is null
           and exists (select 1 from edge e where e.to_id = m.id and e.rel = 'part_of')
           and not exists (
             select 1 from edge e join object c on c.id = e.from_id
              where e.to_id = m.id and e.rel = 'part_of'
                and c.completed_at is null and c.deleted_at is null)
      `);

      summary.push(`${rows.length} of ${b.completed.length + b.notDone.length} done`);
    }

    // 2. Not done → snoozed, tomorrow by default
    for (const n of b.notDone) {
      const to = resolveDate(n.snoozeTo) ?? addDays(new Date(), 1).toISOString();
      await db
        .update(object)
        .set({ snoozeUntil: new Date(to), props: sql`${object.props} || '{"carried_over":true}'::jsonb` })
        .where(and(eq(object.userId, user.id), eq(object.id, n.id)));
    }

    // 3. New objects from the extraction
    if (b.captureId && b.newObjects.length) {
      const [cap] = await db
        .select()
        .from(capture)
        .where(and(eq(capture.id, b.captureId), eq(capture.userId, user.id)))
        .limit(1);
      const proposed = (cap?.extraction?.objects ?? []) as { tmp: string; type: string; title: string; props?: Record<string, unknown> }[];
      const tmpToId = new Map<string, string>();
      for (const p of proposed.filter((p) => b.newObjects.includes(p.tmp))) {
        const [row] = await db
          .insert(object)
          .values({
            userId: user.id,
            type: p.type,
            title: p.title,
            props: fromPropertyBag(p.props),
            sourceCaptureId: b.captureId,
            inferredFields: [],
          })
          .returning({ id: object.id });
        tmpToId.set(p.tmp, row!.id);
        void storeObjectEmbedding(row!.id, p.title);
      }
      for (const e of (cap?.extraction?.edges ?? []) as { from: string; to: string; rel: string }[]) {
        const from = tmpToId.get(e.from);
        const to = tmpToId.get(e.to);
        if (from && to) {
          await db.insert(edge).values({ userId: user.id, fromId: from, toId: to, rel: e.rel }).onConflictDoNothing();
        }
      }
      if (tmpToId.size) summary.push(`${tmpToId.size} new`);
    }

    // 4. Expenses
    for (const e of b.expenses) {
      const [expense] = await db
        .insert(object)
        .values({
          userId: user.id,
          type: 'expense',
          title: `${e.merchant} — $${e.amount}`,
          area: 'finance',
          props: { amount: e.amount, merchant: e.merchant, category: e.category },
          sourceCaptureId: b.captureId ?? undefined,
        })
        .returning({ id: object.id });
      await db.insert(transaction).values({
        userId: user.id,
        postedAt: new Date().toISOString().slice(0, 10),
        amount: (-Math.abs(e.amount)).toString(),
        merchant: e.merchant,
        description: e.merchant,
        category: e.category,
        categorySource: 'ai',
        objectId: expense!.id,
      });
    }
    if (b.expenses.length) summary.push(`${b.expenses.length} expense${b.expenses.length === 1 ? '' : 's'}`);

    // 5. Journal, stored verbatim
    if (b.journal?.body?.trim()) {
      const [j] = await db
        .insert(object)
        .values({
          userId: user.id,
          type: 'journal',
          title: b.journal.body.split('\n')[0]!.slice(0, 80),
          body: b.journal.body,
          props: { mood: b.mood ?? b.journal.mood, themes: b.journal.themes, tomorrow: b.tomorrow || undefined },
          sourceCaptureId: b.captureId ?? undefined,
        })
        .returning({ id: object.id });
      void storeObjectEmbedding(j!.id, b.journal.body);
      summary.push('1 journal entry');
    }

    if (b.captureId) {
      await db.update(capture).set({ resolvedAt: new Date() }).where(eq(capture.id, b.captureId));
    }
    await logActivity(user.id, { verb: 'logged', actor: 'user', captureId: b.captureId ?? undefined });

    // 6. Rollup and report the deltas
    await rollupProgress(user.id);
    const after = await latestAreaProgress(user.id);
    const deltas: Record<string, number> = {};
    for (const a of after) {
      const delta = a.value - (beforeByArea.get(a.key) ?? a.value);
      if (Math.abs(delta) >= 1) deltas[a.key] = Math.round(delta);
    }

    for (const m of [...new Set(milestones)]) summary.push(`“${m}” milestone reached`);
    for (const [area, d] of Object.entries(deltas)) {
      summary.push(`${area.charAt(0).toUpperCase() + area.slice(1)} ${d > 0 ? '+' : ''}${d}%`);
    }
    if (!summary.length) summary.push('Logged.');

    return ok({ summary, deltas });
  } catch (e) {
    return handleError(e);
  }
}
