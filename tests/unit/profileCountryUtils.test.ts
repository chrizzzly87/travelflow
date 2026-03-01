import { describe, expect, it } from 'vitest';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';
import { collectVisitedCountries } from '../../components/profile/profileCountryUtils';

describe('components/profile/profileCountryUtils', () => {
  it('collects unique visited countries and resolves flag codes', () => {
    const trips = [
      makeTrip({
        id: 'trip-1',
        items: [
          { ...makeCityItem({ id: 'city-1', title: 'Berlin', startDateOffset: 0, duration: 2 }), countryName: 'Germany' },
          { ...makeCityItem({ id: 'city-2', title: 'Paris', startDateOffset: 2, duration: 2 }), countryName: 'France' },
        ],
      }),
      makeTrip({
        id: 'trip-2',
        items: [
          { ...makeCityItem({ id: 'city-3', title: 'Munich', startDateOffset: 0, duration: 2 }), countryName: 'Germany' },
          { ...makeCityItem({ id: 'city-4', title: 'Atlantis', startDateOffset: 2, duration: 2 }), countryName: 'Atlantis' },
        ],
      }),
    ];

    expect(collectVisitedCountries(trips)).toEqual([
      { name: 'Atlantis', code: null },
      { name: 'France', code: 'FR' },
      { name: 'Germany', code: 'DE' },
    ]);
  });
});
