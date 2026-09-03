import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { account, integration, transaction } from '@/lib/db/schema';
import { decrypt, encrypt } from '@/lib/crypto';
import { env, features } from '@/lib/env';
import { categorizeTransactions } from './categorize';

let api: PlaidApi | undefined;

export function plaid(): PlaidApi {
  if (!features.plaid) throw new Error('Plaid is not configured. See SETUP.md § Money.');
  api ??= new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env.plaidEnv as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': env.plaidClientId!,
          'PLAID-SECRET': env.plaidSecret!,
        },
      },
    }),
  );
  return api;
}

export async function createLinkToken(userId: string) {
  const res = await plaid().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Life OS',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: `${env.appUrl}/api/webhooks/plaid`,
  });
  return res.data.link_token;
}

/** Access tokens are encrypted before they touch the database and never leave
 *  the server. The client only ever sees a public token. */
export async function exchangePublicToken(userId: string, publicToken: string) {
  const res = await plaid().itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = res.data.access_token;
  const itemId = res.data.item_id;

  let institution: string | null = null;
  try {
    const item = await plaid().itemGet({ access_token: accessToken });
    if (item.data.item.institution_id) {
      const inst = await plaid().institutionsGetById({
        institution_id: item.data.item.institution_id,
        country_codes: [CountryCode.Us],
      });
      institution = inst.data.institution.name;
    }
  } catch {
    /* institution name is cosmetic */
  }

  const [row] = await db
    .insert(integration)
    .values({
      userId,
      kind: 'plaid',
      externalId: itemId,
      accessTokenEncrypted: encrypt(accessToken),
      meta: { institution },
    })
    .onConflictDoUpdate({
      target: [integration.userId, integration.kind, integration.externalId],
      set: { accessTokenEncrypted: encrypt(accessToken), status: 'active', error: null },
    })
    .returning();

  await syncItem(userId, row!.id);
  return row!;
}

export async function syncItem(userId: string, integrationId: string) {
  const [row] = await db
    .select()
    .from(integration)
    .where(and(eq(integration.id, integrationId), eq(integration.userId, userId)))
    .limit(1);
  if (!row?.accessTokenEncrypted) throw new Error('Plaid connection not found');

  const accessToken = decrypt(row.accessTokenEncrypted);
  const client = plaid();

  // Accounts and balances
  const balances = await client.accountsGet({ access_token: accessToken });
  const accountIdByExternal = new Map<string, string>();
  for (const a of balances.data.accounts) {
    const [saved] = await db
      .insert(account)
      .values({
        userId,
        integrationId,
        externalId: a.account_id,
        name: a.name,
        officialName: a.official_name ?? null,
        institution: (row.meta as { institution?: string }).institution ?? null,
        kind: a.type,
        subtype: a.subtype ?? null,
        mask: a.mask ?? null,
        currency: a.balances.iso_currency_code ?? 'USD',
        balanceCurrent: a.balances.current?.toString() ?? null,
        balanceAvailable: a.balances.available?.toString() ?? null,
        balanceLimit: a.balances.limit?.toString() ?? null,
        lastSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [account.userId, account.integrationId, account.externalId],
        set: {
          balanceCurrent: a.balances.current?.toString() ?? null,
          balanceAvailable: a.balances.available?.toString() ?? null,
          balanceLimit: a.balances.limit?.toString() ?? null,
          lastSyncAt: new Date(),
        },
      })
      .returning({ id: account.id });
    accountIdByExternal.set(a.account_id, saved!.id);
  }

  // Transactions, cursor-paginated
  let cursor = row.cursor ?? undefined;
  let added: Awaited<ReturnType<typeof client.transactionsSync>>['data']['added'] = [];
  let modified: typeof added = [];
  let removed: { transaction_id: string }[] = [];
  let hasMore = true;

  while (hasMore) {
    const res = await client.transactionsSync({ access_token: accessToken, cursor });
    added = added.concat(res.data.added);
    modified = modified.concat(res.data.modified);
    removed = removed.concat(res.data.removed);
    cursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }

  const upserted: { id: string; merchant: string | null; description: string | null }[] = [];
  for (const t of [...added, ...modified]) {
    const accountId = accountIdByExternal.get(t.account_id);
    if (!accountId) continue;
    const [saved] = await db
      .insert(transaction)
      .values({
        userId,
        accountId,
        externalId: t.transaction_id,
        postedAt: t.date,
        amount: (-t.amount).toString(), // Plaid: positive = money out. We invert.
        merchant: t.merchant_name ?? t.name,
        description: t.name,
        category: t.personal_finance_category?.primary?.toLowerCase() ?? null,
        pending: t.pending,
        meta: { plaid_category: t.personal_finance_category },
      })
      .onConflictDoUpdate({
        target: [transaction.userId, transaction.accountId, transaction.externalId],
        set: { amount: (-t.amount).toString(), pending: t.pending, postedAt: t.date },
      })
      .returning({ id: transaction.id });
    upserted.push({ id: saved!.id, merchant: t.merchant_name ?? t.name, description: t.name });
  }

  for (const r of removed) {
    await db
      .delete(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.externalId, r.transaction_id)));
  }

  await db
    .update(integration)
    .set({ cursor, lastSyncAt: new Date(), status: 'active', error: null })
    .where(eq(integration.id, integrationId));

  await categorizeTransactions(userId, upserted);

  return { accounts: balances.data.accounts.length, transactions: upserted.length, removed: removed.length };
}

export async function syncAllItems(userId: string) {
  const rows = await db
    .select()
    .from(integration)
    .where(and(eq(integration.userId, userId), eq(integration.kind, 'plaid')));
  const results = [];
  for (const r of rows) {
    try {
      results.push(await syncItem(userId, r.id));
    } catch (e) {
      await db
        .update(integration)
        .set({ status: 'error', error: e instanceof Error ? e.message : 'sync failed' })
        .where(eq(integration.id, r.id));
    }
  }
  return results;
}
