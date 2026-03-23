import { describe, expect, it } from 'vitest';
import {
  clampNearbyAirportLimit,
  computeAirDistanceKm,
  findNearestCommercialAirports,
  getAirportByCode,
  inferCommercialServiceTier,
  normalizeAirportSnapshot,
  type AirportReference,
} from '../../shared/airportReference';

const SAMPLE_AIRPORTS: AirportReference[] = [
  {
    ident: 'EDDB',
    iataCode: 'BER',
    icaoCode: 'EDDB',
    name: 'Berlin Brandenburg Airport',
    municipality: 'Berlin',
    subdivisionName: 'Berlin',
    regionCode: 'DE-BE',
    countryCode: 'DE',
    countryName: 'Germany',
    latitude: 52.362247,
    longitude: 13.500672,
    timezone: 'Europe/Berlin',
    airportType: 'large_airport',
    scheduledService: true,
    isCommercial: true,
    commercialServiceTier: inferCommercialServiceTier('large_airport'),
    isMajorCommercial: true,
  },
  {
    ident: 'EDDH',
    iataCode: 'HAM',
    icaoCode: 'EDDH',
    name: 'Hamburg Airport',
    municipality: 'Hamburg',
    subdivisionName: 'Hamburg',
    regionCode: 'DE-HH',
    countryCode: 'DE',
    countryName: 'Germany',
    latitude: 53.630402,
    longitude: 9.988228,
    timezone: 'Europe/Berlin',
    airportType: 'large_airport',
    scheduledService: true,
    isCommercial: true,
    commercialServiceTier: inferCommercialServiceTier('large_airport'),
    isMajorCommercial: true,
  },
  {
    ident: 'EDAZ',
    iataCode: null,
    icaoCode: 'EDAZ',
    name: 'Schonhagen Airport',
    municipality: 'Trebbin',
    subdivisionName: 'Brandenburg',
    regionCode: 'DE-BB',
    countryCode: 'DE',
    countryName: 'Germany',
    latitude: 52.203056,
    longitude: 13.156389,
    timezone: 'Europe/Berlin',
    airportType: 'small_airport',
    scheduledService: true,
    isCommercial: true,
    commercialServiceTier: inferCommercialServiceTier('small_airport'),
    isMajorCommercial: false,
  },
  {
    ident: 'EPSC',
    iataCode: 'SZZ',
    icaoCode: 'EPSC',
    name: 'Solidarity Szczecin-Goleniow Airport',
    municipality: 'Szczecin',
    subdivisionName: 'West Pomeranian',
    regionCode: 'PL-ZP',
    countryCode: 'PL',
    countryName: 'Poland',
    latitude: 53.584731,
    longitude: 14.902206,
    timezone: 'Europe/Warsaw',
    airportType: 'medium_airport',
    scheduledService: true,
    isCommercial: true,
    commercialServiceTier: inferCommercialServiceTier('medium_airport'),
    isMajorCommercial: false,
  },
];

describe('shared/airportReference', () => {
  it('computes a sensible great-circle distance', () => {
    const distance = computeAirDistanceKm(
      { lat: 52.52, lng: 13.405 },
      { lat: 48.8566, lng: 2.3522 },
    );

    expect(distance).toBeGreaterThan(850);
    expect(distance).toBeLessThan(900);
  });

  it('finds airports by IATA, ICAO, or ident case-insensitively', () => {
    expect(getAirportByCode(SAMPLE_AIRPORTS, 'ber')?.ident).toBe('EDDB');
    expect(getAirportByCode(SAMPLE_AIRPORTS, 'eddh')?.iataCode).toBe('HAM');
    expect(getAirportByCode(SAMPLE_AIRPORTS, 'EDAZ')?.name).toContain('Schonhagen');
    expect(getAirportByCode(SAMPLE_AIRPORTS, 'missing')).toBeNull();
  });

  it('sorts nearby airports by air distance and clamps the limit', () => {
    const nearby = findNearestCommercialAirports({
      lat: 52.52,
      lng: 13.405,
      airports: SAMPLE_AIRPORTS,
      limit: 99,
    });

    expect(nearby).toHaveLength(4);
    expect(nearby[0].airport.ident).toBe('EDDB');
    expect(nearby[0].rank).toBe(1);
    expect(nearby[1].airDistanceKm).toBeLessThan(nearby[3].airDistanceKm);
  });

  it('filters nearby airports by minimum commercial service tier', () => {
    const nearby = findNearestCommercialAirports({
      lat: 52.52,
      lng: 13.405,
      airports: SAMPLE_AIRPORTS,
      minimumServiceTier: 'regional',
    });

    expect(nearby).toHaveLength(3);
    expect(nearby.every((entry) => entry.airport.commercialServiceTier !== 'local')).toBe(true);
  });

  it('can scope nearby-airport results to one country', () => {
    const nearby = findNearestCommercialAirports({
      lat: 52.52,
      lng: 13.405,
      airports: SAMPLE_AIRPORTS,
      countryCode: 'PL',
    });

    expect(nearby).toHaveLength(1);
    expect(nearby[0].airport.countryCode).toBe('PL');
  });

  it('normalizes airport snapshots and drops invalid rows', () => {
    const airports = normalizeAirportSnapshot([
      SAMPLE_AIRPORTS[1],
      {
        ident: 'bad',
        countryCode: 'DE',
      },
      SAMPLE_AIRPORTS[0],
    ]);

    expect(airports.map((airport) => airport.ident)).toEqual(['EDDB', 'EDDH']);
  });

  it('clamps invalid limits to the supported range', () => {
    expect(clampNearbyAirportLimit(undefined)).toBe(10);
    expect(clampNearbyAirportLimit(-5)).toBe(1);
    expect(clampNearbyAirportLimit(999)).toBe(10);
  });
});
