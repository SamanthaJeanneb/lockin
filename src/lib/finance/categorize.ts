import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { transaction } from '@/lib/db/schema';
import { askJson } from '@/lib/ai/client';
import { SPEND_CATEGORIES } from '@/lib/constants';
import { features } from '@/lib/env';

/** Deterministic rules first — they are free, instant and cover most volume. */
const RULES: [RegExp, string][] = [
  [/whole ?foods|trader joe|safeway|kroger|aldi|grocer|market/i, 'groceries'],
  [/uber ?eats|doordash|grubhub|restaurant|cafe|coffee|starbucks|pizza|sushi|bar\b/i, 'restaurants'],
  [/uber|lyft|transit|metro|shell|chevron|exxon|gas|parking|toll/i, 'transport'],
  [/rent|mortgage|hoa|landlord/i, 'housing'],
  [/electric|water|gas co|comcast|xfinity|verizon|at&t|internet|utility/i, 'utilities'],
  [/netflix|spotify|hulu|disney|adobe|figma|github|notion|icloud|dropbox|subscription/i, 'subscriptions'],
  [/amazon|target|walmart|best buy|apple store|nike|zara|shop/i, 'shopping'],
  [/pharmacy|cvs|walgreens|doctor|dental|clinic|gym|fitness/i, 'health'],
  [/airbnb|hotel|airlines|delta|united|expedia|flight/i, 'travel'],
  [/cinema|theater|steam|playstation|xbox|concert|ticketmaster/i, 'entertainment'],
  [/tuition|udemy|coursera|book ?store|kindle/i, 'education'],
  [/fee|interest charge|atm|overdraft/i, 'fees'],
];

export function ruleCategory(merchant: string | null, description: string | null): string | null {
  const text = `${merchant ?? ''} ${description ?? ''}`;
  for (const [re, cat] of RULES) if (re.test(text)) return cat;
  return null;
}

/** Corrections the user has already made are the strongest signal there is. */
async function learnedCategory(userId: string, merchant: string | null): Promise<string | null> {
  if (!merchant) return null;
  const rows = await db.execute(sql`
    select category, count(*)::text as n
      from "transaction"
     where user_id = ${userId} and category_source = 'user'
       and merchant is not null and similarity(merchant, ${merchant}) > 0.6
     group by category order by count(*) desc limit 1
  `);
  const top = (rows as unknown as { category: string }[])[0];
  return top?.category ?? null;
}

export async function categorizeTransactions(
  userId: string,
  rows: { id: string; merchant: string | null; description: string | null }[],
) {
  const unresolved: typeof rows = [];

  for (const r of rows) {
    const learned = await learnedCategory(userId, r.merchant);
    const category = learned ?? ruleCategory(r.merchant, r.description);
    if (category) {
      await db
        .update(transaction)
        .set({ category, categorySource: learned ? 'user' : 'plaid' })
        .where(and(eq(transaction.id, r.id), eq(transaction.userId, userId)));
    } else {
      unresolved.push(r);
    }
  }

  if (!unresolved.length || !features.ai) return;

  const result = await askJson<{ assignments: { id: string; category: string }[] }>({
    system: `Assign one category to each transaction. Categories: ${SPEND_CATEGORIES.join(', ')}.
Use "other" when nothing fits. Return {"assignments":[{"id":"…","category":"…"}]} and nothing else.`,
    user: unresolved.map((r) => `${r.id} | ${r.merchant ?? ''} | ${r.description ?? ''}`).join('\n'),
    fallback: { assignments: [] },
  });

  for (const a of result.assignments) {
    if (!SPEND_CATEGORIES.includes(a.category as never)) continue;
    await db
      .update(transaction)
      .set({ category: a.category, categorySource: 'ai' })
      .where(and(eq(transaction.id, a.id), eq(transaction.userId, userId)));
  }
}

/** A charge repeating within ±3 days at a stable amount is a subscription. */
export async function detectRecurring(userId: string) {
  const rows = await db.execute(sql`
    select merchant,
           round(avg(abs(amount))::numeric, 2) as amount,
           count(*)::text as n,
           max(posted_at) as last_at,
           round(avg(gap)::numeric) as avg_gap
      from (
        select merchant, amount, posted_at,
               posted_at - lag(posted_at) over (partition by merchant order by posted_at) as gap
          from "transaction"
         where user_id = ${userId} and merchant is not null and amount < 0
           and posted_at > current_date - interval '400 days'
      ) t
     where gap is not null
     group by merchant
    having count(*) >= 3
       and stddev_pop(extract(epoch from gap)) < 5 * 86400
       and avg(gap) between 5 and 400
  `);
  return (rows as unknown as {
    merchant: string;
    amount: string;
    n: string;
    last_at: string;
    avg_gap: string;
  }[]).map((r) => ({
    merchant: r.merchant,
    amount: Number(r.amount),
    occurrences: Number(r.n),
    lastChargedAt: r.last_at,
    cadence: cadenceFor(Number(r.avg_gap)),
  }));
}

function cadenceFor(days: number): string {
  if (days <= 9) return 'weekly';
  if (days <= 16) return 'biweekly';
  if (days <= 45) return 'monthly';
  if (days <= 120) return 'quarterly';
  return 'annual';
}
