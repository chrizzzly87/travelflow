import { describe, expect, it } from 'vitest';
import {
  buildTermsVersionCandidate,
  isTermsDraftEdited,
  resolveTermsPublishVersion,
} from '../../pages/AdminLegalTermsPage';

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

describe('pages/AdminLegalTermsPage publish version', () => {
  const draft = { versionDate: '2026-10-24', versionRevision: 0, lastUpdated: '2026-10-24' };

  it('publishes the version the draft asks for when it is free', () => {
    expect(resolveTermsPublishVersion(draft, ['2026-03-03'])).toBe('2026-10-24');
    expect(resolveTermsPublishVersion({ ...draft, versionRevision: 4 }, ['2026-10-24'])).toBe('2026-10-24-4');
  });

  it('moves a taken version to the next free suffix, so the shown version is the published one', () => {
    expect(resolveTermsPublishVersion(draft, ['2026-10-24'])).toBe('2026-10-24-1');
    expect(resolveTermsPublishVersion({ ...draft, versionRevision: 1 }, ['2026-10-24', '2026-10-24-1'])).toBe('2026-10-24-2');
  });
});

describe('pages/AdminLegalTermsPage draft edits', () => {
  const baseline = {
    basisVersion: '2026-03-03',
    versionDate: '2026-10-24',
    versionRevision: 0,
    title: 'AGB',
    summary: '',
    lastUpdated: '2026-10-24',
    requiresReaccept: true,
    contentDe: '# AGB',
    contentEn: '# Terms',
  };

  it('treats rollout and version tweaks as no edit worth confirming', () => {
    expect(isTermsDraftEdited({ ...baseline, requiresReaccept: false, versionRevision: 2 }, baseline)).toBe(false);
  });

  it('flags text, title and summary changes', () => {
    expect(isTermsDraftEdited({ ...baseline, contentDe: '# AGB neu' }, baseline)).toBe(true);
    expect(isTermsDraftEdited({ ...baseline, title: 'Terms' }, baseline)).toBe(true);
    expect(isTermsDraftEdited({ ...baseline, summary: 'Clause 4' }, baseline)).toBe(true);
    expect(isTermsDraftEdited(null, baseline)).toBe(false);
  });
});
