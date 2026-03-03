import { describe, expect, it } from 'vitest';
import { buildTermsVersionCandidate } from '../../pages/AdminLegalTermsPage';

describe('pages/AdminLegalTermsPage version candidate builder', () => {
  it('returns the base date when it is not used yet', () => {
    expect(buildTermsVersionCandidate('2026-03-03', ['2026-03-02'])).toBe('2026-03-03');
  });

  it('adds incrementing suffixes when the base date is already used', () => {
    expect(buildTermsVersionCandidate('2026-03-03', ['2026-03-03'])).toBe('2026-03-03-1');
    expect(buildTermsVersionCandidate('2026-03-03', ['2026-03-03', '2026-03-03-1'])).toBe('2026-03-03-2');
  });

  it('always increments from the highest existing suffix for the date', () => {
    expect(buildTermsVersionCandidate('2026-03-03', ['2026-03-03', '2026-03-03-2'])).toBe('2026-03-03-3');
  });
});
