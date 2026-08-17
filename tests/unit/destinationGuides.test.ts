import { describe, expect, it } from 'vitest';
import destinationGuidesJson from '../../data/destinationGuides.json';
import {
  buildDestinationSourceLink,
  cleanDestinationSourceUrl,
  type DestinationGuideDocument,
  validateDestinationGuideDocument,
} from '../../shared/destinationGuides';
import {
  getChildDestinationGuide,
  getCountryDestinationGuide,
  getDestinationGuideChildren,
  listDestinationGuides,
  resolveDestinationGuide,
} from '../../services/destinationGuideService';

const document = destinationGuidesJson as DestinationGuideDocument;

describe('destination guide dataset', () => {
  it('contains a valid 50-country launch set with nested destinations', () => {
    expect(validateDestinationGuideDocument(document)).toEqual([]);
    expect(document.guides.filter((guide) => guide.kind === 'country')).toHaveLength(50);
    expect(document.guides.filter((guide) => guide.kind === 'city').length).toBeGreaterThan(100);
    expect(document.guides.filter((guide) => guide.kind === 'island').length).toBeGreaterThan(50);
  });

  it('models Mallorca as an island child of Spain', () => {
    const mallorca = getChildDestinationGuide('spain', 'mallorca');
    expect(mallorca).toMatchObject({ kind: 'island', parentSlug: 'spain', countryCode: 'ES' });
  });

  it('normalizes referral tracking without losing referral provenance', () => {
    const cleaned = cleanDestinationSourceUrl('https://example.com/product?locale=en&utm_source=partner&ref=abc#offer');
    expect(cleaned.url).toBe('https://example.com/product?locale=en');
    expect(cleaned.removedTrackingParameters).toEqual(['ref', 'utm_source']);

    const sourceLink = buildDestinationSourceLink({
      label: 'Partner',
      rawUrl: 'https://example.com/product?utm_campaign=spring',
      purpose: 'connectivity',
      accessedAt: '2026-08-17T00:00:00.000Z',
    });
    expect(sourceLink).toMatchObject({
      url: 'https://example.com/product',
      isReferral: true,
      removedTrackingParameters: ['utm_campaign'],
    });
  });

  it('queries country lists, children, and inherited child planning data', () => {
    expect(listDestinationGuides()).toHaveLength(50);
    expect(listDestinationGuides({ kind: 'island', countryCode: 'TH' }).length).toBeGreaterThan(0);
    expect(getCountryDestinationGuide('TH')?.slug).toBe('thailand');
    expect(getDestinationGuideChildren('Thailand').some((guide) => guide.slug === 'phuket')).toBe(true);

    const phuket = resolveDestinationGuide('thailand', 'phuket');
    expect(phuket?.guide.kind).toBe('island');
    expect(phuket?.effectiveSeasonality).toEqual(phuket?.country.seasonality);
    expect(phuket?.effectiveEvents.length).toBeGreaterThan(0);
  });
});

