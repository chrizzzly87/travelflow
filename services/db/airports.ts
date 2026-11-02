import {
    clampNearbyAirportLimit,
    normalizeAirportReference,
    parseCommercialServiceTier,
    type AirportCommercialServiceTier,
    type AirportReference,
    type NearbyAirportResult,
} from '../../shared/airportReference';
import { DB_ENABLED, requireSupabase } from './internal';

const mapAirportReferenceRow = (row: unknown): AirportReference | null => {
    if (!row || typeof row !== 'object') return null;
    const typed = row as Record<string, unknown>;
    return normalizeAirportReference({
        ident: typed.ident,
        iataCode: typed.iata_code,
        icaoCode: typed.icao_code,
        name: typed.name,
        municipality: typed.municipality,
        subdivisionName: typed.subdivision_name,
        regionCode: typed.region_code,
        countryCode: typed.country_code,
        countryName: typed.country_name,
        latitude: typed.latitude,
        longitude: typed.longitude,
        timezone: typed.timezone,
        airportType: typed.airport_type,
        scheduledService: typed.scheduled_service,
        isCommercial: typed.is_commercial,
        commercialServiceTier: typed.commercial_service_tier,
        isMajorCommercial: typed.is_major_commercial,
    });
};

const mapNearbyAirportRow = (row: unknown): NearbyAirportResult | null => {
    const airport = mapAirportReferenceRow(row);
    if (!airport || !row || typeof row !== 'object') return null;
    const typed = row as Record<string, unknown>;
    const distanceRaw = typed.air_distance_km;
    const airDistanceKm = typeof distanceRaw === 'number' && Number.isFinite(distanceRaw)
        ? distanceRaw
        : typeof distanceRaw === 'string'
            ? Number(distanceRaw)
            : NaN;
    if (!Number.isFinite(airDistanceKm)) return null;

    return {
        airport,
        airDistanceKm,
        rank: 0,
    };
};

export const dbFindNearestCommercialAirports = async ({
    lat,
    lng,
    limit = 10,
    minimumServiceTier = 'major',
}: {
    lat: number;
    lng: number;
    limit?: number;
    minimumServiceTier?: AirportCommercialServiceTier;
}): Promise<NearbyAirportResult[]> => {
    if (!DB_ENABLED) return [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    const client = requireSupabase();
    const safeLimit = clampNearbyAirportLimit(limit);
    const safeMinimumServiceTier = parseCommercialServiceTier(minimumServiceTier);
    const { data, error } = await client.rpc('find_nearest_commercial_airports', {
        p_lat: lat,
        p_lng: lng,
        p_limit: safeLimit,
        p_min_service_tier: safeMinimumServiceTier,
    });

    if (error) {
        console.error('Failed to fetch nearby commercial airports', error);
        return [];
    }

    if (!Array.isArray(data)) return [];

    return data
        .map((row) => mapNearbyAirportRow(row))
        .filter((airport): airport is NearbyAirportResult => Boolean(airport))
        .map((result, index) => ({
            ...result,
            rank: index + 1,
        }));
};
