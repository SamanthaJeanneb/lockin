import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { link } from '@/lib/db/graph';
import { rollupProgress } from '@/lib/db/rollup';
import { RELATIONS } from '@/lib/constants';

const Body = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  rel: z.enum(RELATIONS),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);
    const row = await link(user.id, b.fromId, b.toId, b.rel);
    if (b.rel === 'supports' || b.rel === 'part_of') await rollupProgress(user.id);
    return ok({ edge: row }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
