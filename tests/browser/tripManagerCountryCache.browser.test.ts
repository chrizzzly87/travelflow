// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  readTripManagerCountryCache,
  shouldAttemptTripManagerReverseGeocode,
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

  it('guards reverse geocoding behind finite coordinates and lookup budget', () => {
    expect(shouldAttemptTripManagerReverseGeocode(
      { coordinates: { lat: 53.55, lng: 9.99 } },
      false,
      2,
    )).toBe(true);

    expect(shouldAttemptTripManagerReverseGeocode(
      { coordinates: { lat: 53.55, lng: 9.99 } },
      true,
      2,
    )).toBe(false);

    expect(shouldAttemptTripManagerReverseGeocode(
      { coordinates: { lat: Number.NaN, lng: 9.99 } },
      false,
      2,
    )).toBe(false);

    expect(shouldAttemptTripManagerReverseGeocode(
      { coordinates: { lat: 53.55, lng: 9.99 } },
      false,
      0,
    )).toBe(false);
  });
});
