import { describe, expect, it } from 'vitest';
import { nextOccurrence } from '@/jobs/recurrence';

const from = new Date('2026-09-03T00:00:00Z'); // Thursday

describe('nextOccurrence', () => {
  it('handles daily with an interval', () => {
    expect(nextOccurrence('FREQ=DAILY', from)!.toISOString().slice(0, 10)).toBe('2026-09-04');
    expect(nextOccurrence('FREQ=DAILY;INTERVAL=3', from)!.toISOString().slice(0, 10)).toBe('2026-09-06');
  });

  it('handles weekly', () => {
    expect(nextOccurrence('FREQ=WEEKLY', from)!.toISOString().slice(0, 10)).toBe('2026-09-10');
  });

  it('honours BYDAY, which is how "every weekday" is actually written', () => {
    const next = nextOccurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR', from)!;
    expect(next.getDay()).toBe(5); // the Friday after a Thursday
  });

  it('handles monthly and yearly', () => {
    expect(nextOccurrence('FREQ=MONTHLY', from)!.toISOString().slice(0, 7)).toBe('2026-10');
    expect(nextOccurrence('FREQ=YEARLY', from)!.toISOString().slice(0, 7)).toBe('2027-09');
  });

  it('tolerates the RRULE: prefix', () => {
    expect(nextOccurrence('RRULE:FREQ=DAILY', from)).not.toBeNull();
  });

  it('returns null for a frequency it does not support, rather than guessing', () => {
    expect(nextOccurrence('FREQ=HOURLY', from)).toBeNull();
  });
});
