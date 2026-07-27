import { describe, expect, it } from 'vitest';
import {
  createLegacyTravelEntityReference,
  isCanonicalTravelEntityReference,
  isTravelEntityType,
} from '../../shared/travelKnowledge';

describe('travel knowledge entity references', () => {
  it('recognizes supported entity types', () => {
    expect(isTravelEntityType('city')).toBe(true);
    expect(isTravelEntityType('neighborhood')).toBe(true);
    expect(isTravelEntityType('continent')).toBe(false);
  });

  it('validates canonical entity references', () => {
    expect(isCanonicalTravelEntityReference({
      entityId: '3345231c-36bc-4f0f-a6f3-4955f3224cc4',
      canonicalSlug: 'th-bangkok',
      entityType: 'city',
      countryCode: 'TH',
      name: 'Bangkok',
      resolution: 'canonical',
    })).toBe(true);
  });

  it('keeps unresolved legacy references explicit', () => {
    expect(createLegacyTravelEntityReference({
      canonicalSlug: 'th-bangkok',
      entityType: 'city',
      countryCode: 'th',
      name: ' Bangkok ',
    })).toEqual({
      entityId: null,
      canonicalSlug: 'th-bangkok',
      entityType: 'city',
      countryCode: 'TH',
      name: 'Bangkok',
      resolution: 'legacy_unresolved',
    });
  });
});
