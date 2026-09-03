import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { resolveCapture } from '@/lib/ai/extract';
import { rollupProgress } from '@/lib/db/rollup';

const Body = z.object({
  accept: z.array(z.string()).default([]),
  reject: z.array(z.string()).default([]),
  edits: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  noteOnly: z.boolean().default(false),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await parseBody(req, Body);

    const result = await resolveCapture({
      userId: user.id,
      captureId: id,
      accept: body.accept,
      edits: body.edits as never,
      noteOnly: body.noteOnly,
    });

    await rollupProgress(user.id);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
