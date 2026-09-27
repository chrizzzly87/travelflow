import { describe, expect, it } from 'vitest';

import { buildModelActivityPlacementFields } from '../../shared/aiTripActivityPlacement.ts';
import {
  TRIP_ITINERARY_COMPACT_JSON_SCHEMA,
  TRIP_ITINERARY_JSON_SCHEMA,
  createGeminiTripItineraryResponseSchema,
} from '../../shared/aiTripItinerarySchema.ts';

const stay = { id: 'city-0-1', name: 'Lisbon' };

describe('buildModelActivityPlacementFields', () => {
  it('ties every generated activity to the stay it was generated for', () => {
    expect(buildModelActivityPlacementFields({ title: 'Tram 28' }, stay)).toEqual({
      location: 'Lisbon',
      stayCityId: 'city-0-1',
    });
  });

  it('turns a prepared day trip into a day-trip activity at its destination', () => {
    expect(buildModelActivityPlacementFields({
      isDayTrip: true,
      destination: 'Sintra',
      lat: 38.7981,
      lng: -9.388,
    }, stay)).toEqual({
      location: 'Sintra',
      stayCityId: 'city-0-1',
      activityKind: 'day-trip',
      coordinates: { lat: 38.7981, lng: -9.388 },
      coordinatesSource: 'ai',
    });
  });

  it('falls back to a regular activity when the position is unusable', () => {
    expect(buildModelActivityPlacementFields({ isDayTrip: true, destination: 'Sintra', lat: 120, lng: 0 }, stay))
      .toEqual({ location: 'Lisbon', stayCityId: 'city-0-1' });
  });
});

describe('itinerary schemas', () => {
  it('ask every provider for day trips as their own list', () => {
    expect(TRIP_ITINERARY_JSON_SCHEMA.required).toContain('dayTrips');
    expect(JSON.stringify(TRIP_ITINERARY_COMPACT_JSON_SCHEMA)).toContain('"dayTrips"');
    const gemini = createGeminiTripItineraryResponseSchema({ OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', NUMBER: 'NUMBER' });
    expect(gemini.required).toContain('dayTrips');
    expect(gemini.properties.dayTrips.items.required).toEqual(
      ['title', 'cityIndex', 'dayOffsetInCity', 'duration', 'destination', 'lat', 'lng', 'description', 'activityTypes'],
    );
  });
});
