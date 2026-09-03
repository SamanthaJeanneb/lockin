import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { integration } from '@/lib/db/schema';
import { syncAllItems } from '@/lib/finance/plaid';
import { features } from '@/lib/env';

export async function syncPlaidJob({ userId }: { userId?: string } = {}) {
  if (!features.plaid) return { skipped: 'plaid not configured' };
  const rows = userId
    ? [{ userId }]
    : await db
        .selectDistinct({ userId: integration.userId })
        .from(integration)
        .where(and(eq(integration.kind, 'plaid'), eq(integration.status, 'active')));
  for (const r of rows) await syncAllItems(r.userId);
  return { users: rows.length };
}
