import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { lifeArea, modelFact, object, objectType } from '@/lib/db/schema';
import { format } from 'date-fns';
import type { PromptContext } from './prompts';

let typeCache: (typeof objectType.$inferSelect)[] | null = null;

export async function allTypes() {
  typeCache ??= await db.select().from(objectType).orderBy(objectType.position);
  return typeCache;
}

/** The vocabulary and open-item context every prompt gets. Assembled once per
 *  call so the model always sees the current state, never a stale snapshot. */
export async function promptContext(
  userId: string,
  opts: { identity?: string | null; timezone?: string; withOpenItems?: boolean; withPeople?: boolean; withFacts?: boolean } = {},
): Promise<PromptContext> {
  const [types, areas] = await Promise.all([
    allTypes(),
    db.select().from(lifeArea).where(eq(lifeArea.userId, userId)).orderBy(lifeArea.position),
  ]);

  const ctx: PromptContext = {
    today: format(new Date(), 'EEEE d MMMM yyyy'),
    timezone: opts.timezone ?? 'UTC',
    types,
    areas: areas.map((a) => ({ key: a.key, label: a.label })),
    identity: opts.identity ?? null,
  };

  if (opts.withOpenItems !== false) {
    const items = await db
      .select({
        id: object.id,
        type: object.type,
        title: object.title,
        status: object.status,
        dueAt: object.dueAt,
      })
      .from(object)
      .where(
        and(
          eq(object.userId, userId),
          isNull(object.deletedAt),
          isNull(object.completedAt),
          inArray(object.type, ['task', 'habit', 'milestone', 'waiting_on', 'project', 'goal']),
        ),
      )
      .orderBy(desc(object.updatedAt))
      .limit(120);
    ctx.openItems = items.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      status: i.status,
      due: i.dueAt ? format(i.dueAt, 'yyyy-MM-dd') : null,
    }));
  }

  if (opts.withPeople) {
    const people = await db
      .select({ id: object.id, title: object.title, props: object.props })
      .from(object)
      .where(and(eq(object.userId, userId), eq(object.type, 'person'), isNull(object.deletedAt)))
      .orderBy(desc(object.updatedAt))
      .limit(150);
    ctx.people = people.map((p) => ({
      id: p.id,
      title: p.title,
      company: (p.props as { company?: string }).company,
    }));
  }

  if (opts.withFacts) {
    const facts = await db
      .select({ statement: modelFact.statement })
      .from(modelFact)
      .where(
        and(
          eq(modelFact.userId, userId),
          or(eq(modelFact.status, 'active'), eq(modelFact.status, 'confirmed'))!,
        ),
      )
      .orderBy(desc(modelFact.confidence))
      .limit(30);
    ctx.facts = facts.map((f) => f.statement);
  }

  return ctx;
}
