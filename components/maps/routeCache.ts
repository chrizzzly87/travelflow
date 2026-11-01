import type { RouteFailureReason } from '../../types';
import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

/**
 * The itinerary map's leg-route cache: one module-level Map shared by every
 * mounted map, persisted to local storage with separate TTLs for successful
 * and failed routes. Moved verbatim from `ItineraryMap.tsx`.
 */

export type RouteCacheEntry = {
    status: 'ok' | 'failed';
    updatedAt: number;
    path?: google.maps.LatLngLiteral[];
    distanceKm?: number;
    durationHours?: number;
    reason?: RouteFailureReason;
};

export const ROUTE_CACHE = new Map<string, RouteCacheEntry>();
export const ROUTE_FAILURE_TTL_MS = 5 * 60 * 1000;
export const ROUTE_STORAGE_KEY = 'tf_route_cache_v1';
export const ROUTE_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;
export const ROUTE_FAILURE_WARNING_TTL_MS = 2 * 60 * 1000;
export const RECENT_ROUTE_FAILURE_WARNINGS = new Map<string, number>();
let routeCacheHydrated = false;

export const shouldLogRouteFailureWarning = ({
    routeKey,
    mode,
    reason,
    nowMs = Date.now(),
}: {
    routeKey: string;
    mode: string;
    reason: RouteFailureReason;
    nowMs?: number;
}): boolean => {
    const warningKey = `${routeKey}::${mode}::${reason}`;
    const previous = RECENT_ROUTE_FAILURE_WARNINGS.get(warningKey);
    if (typeof previous === 'number' && nowMs - previous < ROUTE_FAILURE_WARNING_TTL_MS) {
        return false;
    }
    RECENT_ROUTE_FAILURE_WARNINGS.set(warningKey, nowMs);
    return true;
};

export const filterHydratedRouteCacheEntries = (
    parsed: unknown,
    now: number,
): Array<[string, RouteCacheEntry]> => {
    if (!parsed || typeof parsed !== 'object') return [];
    const entries = parsed as Record<string, RouteCacheEntry>;
    return Object.entries(entries).filter(([, entry]) => {
        if (!entry || !entry.updatedAt || !entry.status) return false;
        if (entry.status === 'failed' && now - entry.updatedAt > ROUTE_FAILURE_TTL_MS) return false;
        if (now - entry.updatedAt > ROUTE_PERSIST_TTL_MS) return false;
        return true;
    });
};

export const buildPersistedRouteCachePayload = (
    routeCache: Map<string, RouteCacheEntry>,
    now: number,
): Record<string, RouteCacheEntry> => {
    const payload: Record<string, RouteCacheEntry> = {};
    routeCache.forEach((entry, key) => {
        if (!entry || !entry.updatedAt || !entry.status) return;
        if (entry.status === 'failed') {
            if (now - entry.updatedAt <= ROUTE_FAILURE_TTL_MS) {
                payload[key] = {
                    status: 'failed',
                    updatedAt: entry.updatedAt,
                    reason: entry.reason,
                };
            }
            return;
        }
        if (now - entry.updatedAt <= ROUTE_PERSIST_TTL_MS) {
            payload[key] = entry;
        }
    });
    return payload;
};

export const hydrateRouteCache = () => {
    if (routeCacheHydrated) return;
    if (typeof window === 'undefined') return;
    routeCacheHydrated = true;
    try {
        const raw = readLocalStorageItem(ROUTE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const now = Date.now();
        filterHydratedRouteCacheEntries(parsed, now).forEach(([key, entry]) => {
            ROUTE_CACHE.set(key, entry);
        });
    } catch (e) {
        console.warn('Failed to hydrate route cache', e);
    }
};

export const persistRouteCache = () => {
    if (typeof window === 'undefined') return;
    try {
        const now = Date.now();
        const payload = buildPersistedRouteCachePayload(ROUTE_CACHE, now);
        writeLocalStorageItem(ROUTE_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Failed to persist route cache', e);
    }
};
