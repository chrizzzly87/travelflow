import { describe, expect, it } from 'vitest';

import {
  COUNTRY_SEARCH_SCORE_THRESHOLD,
  buildSearchTokens,
  scoreCandidateTokens,
  scoreTokenMatch,
  searchCountryCandidates,
  type CountrySearchCandidate,
} from '../../services/countryExplorerSearch';
import { listCountryExplorerEntries } from '../../services/countryExplorerService';

const entries = listCountryExplorerEntries();

const buildCandidates = (): CountrySearchCandidate<{ name: string }>[] => entries.map((entry) => ({
  item: { name: entry.name },
  tokens: entry.searchTokens,
}));

const search = (query: string): string[] => searchCountryCandidates(buildCandidates(), query)
  .map((result) => result.item.name);

describe('scoreTokenMatch', () => {
  it('ranks exact above prefix above word prefix above substring above subsequence', () => {
    const exact = scoreTokenMatch('japan', 'japan');
    const prefix = scoreTokenMatch('japan', 'jap');
    const wordPrefix = scoreTokenMatch('new zealand', 'zeal');
    const substring = scoreTokenMatch('switzerland', 'zerl');
    const subsequence = scoreTokenMatch('south africa', 'sfr');

    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordPrefix);
    expect(wordPrefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(subsequence);
    expect(subsequence).toBeGreaterThan(0);
  });

  it('rejects out-of-order characters', () => {
    expect(scoreTokenMatch('japan', 'npj')).toBe(0);
  });

  it('does not fuzzy-match queries shorter than three characters', () => {
    expect(scoreTokenMatch('south africa', 'sa')).toBe(0);
  });

  it('scores a tight subsequence above a sparse one', () => {
    expect(scoreTokenMatch('abcdef', 'abc')).toBeGreaterThan(scoreTokenMatch('axbxcx', 'abc'));
  });
});

describe('scoreCandidateTokens', () => {
  const tokens = buildSearchTokens([
    { value: 'Japan', kind: 'name' },
    { value: 'Asia', kind: 'region' },
    { value: 'food', kind: 'tag' },
  ]);

  it('weights a name match above a region match', () => {
    expect(scoreCandidateTokens(tokens, 'japan')).toBeGreaterThan(scoreCandidateTokens(tokens, 'asia'));
  });

  it('requires every term of a multi-word query to match something', () => {
    expect(scoreCandidateTokens(tokens, 'japan food')).toBeGreaterThan(0);
    expect(scoreCandidateTokens(tokens, 'japan tundra')).toBe(0);
  });

  it('returns zero for an empty query', () => {
    expect(scoreCandidateTokens(tokens, '')).toBe(0);
  });
});

describe('buildSearchTokens', () => {
  it('normalizes diacritics and de-duplicates', () => {
    const tokens = buildSearchTokens([
      { value: 'Türkiye', kind: 'alias' },
      { value: 'Turkiye', kind: 'alias' },
    ]);
    expect(tokens.map((token) => token.normalized)).toEqual(['turkiye']);
  });

  it('adds a whitespace-collapsed variant for multi-word tokens', () => {
    const tokens = buildSearchTokens([{ value: 'New Zealand', kind: 'name' }]);
    expect(tokens.map((token) => token.normalized)).toEqual(['new zealand', 'newzealand']);
  });

  it('drops empty values', () => {
    expect(buildSearchTokens([{ value: '  ', kind: 'name' }])).toEqual([]);
  });
});

describe('searchCountryCandidates over the real country corpus', () => {
  it('is diacritic-insensitive in both directions', () => {
    expect(search('Turkiye')[0]).toBe('Turkey');
    expect(search('Türkiye')[0]).toBe('Turkey');
    expect(search('turkiye')[0]).toBe('Turkey');
  });

  it('finds a country by its localized name', () => {
    expect(search('Griechenland')[0]).toBe('Greece');
    expect(search('Japon')[0]).toBe('Japan');
  });

  it('matches a two-word name typed without the space', () => {
    expect(search('newzealand')[0]).toBe('New Zealand');
  });

  it('finds countries by region', () => {
    const results = search('caribbean');
    expect(results.length).toBeGreaterThan(1);
    expect(results).toContain('Jamaica');
  });

  it('finds countries by tag', () => {
    expect(search('fjords')).toContain('Norway');
  });

  it('ranks the exact name first even when other countries share the prefix', () => {
    expect(search('india')[0]).toBe('India');
    expect(search('chile')[0]).toBe('Chile');
  });

  it('returns an empty array for a query nothing matches', () => {
    expect(search('qzxwvk')).toEqual([]);
  });

  it('returns every candidate in input order for an empty query', () => {
    const results = searchCountryCandidates(buildCandidates(), '   ');
    expect(results).toHaveLength(entries.length);
    expect(results[0].item.name).toBe(entries[0].name);
    expect(results.every((result) => result.score === 0)).toBe(true);
  });

  it('never returns a result below the score threshold', () => {
    const results = searchCountryCandidates(buildCandidates(), 'thai');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => expect(result.score).toBeGreaterThanOrEqual(COUNTRY_SEARCH_SCORE_THRESHOLD));
  });
});
