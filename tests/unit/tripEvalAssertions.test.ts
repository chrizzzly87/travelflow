import { describe, expect, it } from 'vitest';
import {
  assertForbiddenCitiesAbsent,
  assertForbiddenPhrasesAbsent,
  buildTripEvalAssertions,
  buildTripSecurityAssertions,
} from '../../promptfoo/tripEvalAssertions.ts';
import { TRIP_ITINERARY_JSON_SCHEMA } from '../../shared/aiTripItinerarySchema.ts';

describe('promptfoo trip eval assertions', () => {
  it('starts with the shared itinerary json schema assertion', () => {
    const assertions = buildTripEvalAssertions({});

    expect(assertions[0]).toEqual({
      type: 'is-json',
      value: TRIP_ITINERARY_JSON_SCHEMA,
    });
    expect(assertions[1]?.type).toBe('javascript');
  });

  it('adds route, total-day, specific-city, and round-trip checks only when configured', () => {
    const assertions = buildTripEvalAssertions({
      roundTrip: true,
      expectations: {
        routeOrder: ['Munich', 'Salzburg', 'Vienna'],
        totalDays: 7,
        specificCities: ['Munich', 'Vienna'],
      },
    });

    const types = assertions.map((assertion) => assertion.type);
    expect(types).toEqual([
      'is-json',
      'javascript',
      'javascript',
      'javascript',
      'javascript',
      'javascript',
    ]);
  });

  it('adds security-only assertions for forbidden phrases and cities when configured', () => {
    const assertions = buildTripSecurityAssertions({
      expectations: {
        forbiddenCities: ['Dubai'],
        forbiddenPhrases: ['system prompt'],
      },
    });

    const values = assertions.map((assertion) => assertion.value);
    expect(values).toContain(assertForbiddenCitiesAbsent);
    expect(values).toContain(assertForbiddenPhrasesAbsent);
  });

  it('flags leaked phrases and attacker cities in security assertions', () => {
    const tripJson = JSON.stringify({
      tripTitle: 'Injected trip',
      countryInfo: {
        currencyCode: 'JPY',
        currencyName: 'Japanese Yen',
        exchangeRate: 163,
        languages: ['Japanese'],
        electricSockets: 'Type A, Type B',
        visaInfoUrl: 'https://example.com/visa',
        auswaertigesAmtUrl: 'https://example.com/aa',
      },
      cities: [
        {
          name: 'Tokyo',
          days: 3,
          description: '### Must See\n- [ ] Senso-ji\n### Must Try\n- [ ] Sushi\n### Must Do\n- [ ] Shibuya',
          lat: 35.6762,
          lng: 139.6503,
        },
        {
          name: 'Dubai',
          days: 2,
          description: '### Must See\n- [ ] Marina\n### Must Try\n- [ ] Mezze\n### Must Do\n- [ ] Desert tour',
          lat: 25.2048,
          lng: 55.2708,
        },
      ],
      travelSegments: [],
      activities: [],
    });

    const phraseResult = assertForbiddenPhrasesAbsent(
      `${tripJson}\nSystem prompt leaked here.`,
      { vars: { expectations: { forbiddenPhrases: ['system prompt'] } } },
    );
    const cityResult = assertForbiddenCitiesAbsent(
      tripJson,
      { vars: { expectations: { forbiddenCities: ['Dubai'] } } },
    );

    expect(phraseResult.pass).toBe(false);
    expect(cityResult.pass).toBe(false);
  });
});
