import { describe, expect, it } from 'vitest';
import { computeTrajectory } from '@/lib/db/rollup';

const day = 86_400_000;

describe('computeTrajectory', () => {
  it('reports ahead when progress leads elapsed time by more than the slack', () => {
    expect(
      computeTrajectory({
        progress: 80,
        startAt: new Date(Date.now() - 50 * day),
        dueAt: new Date(Date.now() + 50 * day),
      }),
    ).toBe('ahead');
  });

  it('reports on_track inside the five-point slack either side', () => {
    for (const progress of [47, 50, 53]) {
      expect(
        computeTrajectory({
          progress,
          startAt: new Date(Date.now() - 50 * day),
          dueAt: new Date(Date.now() + 50 * day),
        }),
      ).toBe('on_track');
    }
  });

  it('reports behind when progress trails elapsed time', () => {
    expect(
      computeTrajectory({
        progress: 20,
        startAt: new Date(Date.now() - 50 * day),
        dueAt: new Date(Date.now() + 50 * day),
      }),
    ).toBe('behind');
  });

  it('reports overdue once the deadline passes', () => {
    expect(computeTrajectory({ progress: 90, dueAt: new Date(Date.now() - day) })).toBe('overdue');
  });

  it('treats a completed item as ahead regardless of dates', () => {
    expect(
      computeTrajectory({ progress: 10, dueAt: new Date(Date.now() - day), completedAt: new Date() }),
    ).toBe('ahead');
  });

  it('returns none without a deadline, rather than guessing', () => {
    expect(computeTrajectory({ progress: 50 })).toBe('none');
  });

  it('derives a start from the horizon when none is stored', () => {
    // A 1w goal at 90% two days before the deadline is ahead; the same goal at
    // 10% is behind. Without the horizon fallback both would read as on_track.
    expect(computeTrajectory({ progress: 95, horizon: '1w', dueAt: new Date(Date.now() + 2 * day) })).toBe('ahead');
    expect(computeTrajectory({ progress: 10, horizon: '1w', dueAt: new Date(Date.now() + 2 * day) })).toBe('behind');
  });
});
