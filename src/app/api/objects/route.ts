import { z } from 'zod';
import { db } from '@/lib/db/client';
import { object } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { listObjects } from '@/lib/db/queries';
import { storeObjectEmbedding } from '@/lib/ai/embeddings';
import { link } from '@/lib/db/graph';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams;
    const many = (k: string) => {
      const v = q.getAll(k);
      return v.length > 1 ? v : (v[0] ?? undefined);
    };

    const objects = await listObjects(user.id, {
      type: many('type'),
      status: many('status'),
      area: q.get('area') ?? undefined,
      horizon: q.get('horizon') ?? undefined,
      goal: q.get('goal') ?? undefined,
      project: q.get('project') ?? undefined,
      person: q.get('person') ?? undefined,
      dueBefore: q.get('due_before') ?? undefined,
      completed: q.has('completed') ? q.get('completed') === 'true' : undefined,
      archived: q.get('archived') === 'true',
      search: q.get('q') ?? undefined,
      limit: q.get('limit') ? Number(q.get('limit')) : undefined,
      offset: q.get('offset') ? Number(q.get('offset')) : undefined,
      orderBy: (q.get('order') as never) ?? undefined,
      dir: (q.get('dir') as 'asc' | 'desc') ?? undefined,
    });

    return ok({ objects });
  } catch (e) {
    return handleError(e);
  }
}

/** Title and type are the only requirement. Everything else is inferred or
 *  added later — no required fields, ever. */
const Body = z.object({
  type: z.string().default('task'),
  title: z.string().min(1).max(500),
  body: z.string().optional(),
  status: z.string().nullish(),
  area: z.string().nullish(),
  horizon: z.string().nullish(),
  priority: z.number().int().min(1).max(4).nullish(),
  dueAt: z.string().nullish(),
  startAt: z.string().nullish(),
  estimateMinutes: z.number().int().nullish(),
  energy: z.string().nullish(),
  targetValue: z.number().nullish(),
  currentValue: z.number().nullish(),
  unit: z.string().nullish(),
  rrule: z.string().nullish(),
  props: z.record(z.string(), z.unknown()).default({}),
  position: z.number().optional(),
  /** Optional single edge created alongside the object. */
  linkTo: z.object({ id: z.string(), rel: z.string() }).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);

    const [row] = await db
      .insert(object)
      .values({
        userId: user.id,
        type: b.type,
        title: b.title,
        body: b.body ?? null,
        status: b.status ?? null,
        area: b.area ?? null,
        horizon: b.horizon ?? null,
        priority: b.priority ?? null,
        dueAt: b.dueAt ? new Date(b.dueAt) : null,
        startAt: b.startAt ? new Date(b.startAt) : null,
        estimateMinutes: b.estimateMinutes ?? null,
        energy: b.energy ?? null,
        targetValue: b.targetValue?.toString() ?? null,
        currentValue: b.currentValue?.toString() ?? null,
        unit: b.unit ?? null,
        rrule: b.rrule ?? null,
        props: b.props,
        position: b.position ?? Date.now() / 1000,
        inferredFields: [],
      })
      .returning();

    if (b.linkTo) await link(user.id, row!.id, b.linkTo.id, b.linkTo.rel);
    void storeObjectEmbedding(row!.id, `${b.title} ${b.body ?? ''}`);

    return ok({ object: row }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
