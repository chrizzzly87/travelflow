import { describe, expect, it } from 'vitest';
import type { AirportReference } from '../../shared/airportReference';
import { buildFakeAirportTicket } from '../../shared/fakeAirportTicket';

const buildAirport = (overrides?: Partial<AirportReference>): AirportReference => ({
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
  commercialServiceTier: 'major',
  isMajorCommercial: true,
  ...overrides,
});

describe('buildFakeAirportTicket', () => {
  it('creates a deterministic fake airport ticket from the selected airports', () => {
    const ticket = buildFakeAirportTicket({
      passengerName: 'Alex Morgan',
      departureAirport: buildAirport(),
      arrivalAirport: buildAirport({
        ident: 'KJFK',
        iataCode: 'JFK',
        icaoCode: 'KJFK',
        name: 'John F. Kennedy International Airport',
        municipality: 'New York',
        subdivisionName: 'New York',
        regionCode: 'US-NY',
        countryCode: 'US',
        countryName: 'United States',
        latitude: 40.6413,
        longitude: -73.7781,
        timezone: 'America/New_York',
      }),
      departureDate: '2026-04-03',
      cabinClass: 'business',
      originLabel: 'Berlin, Germany',
      airportAccessDistanceKm: 18.4,
    });

    expect(ticket).toMatchObject({
      passengerName: 'Alex Morgan',
      airlineName: 'TravelFlow Air',
      departureDateLabel: 'Fri, Apr 3, 2026',
      cabinClass: 'business',
      airportAccessDistanceKm: 18.4,
      originLabel: 'Berlin, Germany',
      departureAirport: expect.objectContaining({ ident: 'EDDB' }),
      arrivalAirport: expect.objectContaining({ ident: 'KJFK' }),
    });
    expect(ticket.flightNumber).toMatch(/^[A-Z0-9]{2}\d{3}$/);
    expect(ticket.bookingReference).toMatch(/^[A-Z0-9]{6}$/);
    expect(ticket.ticketNumber).toMatch(/^016-\d{4}-\d{6}$/);
    expect(ticket.seat).toMatch(/^\d+[A-F]$/);
    expect(ticket.gate).toMatch(/^[A-E]\d+$/);
    expect(ticket.routeDistanceKm).toBeGreaterThan(6000);
  });

  it('falls back to a stable traveler label when the passenger name is empty', () => {
    const ticket = buildFakeAirportTicket({
      passengerName: '   ',
      departureAirport: buildAirport(),
      arrivalAirport: buildAirport({
        ident: 'EHAM',
        iataCode: 'AMS',
        icaoCode: 'EHAM',
        name: 'Amsterdam Airport Schiphol',
        municipality: 'Amsterdam',
        subdivisionName: 'North Holland',
        regionCode: 'NL-NH',
        countryCode: 'NL',
        countryName: 'Netherlands',
        latitude: 52.310538,
        longitude: 4.768274,
        timezone: 'Europe/Amsterdam',
      }),
      departureDate: '2026-04-04',
      cabinClass: 'economy',
    });

    expect(ticket.passengerName).toBe('Traveler');
    expect(ticket.airportAccessDistanceKm).toBeNull();
    expect(ticket.originLabel).toBeNull();
  });
});
