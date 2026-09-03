import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { subDays, subMonths } from 'date-fns';
import { db } from '@/lib/db/client';
import { account, object, transaction } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { assessFinancialGoal, debtPayoffPlan, runwayMonths, savingsRate } from '@/lib/finance/projections';
import { detectRecurring } from '@/lib/finance/categorize';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();

    const accounts = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, user.id), eq(account.includeInNetWorth, true)));

    const num = (v: string | null) => Number(v ?? 0);
    const cash = accounts.filter((a) => a.kind === 'depository').reduce((s, a) => s + num(a.balanceCurrent), 0);
    const investments = accounts.filter((a) => a.kind === 'investment').reduce((s, a) => s + num(a.balanceCurrent), 0);
    const debt = accounts
      .filter((a) => a.kind === 'credit' || a.kind === 'loan')
      .reduce((s, a) => s + Math.abs(num(a.balanceCurrent)), 0);
    const netWorth = cash + investments - debt;

    // Trailing three months of flows
    const flows = (await db.execute(sql`
      select date_trunc('month', posted_at) as month,
             sum(case when amount > 0 then amount else 0 end)::text as income,
             sum(case when amount < 0 then -amount else 0 end)::text as spending
        from "transaction"
       where user_id = ${user.id} and is_transfer = false
         and posted_at >= ${subMonths(new Date(), 6).toISOString().slice(0, 10)}
       group by 1 order by 1
    `)) as unknown as { month: string; income: string; spending: string }[];

    const thisMonth = flows[flows.length - 1];
    const income = Number(thisMonth?.income ?? 0);
    const spending = Number(thisMonth?.spending ?? 0);
    const avgSpending =
      flows.slice(-4, -1).reduce((s, f) => s + Number(f.spending), 0) / Math.max(1, flows.slice(-4, -1).length);

    const byCategory = (await db.execute(sql`
      select coalesce(category, 'other') as category,
             sum(-amount)::text as total,
             count(*)::text as n
        from "transaction"
       where user_id = ${user.id} and amount < 0 and is_transfer = false
         and posted_at >= date_trunc('month', current_date)
       group by 1 order by 2 desc
    `)) as unknown as { category: string; total: string; n: string }[];

    const categoryAverages = (await db.execute(sql`
      select coalesce(category, 'other') as category,
             (sum(-amount) / 3)::text as avg3
        from "transaction"
       where user_id = ${user.id} and amount < 0 and is_transfer = false
         and posted_at >= date_trunc('month', current_date - interval '3 months')
         and posted_at < date_trunc('month', current_date)
       group by 1
    `)) as unknown as { category: string; avg3: string }[];
    const avgByCategory = new Map(categoryAverages.map((c) => [c.category, Number(c.avg3)]));

    const spendingCategories = byCategory.map((c) => {
      const avg = avgByCategory.get(c.category) ?? 0;
      const total = Number(c.total);
      return {
        category: c.category,
        total,
        count: Number(c.n),
        average3m: Math.round(avg),
        deltaPercent: avg ? Math.round(((total - avg) / avg) * 100) : 0,
      };
    });

    const goals = await db
      .select()
      .from(object)
      .where(
        and(eq(object.userId, user.id), eq(object.type, 'financial_goal'), isNull(object.deletedAt)),
      );

    const monthlySavings = Math.max(0, income - spending);

    const financialGoals = goals.map((g) => {
      const props = g.props as { annual_return?: number; monthly?: number };
      const assessment = assessFinancialGoal({
        current: Number(g.currentValue ?? 0),
        target: Number(g.targetValue ?? 0),
        targetDate: g.dueAt ?? new Date(Date.now() + 365 * 86_400_000),
        actualMonthly: props.monthly ?? monthlySavings,
        annualReturn: props.annual_return ?? 0.07,
      });
      return { id: g.id, title: g.title, dueAt: g.dueAt, unit: g.unit, ...assessment };
    });

    const debts = accounts
      .filter((a) => (a.kind === 'credit' || a.kind === 'loan') && Math.abs(num(a.balanceCurrent)) > 0)
      .map((a) => ({
        id: a.id,
        name: a.name,
        balance: Math.abs(num(a.balanceCurrent)),
        apr: Number(a.apr ?? 0.18),
        minimum: num(a.minimumPayment) || Math.max(25, Math.abs(num(a.balanceCurrent)) * 0.02),
      }));

    const anomalies = spendingCategories.filter((c) => c.average3m > 0 && c.deltaPercent >= 25);

    const recurring = await detectRecurring(user.id).catch(() => []);

    const netWorthHistory = (await db.execute(sql`
      select date_trunc('day', at) as at, avg(value)::text as value
        from metric
       where user_id = ${user.id} and key = 'net_worth' and at > now() - interval '365 days'
       group by 1 order by 1
    `)) as unknown as { at: string; value: string }[];

    return ok({
      metrics: {
        netWorth,
        cash,
        investments,
        debt,
        income,
        spending,
        savingsRate: Math.round(savingsRate(income, spending)),
        runwayMonths: Math.round(runwayMonths(cash, avgSpending || spending) * 10) / 10,
        spendingDelta: avgSpending ? Math.round(((spending - avgSpending) / avgSpending) * 100) : 0,
      },
      history: {
        netWorth: netWorthHistory.map((h) => ({ at: h.at, value: Number(h.value) })),
        flows: flows.map((f) => ({
          month: f.month,
          income: Number(f.income),
          spending: Number(f.spending),
        })),
      },
      accounts,
      spendingCategories,
      anomalies,
      recurring,
      goals: financialGoals,
      debtPlan: debts.length ? debtPayoffPlan(debts, Math.max(0, monthlySavings * 0.3)) : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
