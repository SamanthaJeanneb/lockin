import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody } from '@/lib/api';
import { exchangePublicToken } from '@/lib/finance/plaid';

const Body = z.object({ publicToken: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await parseBody(req, Body);
    const row = await exchangePublicToken(user.id, b.publicToken);
    return ok({ integrationId: row.id });
  } catch (e) {
    return handleError(e);
  }
}
