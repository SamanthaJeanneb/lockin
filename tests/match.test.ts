import { describe, expect, it } from 'vitest';
import { extractAmount, extractQuantity, keywordOverlap, tokenize, verbProximity } from '@/lib/ai/match';

describe('tokenize', () => {
  it('drops stopwords and short fragments', () => {
    expect(tokenize('Finish the portfolio homepage')).toEqual(['finish', 'portfolio', 'homepage']);
  });
});

describe('keywordOverlap', () => {
  it('scores a full restatement at 1', () => {
    expect(keywordOverlap('finished the portfolio homepage', 'portfolio homepage')).toBe(1);
  });

  it('scores unrelated text at 0', () => {
    expect(keywordOverlap('ran four miles', 'send proposal to Alex')).toBe(0);
  });

  it('is symmetric in the sense that matters — the shorter side sets the ceiling', () => {
    const a = keywordOverlap('finished the portfolio homepage today', 'portfolio homepage');
    expect(a).toBeGreaterThan(0.9);
  });
});

describe('verbProximity', () => {
  it('rewards a completion verb sitting near the item words', () => {
    expect(verbProximity('finished the homepage', 'Finish portfolio homepage')).toBeGreaterThan(0.7);
  });

  it('returns 0 when no completion verb is present', () => {
    expect(verbProximity('thinking about the homepage', 'Finish portfolio homepage')).toBe(0);
  });

  it('decays with distance', () => {
    const near = verbProximity('finished the homepage', 'homepage');
    const far = verbProximity(
      'finished a completely different thing and much later mentioned the homepage',
      'homepage',
    );
    expect(near).toBeGreaterThan(far);
  });
});

describe('extractQuantity', () => {
  it('reads a habit value and normalises the unit', () => {
    expect(extractQuantity('ran 4 miles this morning')).toEqual({ value: 4, unit: 'mi' });
    expect(extractQuantity('read 30 pages')).toEqual({ value: 30, unit: 'pages' });
    expect(extractQuantity('walked 5 km')).toEqual({ value: 5, unit: 'km' });
  });

  it('returns null when there is no quantity', () => {
    expect(extractQuantity('went for a run')).toBeNull();
  });
});

describe('extractAmount', () => {
  it('reads currency in either notation', () => {
    expect(extractAmount('spent about $60 on dinner')).toBe(60);
    expect(extractAmount('that was 1,250 dollars')).toBe(1250);
  });

  it('returns null when no amount is present', () => {
    expect(extractAmount('had dinner with Alex')).toBeNull();
  });
});
