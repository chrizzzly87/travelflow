import { describe, expect, it } from 'vitest';
import { buildJourneySpecFromCreateTripIntent } from '../../services/createTripJourneySpecService';
import { validateJourneySpec } from '../../shared/journeySpec';

describe('createTripJourneySpecService', () => {
  it('converts classic destination intent into a valid versioned JourneySpec', () => {
    const spec = buildJourneySpecFromCreateTripIntent({
      destinationNames: ['Thailand'],
      startDate: '2026-11-01',
      endDate: '2026-11-08',
      durationDays: 7,
      roundTrip: true,
      pace: 'Fast',
      preferences: {
        routeLock: true,
        tripStyleTags: ['food', 'culture'],
        transportPreferences: ['train'],
        specificCities: 'Bangkok and Chiang Mai',
      },
      createdFrom: 'classic',
    });

    expect(validateJourneySpec(spec, { phase: 'intent' }).valid).toBe(true);
    expect(spec).toMatchObject({
      version: 1,
      createdFrom: 'classic',
      countryCodes: ['TH'],
      dateWindow: {
        mode: 'exact',
        startDate: '2026-11-01',
        endDate: '2026-11-08',
      },
      constraints: {
        roundTrip: true,
        routeLocked: true,
        transportPreferences: ['train'],
      },
      preferences: {
        pace: 'full',
        interestTags: ['food', 'culture'],
        freeTextPlaceRequest: 'Bangkok and Chiang Mai',
      },
    });
  });

  it('deduplicates island and country selections into one flexible country scope', () => {
    const spec = buildJourneySpecFromCreateTripIntent({
      destinationNames: ['Koh Samui', 'Thailand'],
      durationDays: 14,
      pace: 'Relaxed',
      flexibleMonths: [11, 12, 12],
      preferences: {
        flexWindow: 'shoulder',
        selectedIslandNames: ['Koh Samui'],
      },
      createdFrom: 'wizard_v3',
    });

    expect(spec.countryCodes).toEqual(['TH']);
    expect(spec.places).toHaveLength(1);
    expect(spec.places[0]?.entity).toMatchObject({
      entityType: 'country',
      countryCode: 'TH',
      name: 'Thailand',
      resolution: 'legacy_unresolved',
    });
    expect(spec.dateWindow).toEqual({
      mode: 'flexible',
      durationDays: 14,
      months: [11, 12],
      season: 'shoulder',
    });
    expect(spec.preferences.pace).toBe('relaxed');
  });

  it('rejects intent that cannot resolve a country scope', () => {
    expect(() => buildJourneySpecFromCreateTripIntent({
      destinationNames: ['Unknown destination'],
      durationDays: 4,
      createdFrom: 'classic',
    })).toThrow('JourneySpec requires at least one recognized destination country.');
  });
});
