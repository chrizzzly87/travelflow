import { describe, expect, it } from 'vitest';

import { parseAiTripCityLocation } from '../../shared/aiTripCityLocation';

describe('shared/aiTripCityLocation', () => {
  it('normalizes response location metadata for persistence', () => {
    expect(parseAiTripCityLocation({
      name: ' Madrid ',
      description: ' Capital stop ',
      countryName: ' Spain ',
      countryCode: 'es',
      lat: '40.4168',
      lng: -3.7038,
    }, 'Fallback')).toEqual({
      name: 'Madrid',
      description: 'Capital stop',
      countryName: 'Spain',
      countryCode: 'ES',
      coordinates: { lat: 40.4168, lng: -3.7038 },
    });
  });

  it('does not persist invalid coordinates or country codes', () => {
    expect(parseAiTripCityLocation({
      name: '',
      countryName: 'Spain',
      countryCode: 'ESP',
      lat: 400,
      lng: -3.7038,
    }, 'Madrid')).toEqual({
      name: 'Madrid',
      description: '',
      countryName: 'Spain',
      countryCode: undefined,
      coordinates: undefined,
    });
  });
});
