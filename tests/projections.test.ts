import { describe, expect, it } from 'vitest';
import {
  assessFinancialGoal, debtPayoffPlan, futureValue, monthsToTarget, requiredMonthly, runwayMonths,
  savingsRate,
} from '@/lib/finance/projections';

describe('futureValue', () => {
  it('is plain addition at a zero return', () => {
    expect(futureValue({ current: 1000, monthly: 100, annualReturn: 0, months: 12 })).toBe(2200);
  });

  it('compounds monthly', () => {
    const v = futureValue({ current: 10_000, monthly: 0, annualReturn: 0.12, months: 12 });
    expect(v).toBeGreaterThan(11_200);
    expect(v).toBeLessThan(11_300);
  });
});

describe('requiredMonthly', () => {
  it('inverts futureValue', () => {
    const monthly = requiredMonthly(10_000, 50_000, 60, 0.07);
    const projected = futureValue({ current: 10_000, monthly, annualReturn: 0.07, months: 60 });
    expect(Math.round(projected)).toBeCloseTo(50_000, -2);
  });

  it('never asks for a negative contribution', () => {
    expect(requiredMonthly(100_000, 50_000, 60, 0.07)).toBe(0);
  });
});

describe('monthsToTarget', () => {
  it('returns 0 when already there', () => {
    expect(monthsToTarget(100, 50, 10, 0.05)).toBe(0);
  });

  it('returns null when the target is unreachable', () => {
    expect(monthsToTarget(100, 1_000_000, 0, 0)).toBeNull();
  });
});

describe('assessFinancialGoal', () => {
  it('flags a goal that is behind and quantifies the shortfall', () => {
    const result = assessFinancialGoal({
      current: 10_000,
      target: 100_000,
      targetDate: new Date(Date.now() + 365 * 86_400_000),
      actualMonthly: 1_000,
      annualReturn: 0.07,
    });
    expect(result.onTrack).toBe(false);
    expect(result.shortfall).toBeGreaterThan(0);
    expect(result.requiredMonthly).toBeGreaterThan(result.actualMonthly);
  });

  it('recognises a goal that is on track', () => {
    const result = assessFinancialGoal({
      current: 95_000,
      target: 100_000,
      targetDate: new Date(Date.now() + 365 * 86_400_000),
      actualMonthly: 1_000,
      annualReturn: 0.07,
    });
    expect(result.onTrack).toBe(true);
    expect(result.shortfall).toBe(0);
  });
});

describe('debtPayoffPlan', () => {
  it('clears the highest interest first', () => {
    const plan = debtPayoffPlan(
      [
        { id: 'card', name: 'Credit card', balance: 3000, apr: 0.23, minimum: 60 },
        { id: 'loan', name: 'Student loan', balance: 14000, apr: 0.054, minimum: 210 },
      ],
      400,
    );
    expect(plan.order[0]).toBe('card');
    expect(plan.paidOff[0]?.id).toBe('card');
    expect(plan.totalInterest).toBeGreaterThan(0);
  });
});

describe('savingsRate and runway', () => {
  it('computes a savings rate', () => {
    expect(savingsRate(10_000, 7_500)).toBe(25);
  });

  it('returns zero when there is no income, rather than dividing by zero', () => {
    expect(savingsRate(0, 500)).toBe(0);
  });

  it('reports infinite runway when nothing is spent', () => {
    expect(runwayMonths(10_000, 0)).toBe(Infinity);
  });
});
