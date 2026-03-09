import { getFreePlanEntitlements } from './planCatalog';

const FREE_ENTITLEMENTS = getFreePlanEntitlements();

export const ANONYMOUS_TRIP_LIMIT = FREE_ENTITLEMENTS.maxActiveTrips ?? 3;
export const ANONYMOUS_TRIP_EXPIRATION_DAYS = FREE_ENTITLEMENTS.tripExpirationDays ?? 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const buildTripExpiryIso = (
    createdAtMs = Date.now(),
    expirationDays = ANONYMOUS_TRIP_EXPIRATION_DAYS
): string => new Date(createdAtMs + expirationDays * DAY_MS).toISOString();

export const resolveTripExpiryDays = (
    tripExpirationDays: number | null | undefined
): number | null => {
    if (tripExpirationDays === null) return null;
    if (typeof tripExpirationDays === 'number' && tripExpirationDays > 0) return tripExpirationDays;
    return ANONYMOUS_TRIP_EXPIRATION_DAYS;
};

export const resolveTripExpiryFromEntitlements = (
    createdAtMs: number,
    existingTripExpiry?: string | null,
    tripExpirationDays?: number | null
): string | null => {
    if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
    const resolvedDays = resolveTripExpiryDays(tripExpirationDays);
    if (resolvedDays === null) return null;
    return buildTripExpiryIso(createdAtMs, resolvedDays);
};

export const getTripExpiryMs = (tripExpiresAt?: string | null): number | null => {
    if (!tripExpiresAt) return null;
    const parsed = Date.parse(tripExpiresAt);
    return Number.isFinite(parsed) ? parsed : null;
};

export const isTripExpiredByTimestamp = (tripExpiresAt?: string | null, nowMs = Date.now()): boolean => {
    const expiresMs = getTripExpiryMs(tripExpiresAt);
    if (expiresMs === null) return false;
    return expiresMs <= nowMs;
};
