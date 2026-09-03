/** Compound growth with monthly contributions. All finance maths lives here so
 *  the goal card, the what-if engine and the reality check agree. */

export interface ProjectionInput {
  current: number;
  monthly: number;
  annualReturn: number; // 0.07 for 7%
  months: number;
}

export function futureValue({ current, monthly, annualReturn, months }: ProjectionInput): number {
  const r = annualReturn / 12;
  if (r === 0) return current + monthly * months;
  const growth = (1 + r) ** months;
  return current * growth + monthly * ((growth - 1) / r);
}

/** Monthly contribution needed to hit a target by a date. */
export function requiredMonthly(
  current: number,
  target: number,
  months: number,
  annualReturn: number,
): number {
  if (months <= 0) return Math.max(0, target - current);
  const r = annualReturn / 12;
  if (r === 0) return Math.max(0, (target - current) / months);
  const growth = (1 + r) ** months;
  return Math.max(0, (target - current * growth) / ((growth - 1) / r));
}

/** When a target is actually reached at the current rate. Null means never. */
export function monthsToTarget(
  current: number,
  target: number,
  monthly: number,
  annualReturn: number,
  cap = 1200,
): number | null {
  if (current >= target) return 0;
  if (monthly <= 0 && annualReturn <= 0) return null;
  const r = annualReturn / 12;
  let balance = current;
  for (let m = 1; m <= cap; m++) {
    balance = balance * (1 + r) + monthly;
    if (balance >= target) return m;
  }
  return null;
}

export interface GoalStatus {
  progress: number;
  requiredMonthly: number;
  actualMonthly: number;
  shortfall: number;
  projected: number;
  projectedDate: string | null;
  monthsLate: number | null;
  onTrack: boolean;
}

export function assessFinancialGoal(input: {
  current: number;
  target: number;
  targetDate: Date;
  actualMonthly: number;
  annualReturn: number;
}): GoalStatus {
  const months = Math.max(
    0,
    Math.round((input.targetDate.getTime() - Date.now()) / (30.44 * 86_400_000)),
  );
  const required = requiredMonthly(input.current, input.target, months, input.annualReturn);
  const projected = futureValue({
    current: input.current,
    monthly: input.actualMonthly,
    annualReturn: input.annualReturn,
    months,
  });
  const actualMonths = monthsToTarget(
    input.current,
    input.target,
    input.actualMonthly,
    input.annualReturn,
  );
  const projectedDate =
    actualMonths == null
      ? null
      : new Date(Date.now() + actualMonths * 30.44 * 86_400_000).toISOString();

  return {
    progress: input.target ? Math.min(100, (input.current / input.target) * 100) : 0,
    requiredMonthly: Math.round(required),
    actualMonthly: Math.round(input.actualMonthly),
    shortfall: Math.round(Math.max(0, required - input.actualMonthly)),
    projected: Math.round(projected),
    projectedDate,
    monthsLate: actualMonths == null ? null : Math.max(0, actualMonths - months),
    onTrack: projected >= input.target * 0.98,
  };
}

/** Avalanche ordering: highest APR first, which minimises total interest. */
export function debtPayoffPlan(
  debts: { id: string; name: string; balance: number; apr: number; minimum: number }[],
  extraMonthly: number,
) {
  const order = [...debts].sort((a, b) => b.apr - a.apr);
  const balances = new Map(order.map((d) => [d.id, d.balance]));
  const paidOff: { id: string; name: string; months: number; interest: number }[] = [];
  const interest = new Map(order.map((d) => [d.id, 0]));
  let freed = 0;

  for (let month = 1; month <= 600 && paidOff.length < order.length; month++) {
    let extra = extraMonthly + freed;
    for (const d of order) {
      const bal = balances.get(d.id)!;
      if (bal <= 0) continue;
      const monthInterest = (bal * d.apr) / 12;
      interest.set(d.id, interest.get(d.id)! + monthInterest);
      let payment = d.minimum;
      if (extra > 0 && order.find((o) => balances.get(o.id)! > 0)?.id === d.id) {
        payment += extra;
        extra = 0;
      }
      const next = bal + monthInterest - payment;
      balances.set(d.id, next);
      if (next <= 0) {
        paidOff.push({ id: d.id, name: d.name, months: month, interest: Math.round(interest.get(d.id)!) });
        freed += d.minimum;
      }
    }
  }
  return { order: order.map((d) => d.id), paidOff, totalInterest: Math.round([...interest.values()].reduce((a, b) => a + b, 0)) };
}

export function savingsRate(income: number, spending: number): number {
  if (income <= 0) return 0;
  return Math.max(-100, Math.min(100, ((income - spending) / income) * 100));
}

export function runwayMonths(cash: number, monthlySpend: number): number {
  if (monthlySpend <= 0) return Infinity;
  return cash / monthlySpend;
}
