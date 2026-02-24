// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  readTripManagerCountryCache,
  writeTripManagerCountryCache,
} from '../../components/TripManager';

const COUNTRY_CACHE_KEY = 'travelflow_country_cache_v1';

describe('components/TripManager country cache helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns empty cache when storage is missing', () => {
    expect(readTripManagerCountryCache()).toEqual({});
  });

  it('reads and writes country cache payloads', () => {
    writeTripManagerCountryCache({
      '1.0000,2.0000': {
        countryCode: 'de',
        countryName: 'Germany',
      },
    });

    expect(window.localStorage.getItem(COUNTRY_CACHE_KEY)).toBe(JSON.stringify({
      '1.0000,2.0000': {
        countryCode: 'de',
        countryName: 'Germany',
      },
    }));
    expect(readTripManagerCountryCache()).toEqual({
      '1.0000,2.0000': {
        countryCode: 'de',
        countryName: 'Germany',
      },
    });
  });

  it('returns empty cache for malformed payloads', () => {
    window.localStorage.setItem(COUNTRY_CACHE_KEY, '{invalid-json');
    expect(readTripManagerCountryCache()).toEqual({});
  });
});
