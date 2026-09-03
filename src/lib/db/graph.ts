import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from './client';
import { edge, object, type EdgeRecord, type ObjectRecord } from './schema';

export interface Hop {
  edge: EdgeRecord;
  direction: 'out' | 'in';
  other: ObjectRecord;
}

/** One hop in both directions. This is what `GET /api/objects/:id` returns
 *  alongside the object, and what every detail pane renders from. */
export async function oneHop(userId: string, objectId: string): Promise<Hop[]> {
  const edges = await db
    .select()
    .from(edge)
    .where(and(eq(edge.userId, userId), or(eq(edge.fromId, objectId), eq(edge.toId, objectId))));
  if (!edges.length) return [];

  const otherIds = Array.from(
    new Set(edges.map((e) => (e.fromId === objectId ? e.toId : e.fromId))),
  );
  const others = await db
    .select()
    .from(object)
    .where(and(eq(object.userId, userId), inArray(object.id, otherIds), isNull(object.deletedAt)));
  const byId = new Map(others.map((o) => [o.id, o]));

  return edges
    .map((e) => {
      const otherId = e.fromId === objectId ? e.toId : e.fromId;
      const other = byId.get(otherId);
      return other
        ? { edge: e, direction: (e.fromId === objectId ? 'out' : 'in') as 'out' | 'in', other }
        : null;
    })
    .filter((h): h is Hop => h !== null);
}

/** Walk `supports` / `part_of` upward to the root goal. Gives the "why this
 *  matters" breadcrumb: task → milestone → project → goal → goal. */
export async function whyChain(userId: string, objectId: string): Promise<ObjectRecord[]> {
  const rows = await db.execute<ObjectRecord & { depth: number }>(sql`
    with recursive up as (
      select o.*, 0 as depth
        from object o where o.id = ${objectId} and o.user_id = ${userId}
      union all
      select p.*, u.depth + 1
        from up u
        join edge e on e.from_id = u.id and e.rel in ('part_of', 'supports')
        join object p on p.id = e.to_id and p.deleted_at is null
       where u.depth < 8
    )
    select * from up where depth > 0 order by depth
  `);
  return rows as unknown as ObjectRecord[];
}

/** Everything beneath a node, following `part_of` / `supports` downward. */
export async function descendants(userId: string, objectId: string): Promise<ObjectRecord[]> {
  const rows = await db.execute(sql`
    with recursive down as (
      select o.*, 0 as depth
        from object o where o.id = ${objectId} and o.user_id = ${userId}
      union all
      select c.*, d.depth + 1
        from down d
        join edge e on e.to_id = d.id and e.rel in ('part_of', 'supports')
        join object c on c.id = e.from_id and c.deleted_at is null
       where d.depth < 8
    )
    select * from down where depth > 0 order by depth, position
  `);
  return rows as unknown as ObjectRecord[];
}

/** How many open tasks this one unblocks. Feeds the ⚡ badge and the Today rank. */
export async function unblockCounts(userId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.execute<{ from_id: string; n: string }>(sql`
    select e.from_id, count(*)::text as n
      from edge e
      join object o on o.id = e.to_id
     where e.user_id = ${userId}
       and e.rel = 'blocks'
       and e.from_id = any(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'::uuid`).join(',')}]`)})
       and o.completed_at is null and o.deleted_at is null
     group by e.from_id
  `);
  return new Map((rows as unknown as { from_id: string; n: string }[]).map((r) => [r.from_id, Number(r.n)]));
}

/** Which objects are blocked, and by what. */
export async function blockers(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; title: string }[]>();
  const rows = await db.execute<{ to_id: string; id: string; title: string }>(sql`
    select e.to_id, o.id, o.title
      from edge e
      join object o on o.id = e.from_id
     where e.user_id = ${userId}
       and e.rel = 'blocks'
       and e.to_id = any(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'::uuid`).join(',')}]`)})
       and o.completed_at is null and o.deleted_at is null
  `);
  const out = new Map<string, { id: string; title: string }[]>();
  for (const r of rows as unknown as { to_id: string; id: string; title: string }[]) {
    const list = out.get(r.to_id) ?? [];
    list.push({ id: r.id, title: r.title });
    out.set(r.to_id, list);
  }
  return out;
}

export async function link(
  userId: string,
  fromId: string,
  toId: string,
  rel: string,
  confidence?: number,
) {
  if (fromId === toId) return null;
  const [row] = await db
    .insert(edge)
    .values({ userId, fromId, toId, rel, confidence: confidence?.toString() })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function unlink(userId: string, edgeId: string) {
  await db.delete(edge).where(and(eq(edge.userId, userId), eq(edge.id, edgeId)));
}
