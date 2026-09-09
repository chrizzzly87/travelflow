import { describe, expect, it } from 'vitest';
import type { AirportReference, NearbyAirportsResponse } from '../../shared/airportReference';
import { resolveMapRuntime } from '../../shared/mapRuntime';
import {
  AIRPORT_TESTER_ORIGIN_POINT_ID,
  buildAirportTesterDetailRows,
  buildAirportTesterDetailTitle,
  buildAirportTesterPillHtml,
  buildAirportTesterPoints,
  resolveAirportTesterRenderer,
  type AirportTesterOrigin,
} from '../../components/admin/airportTesterMapModel';

const buildAirport = (overrides: Partial<AirportReference> = {}): AirportReference => ({
  ident: 'EDDB',
  iataCode: 'BER',
  icaoCode: 'EDDB',
  name: 'Berlin Brandenburg Airport',
  municipality: 'Berlin',
  subdivisionName: 'Brandenburg',
  regionCode: 'DE-BB',
  countryCode: 'DE',
  countryName: 'Germany',
  latitude: 52.3667,
  longitude: 13.5033,
  timezone: 'Europe/Berlin',
  airportType: 'large_airport',
  scheduledService: true,
  isCommercial: true,
  commercialServiceTier: 'major',
  isMajorCommercial: true,
  ...overrides,
});

const origin: AirportTesterOrigin = {
  label: 'Berlin, Germany',
  lat: 52.52,
  lng: 13.405,
  countryCode: 'DE',
  countryName: 'Germany',
};

const buildResult = (airports: NearbyAirportsResponse['airports']): NearbyAirportsResponse => ({
  origin: { lat: origin.lat, lng: origin.lng },
  airports,
  dataVersion: '2026-01-01',
});

const buildRuntime = (renderer: 'google' | 'mapbox') => resolveMapRuntime({
  defaultPreset: renderer === 'mapbox' ? 'mapbox_visual_google_services' : 'google_all',
  availability: {
    googleMapsKeyAvailable: true,
    mapboxAccessTokenAvailable: renderer === 'mapbox',
  },
});

describe('airport tester renderer resolution', () => {
  it('uses Mapbox when the runtime renderer is Mapbox and a token shipped', () => {
    expect(resolveAirportTesterRenderer({
      runtime: buildRuntime('mapbox'),
      mapboxAccessToken: 'pk.test-token',
    })).toBe('mapbox');
  });

  it('falls back to Google when the Mapbox renderer has no usable token', () => {
    expect(resolveAirportTesterRenderer({
      runtime: buildRuntime('mapbox'),
      mapboxAccessToken: '   ',
    })).toBe('google');
  });

  it('stays on Google when the runtime asks for the Google renderer', () => {
    expect(resolveAirportTesterRenderer({
      runtime: buildRuntime('google'),
      mapboxAccessToken: 'pk.test-token',
    })).toBe('google');
  });
});

describe('airport tester map points', () => {
  it('puts the origin first and keeps every ranked airport', () => {
    const points = buildAirportTesterPoints({
      origin,
      result: buildResult([
        { airport: buildAirport(), airDistanceKm: 18.4, rank: 1 },
        { airport: buildAirport({ ident: 'EDDT', iataCode: 'TXL', name: 'Berlin Tegel' }), airDistanceKm: 8.2, rank: 2 },
      ]),
    });

    expect(points.map((point) => point.id)).toEqual([
      AIRPORT_TESTER_ORIGIN_POINT_ID,
      'airport:EDDB:1',
      'airport:EDDT:2',
    ]);
    expect(points[0].kind).toBe('origin');
    expect(points[1].label).toBe('BER');
    expect(points[1].airDistanceKm).toBe(18.4);
  });

  it('falls back from IATA to ICAO to ident for the pill label', () => {
    const points = buildAirportTesterPoints({
      origin: null,
      result: buildResult([
        { airport: buildAirport({ iataCode: null }), airDistanceKm: 1, rank: 1 },
        { airport: buildAirport({ ident: 'XXXX', iataCode: null, icaoCode: null }), airDistanceKm: 2, rank: 2 },
      ]),
    });

    expect(points.map((point) => point.label)).toEqual(['EDDB', 'XXXX']);
  });

  it('returns an empty list without an origin or a result', () => {
    expect(buildAirportTesterPoints({ origin: null, result: null })).toEqual([]);
  });
});

describe('airport tester pill markup', () => {
  it('marks the selected airport pill with the accent fill', () => {
    const [point] = buildAirportTesterPoints({
      origin: null,
      result: buildResult([{ airport: buildAirport(), airDistanceKm: 5, rank: 1 }]),
    });

    expect(buildAirportTesterPillHtml({ point, selected: true })).toContain('background:#2563eb');
    expect(buildAirportTesterPillHtml({ point, selected: false })).toContain('background:#ffffff');
  });

  it('escapes airport labels so catalog data cannot inject markup', () => {
    const [point] = buildAirportTesterPoints({
      origin: null,
      result: buildResult([{
        airport: buildAirport({ iataCode: null, icaoCode: null, ident: '<img src=x onerror=alert(1)>' }),
        airDistanceKm: 5,
        rank: 1,
      }]),
    });

    const html = buildAirportTesterPillHtml({ point, selected: false });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('airport tester detail card content', () => {
  it('lists the full airport record for an airport pill', () => {
    const [point] = buildAirportTesterPoints({
      origin: null,
      result: buildResult([{ airport: buildAirport(), airDistanceKm: 18.42, rank: 3 }]),
    });

    const rows = buildAirportTesterDetailRows(point);
    const values = Object.fromEntries(rows.map((row) => [row.label, row.value]));

    expect(buildAirportTesterDetailTitle(point)).toBe('3. Berlin Brandenburg Airport');
    expect(values.Codes).toBe('BER · EDDB · EDDB');
    expect(values.Location).toBe('Berlin, Brandenburg, Germany');
    expect(values['Air distance']).toBe('18.4 km');
    expect(values['Service tier']).toBe('Major');
    expect(values['Airport type']).toBe('Large');
    expect(values['Scheduled service']).toBe('Yes');
    expect(values.Timezone).toBe('Europe/Berlin');
    expect(values.Coordinates).toBe('52.36670, 13.50330');
  });

  it('rounds long distances to whole kilometres', () => {
    const [point] = buildAirportTesterPoints({
      origin: null,
      result: buildResult([{ airport: buildAirport(), airDistanceKm: 412.63, rank: 1 }]),
    });

    const rows = buildAirportTesterDetailRows(point);
    expect(rows.find((row) => row.label === 'Air distance')?.value).toBe('413 km');
  });

  it('describes the origin pill with its own coordinates and country', () => {
    const [point] = buildAirportTesterPoints({ origin, result: null });

    expect(buildAirportTesterDetailTitle(point)).toBe('Berlin, Germany');
    expect(buildAirportTesterDetailRows(point)).toEqual([
      { label: 'Coordinates', value: '52.52000, 13.40500' },
      { label: 'Country', value: 'Germany · DE' },
    ]);
  });
});
