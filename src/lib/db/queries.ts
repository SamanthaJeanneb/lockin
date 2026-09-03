import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from './client';
import {
  activity,
  appUser,
  edge,
  lifeArea,
  metric,
  object,
  objectType,
  type ObjectRecord,
} from './schema';

export async function getUserForJob(userId: string) {
  const [row] = await db.select().from(appUser).where(eq(appUser.id, userId)).limit(1);
  return row ?? null;
}

export interface ObjectFilter {
  type?: string | string[];
  status?: string | string[];
  area?: string;
  horizon?: string;
  goal?: string;
  project?: string;
  person?: string;
  dueBefore?: string;
  completed?: boolean;
  archived?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'due' | 'created' | 'updated' | 'position' | 'title' | 'progress';
  dir?: 'asc' | 'desc';
}

export async function listObjects(userId: string, f: ObjectFilter = {}): Promise<ObjectRecord[]> {
  const where = [eq(object.userId, userId), isNull(object.deletedAt)];

  if (f.type) where.push(Array.isArray(f.type) ? inArray(object.type, f.type) : eq(object.type, f.type));
  if (f.status)
    where.push(Array.isArray(f.status) ? inArray(object.status, f.status) : eq(object.status, f.status));
  if (f.area) where.push(eq(object.area, f.area));
  if (f.horizon) where.push(eq(object.horizon, f.horizon));
  if (f.dueBefore) where.push(lte(object.dueAt, new Date(f.dueBefore)));
  if (f.completed === true) where.push(isNotNull(object.completedAt));
  if (f.completed === false) where.push(isNull(object.completedAt));
  if (!f.archived) where.push(isNull(object.archivedAt));
  if (f.search) where.push(ilike(object.title, `%${f.search}%`));

  // Relationship filters go through the edge table rather than a props lookup,
  // so the graph stays the one source of connection truth.
  for (const [param, rel] of [
    [f.goal, 'supports'],
    [f.project, 'part_of'],
    [f.person, 'with'],
  ] as const) {
    if (param) {
      where.push(
        sql`exists (select 1 from edge e where e.from_id = ${object.id}
             and e.to_id = ${param}::uuid and e.rel = ${rel})`,
      );
    }
  }

  const orderColumn = {
    due: object.dueAt,
    created: object.createdAt,
    updated: object.updatedAt,
    position: object.position,
    title: object.title,
    progress: object.progress,
  }[f.orderBy ?? 'position'];

  return db
    .select()
    .from(object)
    .where(and(...where))
    .orderBy(f.dir === 'desc' ? desc(orderColumn) : asc(orderColumn))
    .limit(f.limit ?? 200)
    .offset(f.offset ?? 0);
}

export async function getObject(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(object)
    .where(and(eq(object.userId, userId), eq(object.id, id)))
    .limit(1);
  return row ?? null;
}

export async function latestAreaProgress(userId: string) {
  const rows = await db.execute(sql`
    select distinct on (area) area, value, at
      from metric
     where user_id = ${userId} and key = 'area_progress' and area is not null
     order by area, at desc
  `);
  const current = (rows as unknown as { area: string; value: string }[]).map((r) => ({
    area: r.area,
    value: Number(r.value),
  }));

  const weekAgo = await db.execute(sql`
    select distinct on (area) area, value
      from metric
     where user_id = ${userId} and key = 'area_progress' and area is not null
       and at < now() - interval '7 days'
     order by area, at desc
  `);
  const past = new Map(
    (weekAgo as unknown as { area: string; value: string }[]).map((r) => [r.area, Number(r.value)]),
  );

  const areas = await db
    .select()
    .from(lifeArea)
    .where(and(eq(lifeArea.userId, userId), eq(lifeArea.archived, false)))
    .orderBy(lifeArea.position);

  return areas.map((a) => {
    const now = current.find((c) => c.area === a.key)?.value ?? 0;
    return {
      key: a.key,
      label: a.label,
      series: a.series,
      priority: a.priority,
      value: Math.round(now),
      delta: Math.round(now - (past.get(a.key) ?? now)),
    };
  });
}

export async function recentActivity(userId: string, limit = 50) {
  return db
    .select({
      id: activity.id,
      verb: activity.verb,
      actor: activity.actor,
      at: activity.at,
      area: activity.area,
      minutes: activity.minutes,
      objectId: activity.objectId,
      title: object.title,
      type: object.type,
    })
    .from(activity)
    .leftJoin(object, eq(object.id, activity.objectId))
    .where(eq(activity.userId, userId))
    .orderBy(desc(activity.at))
    .limit(limit);
}

export async function typeMap() {
  const rows = await db.select().from(objectType);
  return new Map(rows.map((r) => [r.key, r]));
}

/** Hybrid search: full text, trigram title, and (when available) vector, merged
 *  by best score per object. */
export async function searchObjects(userId: string, query: string, limit = 25) {
  const rows = await db.execute(sql`
    with fts as (
      select id, ts_rank(search, plainto_tsquery('english', ${query})) * 1.0 as score
        from object
       where user_id = ${userId} and deleted_at is null
         and search @@ plainto_tsquery('english', ${query})
    ),
    trg as (
      select id, similarity(title, ${query}) * 0.9 as score
        from object
       where user_id = ${userId} and deleted_at is null
         and similarity(title, ${query}) > 0.2
    ),
    merged as (
      select id, max(score) as score from (select * from fts union all select * from trg) u
       group by id
    )
    select o.id, o.type, o.title, o.body, o.status, o.area, o.due_at, o.completed_at,
           o.progress, m.score
      from merged m join object o on o.id = m.id
     order by m.score desc
     limit ${limit}
  `);
  return rows as unknown as (Pick<
    ObjectRecord,
    'id' | 'type' | 'title' | 'body' | 'status' | 'area' | 'progress'
  > & { due_at: string | null; completed_at: string | null; score: number })[];
}

export async function insertMetric(
  userId: string,
  values: { objectId?: string; key: string; area?: string; value: number; unit?: string; meta?: object },
) {
  await db.insert(metric).values({
    userId,
    objectId: values.objectId,
    key: values.key,
    area: values.area,
    value: values.value.toString(),
    unit: values.unit,
    meta: values.meta ?? {},
  });
}

export async function logActivity(
  userId: string,
  values: {
    objectId?: string;
    verb: string;
    actor?: string;
    fromValue?: unknown;
    toValue?: unknown;
    minutes?: number;
    area?: string;
    captureId?: string;
  },
) {
  await db.insert(activity).values({
    userId,
    objectId: values.objectId,
    verb: values.verb,
    actor: values.actor ?? 'user',
    fromValue: values.fromValue as never,
    toValue: values.toValue as never,
    minutes: values.minutes,
    area: values.area,
    captureId: values.captureId,
  });
}
