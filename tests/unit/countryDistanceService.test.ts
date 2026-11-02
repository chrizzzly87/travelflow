import { describe, expect, it } from 'vitest';

import {
  EARTH_MEAN_RADIUS_KM,
  MAX_GREAT_CIRCLE_DISTANCE_KM,
  buildCountryDistanceIndex,
  getCountryAnchor,
  getCountryDistanceKm,
  greatCircleDistanceKm,
  isValidGeoPoint,
  listCountryAnchors,
  roundDistanceForDisplayKm,
} from '../../services/countryDistanceService';

const LONDON = { latitude: 51.5074, longitude: -0.1278 };
const PARIS = { latitude: 48.8566, longitude: 2.3522 };
const QUITO = { latitude: 0, longitude: -78.4678 };

describe('greatCircleDistanceKm', () => {
  it('is zero for a point against itself', () => {
    expect(greatCircleDistanceKm(LONDON, LONDON)).toBe(0);
  });

  it('matches a published city pair to within a kilometre', () => {
    // London–Paris is ~344 km great-circle.
    expect(greatCircleDistanceKm(LONDON, PARIS)).toBeCloseTo(343.6, 0);
  });

  it('measures a quarter of the equator between two equatorial points 90° apart', () => {
    const quarterEquator = (Math.PI / 2) * EARTH_MEAN_RADIUS_KM;
    const distance = greatCircleDistanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 90 },
    );
    expect(distance).toBeCloseTo(quarterEquator, 6);
  });

  it('treats one degree of longitude on the equator as ~111.2 km', () => {
    const distance = greatCircleDistanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );
    expect(distance).toBeCloseTo(111.195, 2);
  });

  it('returns exactly half the circumference for antipodes, without NaN', () => {
    const distance = greatCircleDistanceKm(
      { latitude: 45, longitude: 20 },
      { latitude: -45, longitude: -160 },
    );
    expect(distance).not.toBeNaN();
    expect(distance).toBeCloseTo(MAX_GREAT_CIRCLE_DISTANCE_KM, 6);
  });

  it('never exceeds half the circumference, including at the poles', () => {
    const poleToPole = greatCircleDistanceKm(
      { latitude: 90, longitude: 0 },
      { latitude: -90, longitude: 0 },
    );
    expect(poleToPole).toBeLessThanOrEqual(MAX_GREAT_CIRCLE_DISTANCE_KM + 1e-6);
    expect(poleToPole).toBeCloseTo(MAX_GREAT_CIRCLE_DISTANCE_KM, 6);
  });

  it('is symmetric', () => {
    expect(greatCircleDistanceKm(LONDON, QUITO)).toBeCloseTo(
      greatCircleDistanceKm(QUITO, LONDON) as number,
      9,
    );
  });

  it('crosses the antimeridian by the short way round', () => {
    const distance = greatCircleDistanceKm(
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -179 },
    );
    // Two degrees apart, not 358.
    expect(distance).toBeCloseTo(222.39, 1);
  });

  it('returns undefined rather than a number for unusable input', () => {
    expect(greatCircleDistanceKm(null, LONDON)).toBeUndefined();
    expect(greatCircleDistanceKm(LONDON, undefined)).toBeUndefined();
    expect(greatCircleDistanceKm({ latitude: 91, longitude: 0 }, LONDON)).toBeUndefined();
    expect(greatCircleDistanceKm({ latitude: 0, longitude: 181 }, LONDON)).toBeUndefined();
    expect(greatCircleDistanceKm({ latitude: Number.NaN, longitude: 0 }, LONDON)).toBeUndefined();
    expect(greatCircleDistanceKm('here' as unknown, LONDON)).toBeUndefined();
  });
});

describe('isValidGeoPoint', () => {
  it('accepts the boundary coordinates and rejects everything past them', () => {
    expect(isValidGeoPoint({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidGeoPoint({ latitude: -90, longitude: -180 })).toBe(true);
    expect(isValidGeoPoint({ latitude: -90.1, longitude: 0 })).toBe(false);
    expect(isValidGeoPoint({ latitude: 0 })).toBe(false);
    expect(isValidGeoPoint(null)).toBe(false);
  });
});

describe('country anchors', () => {
  it('ships a usable anchor for every country in the generated dataset', () => {
    const anchors = listCountryAnchors();
    expect(anchors.length).toBeGreaterThan(100);
    anchors.forEach((anchor) => {
      expect(isValidGeoPoint(anchor)).toBe(true);
      expect(anchor.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(anchor.label.length).toBeGreaterThan(0);
    });
  });

  it('places well-known anchors in the right hemisphere', () => {
    const japan = getCountryAnchor('JP');
    expect(japan?.longitude).toBeGreaterThan(120);
    expect(japan?.latitude).toBeGreaterThan(0);

    const newZealand = getCountryAnchor('NZ');
    expect(newZealand?.latitude).toBeLessThan(0);
  });

  it('is case- and whitespace-insensitive, and undefined for anything else', () => {
    expect(getCountryAnchor(' jp ')).toEqual(getCountryAnchor('JP'));
    expect(getCountryAnchor('ZZ')).toBeUndefined();
    expect(getCountryAnchor('JPN')).toBeUndefined();
    expect(getCountryAnchor(null)).toBeUndefined();
  });
});

describe('getCountryDistanceKm', () => {
  it('is undefined for a country we cannot place, never zero', () => {
    expect(getCountryDistanceKm('ZZ', LONDON)).toBeUndefined();
  });

  it('ranks a near neighbour below a far one from the same origin', () => {
    const toFrance = getCountryDistanceKm('FR', LONDON) as number;
    const toJapan = getCountryDistanceKm('JP', LONDON) as number;
    expect(toFrance).toBeLessThan(toJapan);
  });
});

describe('buildCountryDistanceIndex', () => {
  it('is empty when the origin is unusable, so nothing can be sorted by a guess', () => {
    expect(buildCountryDistanceIndex(['FR', 'JP'], null).size).toBe(0);
    expect(buildCountryDistanceIndex(['FR', 'JP'], { latitude: 999, longitude: 0 }).size).toBe(0);
  });

  it('omits countries without an anchor instead of defaulting them', () => {
    const index = buildCountryDistanceIndex(['FR', 'ZZ'], LONDON);
    expect(index.has('FR')).toBe(true);
    expect(index.has('ZZ')).toBe(false);
  });

  it('normalizes codes and tolerates duplicates', () => {
    const index = buildCountryDistanceIndex(['fr', 'FR', ' fr '], LONDON);
    expect(index.size).toBe(1);
    expect(index.get('FR')).toBeGreaterThan(0);
  });
});

describe('roundDistanceForDisplayKm', () => {
  it('rounds to 10 km under 100 km and to 100 km above it', () => {
    expect(roundDistanceForDisplayKm(0)).toBe(0);
    expect(roundDistanceForDisplayKm(43)).toBe(40);
    expect(roundDistanceForDisplayKm(99)).toBe(100);
    expect(roundDistanceForDisplayKm(343.6)).toBe(300);
    expect(roundDistanceForDisplayKm(8437)).toBe(8400);
  });

  it('never emits a negative or NaN display value', () => {
    expect(roundDistanceForDisplayKm(-5)).toBe(0);
    expect(roundDistanceForDisplayKm(Number.NaN)).toBe(0);
  });
});
