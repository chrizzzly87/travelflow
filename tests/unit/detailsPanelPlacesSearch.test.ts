import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapSearchByTextPlacesToHotelResults } from '../../components/DetailsPanel';

describe('components/DetailsPanel places migration', () => {
  it('maps Place.searchByText results into hotel result rows', () => {
    const results = mapSearchByTextPlacesToHotelResults({
      places: [
        {
          id: 'abc123',
          displayName: { text: 'Riverside Hotel' },
          formattedAddress: '1 River Rd, City',
        },
        {
          id: 'def456',
          displayName: 'Old Town Inn',
          formattedAddress: '2 Old Town, City',
        },
      ],
    });

    expect(results).toEqual([
      { id: 'abc123', name: 'Riverside Hotel', address: '1 River Rd, City' },
      { id: 'def456', name: 'Old Town Inn', address: '2 Old Town, City' },
    ]);
  });

  it('does not use deprecated google.maps.places.PlacesService in DetailsPanel', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'components/DetailsPanel.tsx'),
      'utf8'
    );

    expect(source).not.toContain('google.maps.places.PlacesService');
    expect(source).not.toContain('google.maps.places.Autocomplete');
    expect(source).toContain('Place?.searchByText');
  });
});
