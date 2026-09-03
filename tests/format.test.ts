import { describe, expect, it } from 'vitest';
import {
  formatDelta, formatMinutes, formatMoney, formatMoneyCompact, formatPercent, greeting, initials,
} from '@/lib/format';

describe('money formatting', () => {
  it('rounds whole dollars by default', () => {
    expect(formatMoney(1234.56)).toBe('$1,235');
    expect(formatMoney(1234.56, { cents: true })).toBe('$1,234.56');
  });

  it('compacts large figures for metric tiles', () => {
    expect(formatMoneyCompact(1_240_000)).toBe('$1.24M');
    expect(formatMoneyCompact(902_000)).toBe('$902K');
    expect(formatMoneyCompact(412)).toBe('$412');
    // Under $10K stays exact — compacting a credit-card balance to "-$3K"
    // loses the digit that matters.
    expect(formatMoneyCompact(-3240)).toBe('-$3,240');
    expect(formatMoneyCompact(-42_000)).toBe('-$42K');
  });

  it('renders an em dash rather than $0 for missing data', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoneyCompact(undefined)).toBe('—');
  });
});

describe('formatDelta', () => {
  it('uses arrows and treats sub-half movement as flat', () => {
    expect(formatDelta(4)).toBe('↑ 4');
    expect(formatDelta(-2)).toBe('↓ 2');
    expect(formatDelta(0.2)).toBe('→ 0');
  });
});

describe('formatMinutes', () => {
  it('switches to hours past sixty', () => {
    expect(formatMinutes(30)).toBe('30 min');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(null)).toBe('—');
  });
});

describe('greeting', () => {
  it('splits the day at noon and six', () => {
    expect(greeting(new Date('2026-09-03T08:00:00'))).toBe('morning');
    expect(greeting(new Date('2026-09-03T13:00:00'))).toBe('afternoon');
    expect(greeting(new Date('2026-09-03T21:00:00'))).toBe('evening');
  });
});

describe('initials', () => {
  it('takes at most two', () => {
    expect(initials('Sarah Chen')).toBe('SC');
    expect(initials('Alex')).toBe('A');
    expect(initials('Jean Luc Picard')).toBe('JL');
  });
});

describe('formatPercent', () => {
  it('rounds and appends the sign', () => {
    expect(formatPercent(72.4)).toBe('72%');
    expect(formatPercent(null)).toBe('—');
  });
});
