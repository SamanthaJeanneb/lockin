import { describe, expect, it } from 'vitest';
import { parseJson } from '@/lib/ai/client';
import { isUuid, resolveDate } from '@/lib/ai/extract';

const EMPTY = { objects: [], edges: [] };

describe('parseJson', () => {
  it('parses clean JSON', () => {
    expect(parseJson('{"a":1}', EMPTY)).toEqual({ a: 1 });
  });

  it('strips a markdown fence, which is the most common model slip', () => {
    expect(parseJson('```json\n{"a":1}\n```', EMPTY)).toEqual({ a: 1 });
  });

  it('recovers the outermost object when prose is appended', () => {
    expect(parseJson('{"a":1} — hope that helps!', EMPTY)).toEqual({ a: 1 });
  });

  it('is not confused by braces inside strings', () => {
    expect(parseJson('{"a":"} not the end {"}', EMPTY)).toEqual({ a: '} not the end {' });
  });

  it('is not confused by escaped quotes', () => {
    expect(parseJson('{"a":"say \\"hi\\""}', EMPTY)).toEqual({ a: 'say "hi"' });
  });

  it('falls back rather than throwing on a truncated response', () => {
    expect(parseJson('{"objects":[{"title":"half', EMPTY)).toEqual(EMPTY);
  });

  it('falls back on empty input', () => {
    expect(parseJson('', EMPTY)).toEqual(EMPTY);
  });
});

describe('resolveDate', () => {
  const from = new Date('2026-09-03T09:00:00Z'); // a Thursday

  it('resolves relative words', () => {
    expect(resolveDate('today', from)!.slice(0, 10)).toBe('2026-09-03');
    expect(resolveDate('tomorrow', from)!.slice(0, 10)).toBe('2026-09-04');
    expect(resolveDate('next week', from)!.slice(0, 10)).toBe('2026-09-10');
  });

  it('resolves a weekday to the next one', () => {
    expect(resolveDate('tuesday', from)!.slice(0, 10)).toBe('2026-09-08');
  });

  it('passes an ISO date straight through', () => {
    expect(resolveDate('2026-12-01', from)!.slice(0, 10)).toBe('2026-12-01');
  });

  it('returns null for "someday", which is an absence of a date, not a date', () => {
    expect(resolveDate('someday', from)).toBeNull();
  });

  it('returns null for nonsense rather than inventing a date', () => {
    expect(resolveDate('when I get round to it', from)).toBeNull();
  });
});

describe('isUuid', () => {
  it('accepts a v4 uuid and rejects a tmp id', () => {
    expect(isUuid('dd018022-7cf6-4f01-8c3d-5e6f438fd541')).toBe(true);
    expect(isUuid('o1')).toBe(false);
  });
});
