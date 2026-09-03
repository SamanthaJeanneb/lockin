import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { integration } from '@/lib/db/schema';
import { fail, handleError, ok } from '@/lib/api';
import { syncItem } from '@/lib/finance/plaid';
import { features } from '@/lib/env';

export const runtime = 'nodejs';

/** Plaid tells us when new transactions land. We look the item up by its id and
 *  sync only that connection. */
export async function POST(req: Request) {
  try {
    if (!features.plaid) return fail('Plaid is not configured', 503);
    const body = (await req.json()) as {
      webhook_type?: string;
      webhook_code?: string;
      item_id?: string;
      error?: { error_message?: string };
    };

    if (!body.item_id) return ok({ ignored: true });

    const [row] = await db
      .select()
      .from(integration)
      .where(and(eq(integration.kind, 'plaid'), eq(integration.externalId, body.item_id)))
      .limit(1);
    if (!row) return ok({ ignored: 'unknown item' });

    if (body.webhook_type === 'ITEM' && body.webhook_code === 'ERROR') {
      await db
        .update(integration)
        .set({ status: 'error', error: body.error?.error_message ?? 'Plaid item error' })
        .where(eq(integration.id, row.id));
      return ok({ recorded: 'error' });
    }

    if (body.webhook_type === 'TRANSACTIONS') {
      const result = await syncItem(row.userId, row.id);
      return ok({ synced: result });
    }

    return ok({ ignored: body.webhook_code });
  } catch (e) {
    return handleError(e);
  }
}
