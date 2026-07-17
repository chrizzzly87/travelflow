import { describe, expect, it } from 'vitest';
import {
  buildJourneySpecFromLegacyCreateTrip,
  normalizeJourneySpec,
  validateJourneySpec,
  type JourneyPlaceSelection,
  type JourneySpec,
} from '../../shared/journeySpec';

const bangkok: JourneyPlaceSelection = {
  entity: {
    entityId: '3345231c-36bc-4f0f-a6f3-4955f3224cc4',
    canonicalSlug: 'th-bangkok',
    entityType: 'city',
    countryCode: 'TH',
    name: 'Bangkok',
    resolution: 'canonical',
  },
  role: 'base',
  order: 0,
  nights: 3,
};

const cityBreakSpec: JourneySpec = {
  version: 1,
  journeyType: 'city_break',
  countryCodes: ['TH'],
  dateWindow: { mode: 'exact', startDate: '2026-12-02', endDate: '2026-12-05' },
  durationDays: 3,
  places: [bangkok],
  constraints: {
    roundTrip: true,
    routeLocked: false,
    maxBaseChanges: 0,
    maxTransferMinutes: 120,
    transportPreferences: ['train', 'walk'],
  },
  preferences: {
    pace: 'balanced',
    interestTags: ['food', 'culture'],
    vibeTags: ['energetic'],
  },
  createdFrom: 'wizard_shape_v1',
  experimentVersion: 'th-v1',
};

describe('JourneySpec', () => {
  it('accepts a valid city-break contract', () => {
    expect(validateJourneySpec(cityBreakSpec)).toEqual({ valid: true, errors: [] });
  });

  it('requires a base and day trip for a hub trip', () => {
    const result = validateJourneySpec({ ...cityBreakSpec, journeyType: 'hub_and_day_trips' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('A hub-and-day-trips JourneySpec requires one base and at least one day trip.');
  });

  it('accepts an incomplete route while validating wizard intent', () => {
    const intent = {
      ...cityBreakSpec,
      places: [],
    };

    expect(validateJourneySpec(intent, { phase: 'intent' })).toEqual({ valid: true, errors: [] });
    expect(validateJourneySpec(intent).valid).toBe(false);
  });

  it('validates dataset and template provenance as one traceable pair', () => {
    const result = validateJourneySpec({
      ...cityBreakSpec,
      knowledgeContext: {
        datasetKey: 'thailand-core',
        datasetVersion: '2026.07.16-v1',
        templateKey: 'th-bangkok-long-weekend',
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('JourneySpec knowledgeContext template key and version must be provided together.');
  });

  it('rejects conflicting avoid and selected roles', () => {
    const result = validateJourneySpec({
      ...cityBreakSpec,
      places: [bangkok, { ...bangkok, role: 'avoid', order: 1 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('cannot be both avoided and selected'))).toBe(true);
  });

  it('normalizes stable cache inputs without reordering places', () => {
    const normalized = normalizeJourneySpec({
      ...cityBreakSpec,
      countryCodes: ['th', 'TH'],
      constraints: { ...cityBreakSpec.constraints, transportPreferences: ['walk', 'walk', 'train'] },
      preferences: { ...cityBreakSpec.preferences, interestTags: ['food', ' food ', 'culture'] },
    });
    expect(normalized.countryCodes).toEqual(['TH']);
    expect(normalized.constraints.transportPreferences).toEqual(['walk', 'train']);
    expect(normalized.preferences.interestTags).toEqual(['food', 'culture']);
    expect(normalized.places[0]?.entity.canonicalSlug).toBe('th-bangkok');
  });

  it('adapts legacy country-first input without pretending it is canonical', () => {
    const adapted = buildJourneySpecFromLegacyCreateTrip({
      countries: [{ name: 'Thailand', code: 'TH' }],
      startDate: '2026-12-02',
      endDate: '2026-12-05',
      durationDays: 3,
      resolvedPlaces: [bangkok],
      preferences: {
        routeLock: true,
        transportPreferences: ['train'],
        tripStyleTags: ['food'],
        specificCities: 'Bangkok',
      },
    });

    expect(adapted.journeyType).toBe('city_break');
    expect(adapted.durationDays).toBe(3);
    expect(adapted.places[0]?.entity.resolution).toBe('legacy_unresolved');
    expect(adapted.places[1]?.entity.entityId).toBe(bangkok.entity.entityId);
    expect(adapted.preferences.freeTextPlaceRequest).toBe('Bangkok');
    expect(adapted.constraints.routeLocked).toBe(true);
    expect(validateJourneySpec(adapted).valid).toBe(true);
  });
});
