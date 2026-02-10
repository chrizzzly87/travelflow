export const ANONYMOUS_TRIP_LIMIT = 3;
export const ANONYMOUS_TRIP_EXPIRATION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export const buildTripExpiryIso = (
    createdAtMs = Date.now(),
    expirationDays = ANONYMOUS_TRIP_EXPIRATION_DAYS
): string => new Date(createdAtMs + expirationDays * DAY_MS).toISOString();

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

