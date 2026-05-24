import { ITimelineItem } from '../types';
import { readLocalStorageItem, writeLocalStorageItem } from '../services/browserStorageService';

export type CountryCacheStore = Record<string, { countryCode: string; countryName: string }>;

const COUNTRY_CACHE_KEY = 'travelflow_country_cache_v1';

export const shouldAttemptTripManagerReverseGeocode = (
  item: Pick<ITimelineItem, 'coordinates'>,
  hasStoredOrParsedCountry: boolean,
  remainingLookups: number
): boolean => {
  if (hasStoredOrParsedCountry) return false;
  if (remainingLookups <= 0) return false;
  if (!item.coordinates) return false;
  return Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng);
};

export const readTripManagerCountryCache = (): CountryCacheStore => {
  const raw = readLocalStorageItem(COUNTRY_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as CountryCacheStore;
  } catch {
    return {};
  }
};

export const writeTripManagerCountryCache = (cache: CountryCacheStore): void => {
  try {
    writeLocalStorageItem(COUNTRY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore cache persistence failures
  }
};
