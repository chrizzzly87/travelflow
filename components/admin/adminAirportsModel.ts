import type { AdminAirportBulkUpdatePatch } from '../../services/adminService';
import type { AirportReference } from '../../shared/airportReference';

/**
 * Pure state for Admin → Airports: which tab a URL opens, what a bulk edit
 * sends, and how an airport is labelled. Tested in
 * `tests/unit/adminAirportsModel.test.ts`.
 */

export type AdminAirportsTab = 'catalog' | 'tester' | 'ticket';

export const ADMIN_AIRPORTS_TABS: readonly AdminAirportsTab[] = ['catalog', 'tester', 'ticket'];

const NEARBY_TESTER_QUERY_KEYS = [
    'nearbyCity',
    'nearbyLat',
    'nearbyLng',
    'nearbyLimit',
    'nearbyTier',
    'nearbyCountry',
    'nearbySameCountry',
    'nearbyLookup',
] as const;

type SearchParamsLike = Pick<URLSearchParams, 'get'>;

export const hasNearbyTesterQueryState = (searchParams: SearchParamsLike): boolean => (
    NEARBY_TESTER_QUERY_KEYS.some((key) => Boolean(searchParams.get(key)?.trim()))
);

/**
 * `?tab=` wins. Links shared before the page had tabs carry only `nearby*`
 * parameters; those still open the tester they were pointing at.
 */
export const resolveAdminAirportsTab = (searchParams: SearchParamsLike): AdminAirportsTab => {
    const tab = searchParams.get('tab');
    if (tab && (ADMIN_AIRPORTS_TABS as readonly string[]).includes(tab)) return tab as AdminAirportsTab;
    return hasNearbyTesterQueryState(searchParams) ? 'tester' : 'catalog';
};

export type BulkAirportTypeOption = 'leave' | AirportReference['airportType'];
export type BulkScheduledServiceOption = 'leave' | 'enabled' | 'disabled';
export type BulkTimezoneMode = 'leave' | 'set' | 'clear';

export interface AirportBulkEditChoices {
    airportType: BulkAirportTypeOption;
    scheduledService: BulkScheduledServiceOption;
    timezoneMode: BulkTimezoneMode;
    timezoneValue: string;
}

export const EMPTY_AIRPORT_BULK_EDIT: AirportBulkEditChoices = {
    airportType: 'leave',
    scheduledService: 'leave',
    timezoneMode: 'leave',
    timezoneValue: '',
};

/** The patch a bulk edit sends, or null when it would change nothing. */
export const buildAirportBulkPatch = (choices: AirportBulkEditChoices): AdminAirportBulkUpdatePatch | null => {
    const patch: AdminAirportBulkUpdatePatch = {};
    if (choices.airportType !== 'leave') patch.airportType = choices.airportType;
    if (choices.scheduledService !== 'leave') patch.scheduledService = choices.scheduledService === 'enabled';
    if (choices.timezoneMode === 'set') {
        const timezone = choices.timezoneValue.trim();
        if (!timezone) return null;
        patch.timezone = timezone;
    }
    if (choices.timezoneMode === 'clear') patch.timezone = null;
    return Object.keys(patch).length > 0 ? patch : null;
};

export const summarizeAirportServiceTiers = (airports: readonly AirportReference[]): { major: number; regional: number; local: number } => {
    const summary = { major: 0, regional: 0, local: 0 };
    airports.forEach((airport) => {
        if (airport.commercialServiceTier === 'major') summary.major += 1;
        else if (airport.commercialServiceTier === 'regional') summary.regional += 1;
        else summary.local += 1;
    });
    return summary;
};

/** "BER · EDDB" — the codes an admin scans for, deduplicated. */
export const formatAirportCodes = (airport: Pick<AirportReference, 'iataCode' | 'icaoCode' | 'ident'>): string => {
    const codes = [airport.iataCode, airport.icaoCode || airport.ident].filter((code): code is string => Boolean(code));
    return Array.from(new Set(codes)).join(' · ');
};
