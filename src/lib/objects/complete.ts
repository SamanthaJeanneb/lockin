import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { metric, object } from '@/lib/db/schema';
import { whyChain } from '@/lib/db/graph';
import { rollupProgress } from '@/lib/db/rollup';
import { latestAreaProgress } from '@/lib/db/queries';

export interface CompletionInput {
  id: string;
  /** For habits: "ran 4 miles" → 4, "mi". */
  value?: number | null;
  unit?: string | null;
}

export interface CompletionResult {
  completed: { id: string; title: string; type: string }[];
  milestonesReached: string[];
  deltas: Record<string, number>;
  summary: string[];
}

/**
 * Complete a set of objects and let the consequences run: habit metrics are
 * logged, milestones whose children are all done advance themselves, progress
 * rolls up the chain, and the area deltas come back so the caller can say what
 * moved.
 *
 * Shared by the debrief and by capture, because "finished the homepage" means
 * the same thing whichever field it was typed into.
 */
export async function completeObjects(
  userId: string,
  items: CompletionInput[],
): Promise<CompletionResult> {
  const empty: CompletionResult = { completed: [], milestonesReached: [], deltas: {}, summary: [] };
  if (!items.length) return empty;

  const before = await latestAreaProgress(userId);
  const beforeByArea = new Map(before.map((a) => [a.key, a.value]));

  const ids = items.map((i) => i.id);
  const rows = await db
    .update(object)
    .set({ completedAt: new Date(), status: 'done' })
    .where(and(eq(object.userId, userId), inArray(object.id, ids)))
    .returning({
      id: object.id,
      title: object.title,
      type: object.type,
      area: object.area,
      unit: object.unit,
    });

  const milestonesReached: string[] = [];

  for (const r of rows) {
    const input = items.find((i) => i.id === r.id);

    if (r.type === 'habit') {
      await db.insert(metric).values({
        userId,
        objectId: r.id,
        key: 'habit',
        area: r.area,
        value: (input?.value ?? 1).toString(),
        unit: input?.unit ?? r.unit ?? null,
      });
      // A habit is never finished — it goes back to active for next time.
      await db
        .update(object)
        .set({ completedAt: null, status: 'active' })
        .where(eq(object.id, r.id));
    }

    const chain = await whyChain(userId, r.id);
    const milestone = chain.find((c) => c.type === 'milestone');
    if (milestone) milestonesReached.push(milestone.title);
  }

  // A milestone whose children are all complete is complete.
  await db.execute(sql`
    update object m set completed_at = now(), status = 'reached'
     where m.user_id = ${userId} and m.type = 'milestone' and m.completed_at is null
       and exists (select 1 from edge e where e.to_id = m.id and e.rel = 'part_of')
       and not exists (
         select 1 from edge e join object c on c.id = e.from_id
          where e.to_id = m.id and e.rel = 'part_of'
            and c.completed_at is null and c.deleted_at is null)
  `);

  await rollupProgress(userId);

  const after = await latestAreaProgress(userId);
  const deltas: Record<string, number> = {};
  for (const a of after) {
    const delta = a.value - (beforeByArea.get(a.key) ?? a.value);
    if (Math.abs(delta) >= 1) deltas[a.key] = Math.round(delta);
  }

  const summary: string[] = [];
  if (rows.length) summary.push(`${rows.length} completed`);
  for (const m of [...new Set(milestonesReached)]) summary.push(`“${m}” milestone reached`);
  for (const [area, d] of Object.entries(deltas)) {
    summary.push(`${area.charAt(0).toUpperCase() + area.slice(1)} ${d > 0 ? '+' : ''}${d}%`);
  }

  return {
    completed: rows.map((r) => ({ id: r.id, title: r.title, type: r.type })),
    milestonesReached: [...new Set(milestonesReached)],
    deltas,
    summary,
  };
}
