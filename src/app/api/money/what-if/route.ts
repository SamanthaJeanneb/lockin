import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { account, object, scenario } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok, parseBody, rateLimit, tooMany } from '@/lib/api';
import { askJson } from '@/lib/ai/client';
import { WHAT_IF_SYSTEM } from '@/lib/ai/prompts';
import { promptContext } from '@/lib/ai/context';

const Body = z.object({ question: z.string().min(3).max(1000), save: z.boolean().default(false) });

interface WhatIf {
  scenario: string;
  assumptions: string[];
  cash: { before: number; after: number };
  monthly_savings: { before: number; after: number };
  runway_months: { before: number; after: number };
  goal_impacts: { goal_id: string; name: string; date_before: string; date_after: string; delta_months: number }[];
  summary: string;
}

/** Natural-language scenarios with the full downstream cascade. The model only
 *  ever sees real figures — it is told never to invent a balance or a rate. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!rateLimit(`whatif:${user.id}`, 20)) return tooMany();
    const b = await parseBody(req, Body);

    const [accounts, goals, flows] = await Promise.all([
      db.select().from(account).where(eq(account.userId, user.id)),
      db
        .select()
        .from(object)
        .where(and(eq(object.userId, user.id), eq(object.type, 'financial_goal'), isNull(object.deletedAt))),
      db.execute(sql`
        select sum(case when amount > 0 then amount else 0 end)::text as income,
               sum(case when amount < 0 then -amount else 0 end)::text as spending
          from "transaction"
         where user_id = ${user.id} and is_transfer = false
           and posted_at >= date_trunc('month', current_date - interval '3 months')`),
    ]);

    const f = (flows as unknown as { income: string; spending: string }[])[0];
    const income = Number(f?.income ?? 0) / 3;
    const spending = Number(f?.spending ?? 0) / 3;

    const ctx = await promptContext(user.id, { withOpenItems: false });
    const result = await askJson<WhatIf>({
      system: WHAT_IF_SYSTEM(ctx),
      user: JSON.stringify({
        question: b.question,
        accounts: accounts.map((a) => ({
          name: a.name, kind: a.kind, balance: Number(a.balanceCurrent ?? 0), apr: Number(a.apr ?? 0),
        })),
        monthly_income: Math.round(income),
        monthly_spending: Math.round(spending),
        goals: goals.map((g) => ({
          id: g.id, name: g.title, current: Number(g.currentValue ?? 0),
          target: Number(g.targetValue ?? 0), due: g.dueAt?.toISOString().slice(0, 10),
          annual_return: (g.props as { annual_return?: number }).annual_return ?? 0.07,
        })),
      }),
      maxTokens: 2000,
      fallback: {
        scenario: b.question, assumptions: ['Not enough data to model this yet.'],
        cash: { before: 0, after: 0 }, monthly_savings: { before: 0, after: 0 },
        runway_months: { before: 0, after: 0 }, goal_impacts: [], summary: '',
      },
    });

    let id: string | null = null;
    if (b.save) {
      const [row] = await db
        .insert(scenario)
        .values({ userId: user.id, question: b.question, result: result as never, isSaved: true })
        .returning({ id: scenario.id });
      id = row!.id;
    }

    return ok({ ...result, id });
  } catch (e) {
    return handleError(e);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(scenario)
      .where(and(eq(scenario.userId, user.id), eq(scenario.isSaved, true)))
      .orderBy(scenario.createdAt);
    return ok({ scenarios: rows });
  } catch (e) {
    return handleError(e);
  }
}
