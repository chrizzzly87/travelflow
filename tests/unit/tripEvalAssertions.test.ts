import { describe, expect, it } from 'vitest';
import { buildTripEvalAssertions } from '../../promptfoo/tripEvalAssertions.ts';
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
});
