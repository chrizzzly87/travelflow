/**
 * Tiny in-repo fuzzy matcher for the countries explorer.
 *
 * Why not a dependency: the initial JS budget for marketing routes is tight
 * (see `docs/INITIAL_JS_SIZE_OPTIMIZATION_GUIDE.md`) and the corpus is ~50 entries with a handful
 * of tokens each. A scored prefix/substring/subsequence matcher is a few hundred bytes gzipped
 * and gives us full control over ranking.
 *
 * Normalization (diacritic folding, punctuation stripping) is reused from
 * `services/countryAliasService.ts` so "Turkiye", "Türkiye" and "turkiye" all collapse to the
 * same key.
 */

import { normalizeCountrySearchToken } from './countryAliasService';

/** Which kind of field a search token came from. Drives the field weight in scoring. */
export type CountrySearchTokenKind = 'name' | 'alias' | 'code' | 'region' | 'tag';

export interface CountrySearchToken {
  /** Raw (un-normalized) token value. Normalized by {@link buildSearchTokens}. */
  value: string;
  kind: CountrySearchTokenKind;
}

/** A token whose text has already been normalized — the shape the scorer consumes. */
export interface NormalizedSearchToken {
  normalized: string;
  kind: CountrySearchTokenKind;
}

export interface CountrySearchCandidate<TItem> {
  item: TItem;
  tokens: NormalizedSearchToken[];
}

export interface CountrySearchResult<TItem> {
  item: TItem;
  score: number;
}

/** Relative importance of each field. A region match should never outrank a name match. */
const FIELD_WEIGHTS: Record<CountrySearchTokenKind, number> = {
  name: 1,
  alias: 0.92,
  code: 0.86,
  region: 0.6,
  tag: 0.55,
};

const SCORE_EXACT = 100;
const SCORE_PREFIX = 82;
const SCORE_WORD_PREFIX = 70;
const SCORE_SUBSTRING = 58;
const SCORE_SUBSEQUENCE_BASE = 30;
const SCORE_SUBSEQUENCE_BONUS = 14;

/** Subsequence matching is noisy for very short queries, so it only kicks in from 3 characters. */
export const MIN_SUBSEQUENCE_QUERY_LENGTH = 3;

/** Results below this score are treated as "no match". */
export const COUNTRY_SEARCH_SCORE_THRESHOLD = 12;

const isWordPrefix = (candidate: string, query: string): boolean => (
  candidate.split(' ').some((word) => word.length > 0 && word.startsWith(query))
);

/**
 * Ordered-subsequence score. Every query character must appear in `candidate` in order.
 * Tighter matches (fewer skipped characters) score higher, so "zeal" ranks New Zealand above a
 * candidate where the same letters are spread far apart.
 */
const scoreSubsequence = (candidate: string, query: string): number => {
  if (query.length < MIN_SUBSEQUENCE_QUERY_LENGTH) return 0;

  let candidateIndex = 0;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;

  for (let queryIndex = 0; queryIndex < query.length; queryIndex += 1) {
    const character = query[queryIndex];
    let found = -1;
    while (candidateIndex < candidate.length) {
      if (candidate[candidateIndex] === character) {
        found = candidateIndex;
        candidateIndex += 1;
        break;
      }
      candidateIndex += 1;
    }
    if (found === -1) return 0;
    if (firstMatchIndex === -1) firstMatchIndex = found;
    lastMatchIndex = found;
  }

  const span = lastMatchIndex - firstMatchIndex + 1;
  const density = span > 0 ? query.length / span : 0;
  return SCORE_SUBSEQUENCE_BASE + Math.round(SCORE_SUBSEQUENCE_BONUS * density);
};

/** Raw (unweighted) match score between one normalized token and one normalized query term. */
export const scoreTokenMatch = (candidate: string, query: string): number => {
  if (!candidate || !query) return 0;
  if (candidate === query) return SCORE_EXACT;
  if (candidate.startsWith(query)) return SCORE_PREFIX;
  if (isWordPrefix(candidate, query)) return SCORE_WORD_PREFIX;
  if (candidate.includes(query)) return SCORE_SUBSTRING;
  return scoreSubsequence(candidate, query);
};

/**
 * Score one candidate's tokens against a whole (already normalized) query.
 *
 * Multi-word queries are AND-ed: every term must match at least one token, otherwise the
 * candidate is rejected. The final score is the mean of each term's best weighted token score.
 */
export const scoreCandidateTokens = (
  tokens: NormalizedSearchToken[],
  normalizedQuery: string,
): number => {
  const terms = normalizedQuery.split(' ').filter(Boolean);
  if (terms.length === 0) return 0;

  let total = 0;

  for (const term of terms) {
    let bestForTerm = 0;
    for (const token of tokens) {
      const raw = scoreTokenMatch(token.normalized, term);
      if (raw === 0) continue;
      const weighted = raw * FIELD_WEIGHTS[token.kind];
      if (weighted > bestForTerm) bestForTerm = weighted;
    }
    if (bestForTerm === 0) return 0;
    total += bestForTerm;
  }

  return total / terms.length;
};

/** Normalizes and de-duplicates raw tokens. Empty values are dropped. */
export const buildSearchTokens = (tokens: CountrySearchToken[]): NormalizedSearchToken[] => {
  const seen = new Set<string>();
  const normalizedTokens: NormalizedSearchToken[] = [];

  tokens.forEach((token) => {
    const normalized = normalizeCountrySearchToken(token.value || '');
    if (!normalized) return;
    const key = `${token.kind}:${normalized}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalizedTokens.push({ normalized, kind: token.kind });
    }

    // A collapsed variant lets "newzealand" match "new zealand".
    const compact = normalized.replace(/ /g, '');
    if (compact === normalized) return;
    const compactKey = `${token.kind}:${compact}`;
    if (seen.has(compactKey)) return;
    seen.add(compactKey);
    normalizedTokens.push({ normalized: compact, kind: token.kind });
  });

  return normalizedTokens;
};

/**
 * Ranks candidates against a raw user query.
 *
 * An empty query returns every candidate in input order with score `0` — callers rely on that so
 * the un-searched list keeps its editorial (popularity) ordering. Ties keep input order too,
 * because `Array.prototype.sort` is stable.
 */
export const searchCountryCandidates = <TItem>(
  candidates: CountrySearchCandidate<TItem>[],
  query: string,
): CountrySearchResult<TItem>[] => {
  const normalizedQuery = normalizeCountrySearchToken(query || '');
  if (!normalizedQuery) return candidates.map((candidate) => ({ item: candidate.item, score: 0 }));

  return candidates
    .map((candidate) => ({
      item: candidate.item,
      score: scoreCandidateTokens(candidate.tokens, normalizedQuery),
    }))
    .filter((result) => result.score >= COUNTRY_SEARCH_SCORE_THRESHOLD)
    .sort((left, right) => right.score - left.score);
};
