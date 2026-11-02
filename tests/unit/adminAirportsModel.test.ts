import { describe, expect, it } from 'vitest';

import {
    buildAirportBulkPatch,
    EMPTY_AIRPORT_BULK_EDIT,
    formatAirportCodes,
    hasNearbyTesterQueryState,
    resolveAdminAirportsTab,
    summarizeAirportServiceTiers,
} from '../../components/admin/adminAirportsModel';
import type { AirportReference } from '../../shared/airportReference';

const params = (query: string) => new URLSearchParams(query);

describe('resolveAdminAirportsTab', () => {
    it('opens the catalog by default', () => {
        expect(resolveAdminAirportsTab(params(''))).toBe('catalog');
        expect(resolveAdminAirportsTab(params('country=DE&catalogTier=major'))).toBe('catalog');
    });

    it('honours an explicit tab and ignores unknown ones', () => {
        expect(resolveAdminAirportsTab(params('tab=ticket'))).toBe('ticket');
        expect(resolveAdminAirportsTab(params('tab=bogus'))).toBe('catalog');
    });

    it('opens the tester for links shared before the page had tabs', () => {
        expect(resolveAdminAirportsTab(params('nearbyLat=52.5&nearbyLng=13.4'))).toBe('tester');
    });

    it('lets an explicit catalog tab win over tester parameters', () => {
        expect(resolveAdminAirportsTab(params('tab=catalog&nearbyLookup=1'))).toBe('catalog');
    });

    it('treats blank tester parameters as absent', () => {
        expect(hasNearbyTesterQueryState(params('nearbyCity=%20'))).toBe(false);
        expect(hasNearbyTesterQueryState(params('nearbySameCountry=1'))).toBe(true);
    });
});

describe('buildAirportBulkPatch', () => {
    it('returns null when nothing would change', () => {
        expect(buildAirportBulkPatch(EMPTY_AIRPORT_BULK_EDIT)).toBeNull();
    });

    it('sends only the fields the admin chose', () => {
        expect(buildAirportBulkPatch({ ...EMPTY_AIRPORT_BULK_EDIT, airportType: 'small_airport', scheduledService: 'disabled' }))
            .toEqual({ airportType: 'small_airport', scheduledService: false });
    });

    it('requires a value to set a timezone, and clears with null', () => {
        expect(buildAirportBulkPatch({ ...EMPTY_AIRPORT_BULK_EDIT, timezoneMode: 'set', timezoneValue: '  ' })).toBeNull();
        expect(buildAirportBulkPatch({ ...EMPTY_AIRPORT_BULK_EDIT, timezoneMode: 'set', timezoneValue: ' Europe/Berlin ' }))
            .toEqual({ timezone: 'Europe/Berlin' });
        expect(buildAirportBulkPatch({ ...EMPTY_AIRPORT_BULK_EDIT, timezoneMode: 'clear' })).toEqual({ timezone: null });
    });
});

describe('airport labels', () => {
    it('shows IATA and ICAO once each, falling back to the ident', () => {
        expect(formatAirportCodes({ iataCode: 'BER', icaoCode: 'EDDB', ident: 'EDDB' })).toBe('BER · EDDB');
        expect(formatAirportCodes({ iataCode: null, icaoCode: null, ident: 'XX01' })).toBe('XX01');
        expect(formatAirportCodes({ iataCode: 'ABC', icaoCode: 'ABC', ident: 'ABC' })).toBe('ABC');
    });

    it('counts selected airports per service tier', () => {
        const airports = [
            { commercialServiceTier: 'major' },
            { commercialServiceTier: 'regional' },
            { commercialServiceTier: 'regional' },
            { commercialServiceTier: 'local' },
        ] as AirportReference[];
        expect(summarizeAirportServiceTiers(airports)).toEqual({ major: 1, regional: 2, local: 1 });
    });
});
