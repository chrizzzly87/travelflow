import { describe, expect, it } from 'vitest';

import { mapSearchByTextResponseToCitySuggestions } from '../../shared/cityLookup';

describe('shared/cityLookup', () => {
  it('maps search-by-text responses to normalized city suggestions', () => {
    const suggestions = mapSearchByTextResponseToCitySuggestions({
      places: [
        {
          id: 'city-1',
          displayName: { text: 'Hoi An' },
          formattedAddress: 'Hoi An, Quang Nam, Vietnam',
          location: {
            lat: () => 15.8801,
            lng: () => 108.338,
          },
          addressComponents: [
            { types: ['country'], longText: 'Vietnam', shortText: 'VN' },
          ],
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: 'city-1',
        name: 'Hoi An',
        label: 'Hoi An, Quang Nam, Vietnam',
        coordinates: { lat: 15.8801, lng: 108.338 },
        countryName: 'Vietnam',
        countryCode: 'VN',
      },
    ]);
  });

  it('deduplicates repeated suggestions', () => {
    const suggestions = mapSearchByTextResponseToCitySuggestions({
      places: [
        {
          id: 'city-a',
          displayName: 'Kabul',
          formattedAddress: 'Kabul, Afghanistan',
          location: { lat: 34.555304, lng: 69.207504 },
        },
        {
          id: 'city-b',
          displayName: 'Kabul',
          formattedAddress: 'Kabul, Afghanistan',
          location: { lat: 34.555301, lng: 69.207501 },
        },
      ],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.name).toBe('Kabul');
  });
});
