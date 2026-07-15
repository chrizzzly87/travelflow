import { describe, expect, it } from 'vitest';

import {
  buildCityForwardGeocodeQueries,
  mergeCityGeocodeLocation,
} from '../../scripts/enrich-trip-city-locations';

describe('trip city location backfill', () => {
  it('uses trip destination context before an ambiguous bare city name', () => {
    const city = { type: 'city', title: 'Valencia', location: 'Valencia' };
    const trip = {
      items: [city],
      aiMeta: {
        generation: {
          inputSnapshot: {
            destinationLabel: 'Spain',
            payload: { options: { countries: ['Spain'] } },
          },
        },
      },
    };

    expect(buildCityForwardGeocodeQueries(city, trip)).toEqual([
      'Valencia, Spain',
      'Valencia',
    ]);
  });

  it('adds missing coordinates and canonical country metadata without changing other fields', () => {
    expect(mergeCityGeocodeLocation({
      id: 'city-1',
      type: 'city',
      title: 'Malaga',
      duration: 2,
    }, {
      coordinates: { lat: 36.7213, lng: -4.4214 },
      countryName: 'Spain',
      countryCode: 'ES',
    })).toEqual({
      id: 'city-1',
      type: 'city',
      title: 'Malaga',
      duration: 2,
      coordinates: { lat: 36.7213, lng: -4.4214 },
      countryName: 'Spain',
      countryCode: 'ES',
    });
  });
});
