/**
 * Great-circle distance between a traveller's approximate origin and a country.
 *
 * Two honesty rules are baked into the API rather than left to the UI:
 *  - every result is a **straight-line** distance, never a travel/flight distance, so the
 *    accessor is named `...DistanceKm` and the UI is expected to say so;
 *  - a country we cannot place returns `undefined` instead of a plausible-looking number, so a
 *    missing anchor can never silently reorder the list.
 *
 * Anchors come from `data/countryAnchors.generated.json`, which prefers the climate-normals
 * anchor for a country so this feature and `docs/COUNTRY_CLIMATE_DATA.md` agree on where a
 * country "is". Everything here is pure and synchronous — no React, no network.
 */

import countryAnchorData from '../data/countryAnchors.generated.json';

export type CountryAnchorDerivation = 'climate-normals' | 'airport-medoid';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface CountryAnchor extends GeoPoint {
  countryCode: string;
  /** Human-readable place the anchor sits at, e.g. `Bangkok (BKK)`. Safe to show to users. */
  label: string;
  derivation: CountryAnchorDerivation;
}

/** IUGG mean Earth radius. */
export const EARTH_MEAN_RADIUS_KM = 6371.0088;

/** Half the Earth's circumference — the largest distance the haversine formula can return. */
export const MAX_GREAT_CIRCLE_DISTANCE_KM = Math.PI * EARTH_MEAN_RADIUS_KM;

interface CountryAnchorDocument {
  schemaVersion: number;
  generatedAt: string;
  anchors: CountryAnchor[];
}

const anchorDocument = countryAnchorData as unknown as CountryAnchorDocument;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

export const isValidGeoPoint = (value: unknown): value is GeoPoint => {
  if (!value || typeof value !== 'object') return false;
  const { latitude, longitude } = value as Partial<GeoPoint>;
  return isFiniteNumber(latitude)
    && isFiniteNumber(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
};

const normalizeCountryCode = (countryCode: unknown): string | undefined => {
  if (typeof countryCode !== 'string') return undefined;
  const normalized = countryCode.trim().toUpperCase();
  return normalized.length === 2 ? normalized : undefined;
};

/**
 * Haversine great-circle distance in kilometres.
 *
 * Returns `undefined` for input that is not a usable coordinate pair, so callers never have to
 * distinguish "0 km away" from "we don't know".
 */
export const greatCircleDistanceKm = (from: unknown, to: unknown): number | undefined => {
  if (!isValidGeoPoint(from) || !isValidGeoPoint(to)) return undefined;

  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const halfChord = (Math.sin(deltaLatitude / 2) ** 2)
    + (
      Math.cos(toRadians(from.latitude))
      * Math.cos(toRadians(to.latitude))
      * (Math.sin(deltaLongitude / 2) ** 2)
    );

  // Clamping guards the floating-point overshoot that makes `asin` return NaN for antipodes.
  return 2 * EARTH_MEAN_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(halfChord)));
};

const anchorIndex: Map<string, CountryAnchor> = (() => {
  const index = new Map<string, CountryAnchor>();
  const anchors = Array.isArray(anchorDocument?.anchors) ? anchorDocument.anchors : [];
  anchors.forEach((anchor) => {
    const code = normalizeCountryCode(anchor?.countryCode);
    if (!code || !isValidGeoPoint(anchor)) return;
    index.set(code, { ...anchor, countryCode: code });
  });
  return index;
})();

/** Representative coordinate for a country, or `undefined` when we cannot place it. */
export const getCountryAnchor = (countryCode: string | null | undefined): CountryAnchor | undefined => {
  const code = normalizeCountryCode(countryCode);
  return code ? anchorIndex.get(code) : undefined;
};

export const listCountryAnchors = (): CountryAnchor[] => Array.from(anchorIndex.values());

/** Straight-line distance from `origin` to a country's anchor, or `undefined` if unknown. */
export const getCountryDistanceKm = (
  countryCode: string | null | undefined,
  origin: unknown,
): number | undefined => {
  const anchor = getCountryAnchor(countryCode);
  if (!anchor) return undefined;
  return greatCircleDistanceKm(origin, anchor);
};

/**
 * Distance lookup for a set of countries. Countries without an anchor are simply absent from the
 * map — callers sort them last rather than guessing a distance for them.
 */
export const buildCountryDistanceIndex = (
  countryCodes: Iterable<string>,
  origin: unknown,
): Map<string, number> => {
  const index = new Map<string, number>();
  if (!isValidGeoPoint(origin)) return index;

  for (const countryCode of countryCodes) {
    const code = normalizeCountryCode(countryCode);
    if (!code || index.has(code)) continue;
    const distance = getCountryDistanceKm(code, origin);
    if (distance !== undefined) index.set(code, distance);
  }

  return index;
};

/**
 * Rounds a distance for display: sub-100 km to 10 km, then to whole hundreds up to 1000 km, and
 * to whole 100 km beyond. IP-derived origins are city-level at best, so showing "8,437 km" would
 * imply a precision the input never had.
 */
export const roundDistanceForDisplayKm = (distanceKm: number): number => {
  if (!isFiniteNumber(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm < 100) return Math.round(distanceKm / 10) * 10;
  return Math.round(distanceKm / 100) * 100;
};
