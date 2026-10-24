import { isIsoDateInRange } from './adminDateRange';
import type { AdminTripRecord } from '../../services/adminService';
import type { TripGenerationState } from '../../types';

export type AdminTripExpirationBucket =
    | 'no_expiration'
    | 'already_expired'
    | 'expiring_24h'
    | 'expiring_7d'
    | 'scheduled';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const getAdminTripExpirationBucket = (
    trip: Pick<AdminTripRecord, 'trip_expires_at'>,
    nowMs: number = Date.now(),
): AdminTripExpirationBucket => {
    const expiresAt = trip.trip_expires_at;
    if (!expiresAt) return 'no_expiration';
    const parsed = Date.parse(expiresAt);
    if (!Number.isFinite(parsed)) return 'no_expiration';
    const diffMs = parsed - nowMs;
    if (diffMs <= 0) return 'already_expired';
    if (diffMs <= DAY_MS) return 'expiring_24h';
    if (diffMs <= 7 * DAY_MS) return 'expiring_7d';
    return 'scheduled';
};

export const resolveAdminTripGenerationState = (
    trip: Pick<AdminTripRecord, 'generation_state'>,
): TripGenerationState => {
    const state = trip.generation_state;
    if (state === 'failed' || state === 'running' || state === 'queued' || state === 'succeeded') return state;
    return 'succeeded';
};

export interface AdminTripsKpiSummary {
    /** Every trip in scope, whatever its state. */
    total: number;
    active: number;
    /** Generation failed: an admin can retry it from the trip's details. */
    failedGeneration: number;
    /** Queued or running right now: worth watching for stuck jobs. */
    generating: number;
    /** Not archived, and the expiry falls within the next seven days. */
    expiringSoon: number;
}

/**
 * The Trips screen's KPI tiles. Counted over the date range only — not the
 * table filters — so pressing "Show failed" does not make the other tiles
 * collapse to the filtered subset.
 */
export const summarizeAdminTrips = (
    trips: ReadonlyArray<Pick<AdminTripRecord, 'status' | 'generation_state' | 'trip_expires_at'>>,
    nowMs: number = Date.now(),
): AdminTripsKpiSummary => {
    const summary: AdminTripsKpiSummary = { total: 0, active: 0, failedGeneration: 0, generating: 0, expiringSoon: 0 };
    for (const trip of trips) {
        summary.total += 1;
        if (trip.status === 'active') summary.active += 1;
        const generation = resolveAdminTripGenerationState(trip);
        if (generation === 'failed') summary.failedGeneration += 1;
        if (generation === 'running' || generation === 'queued') summary.generating += 1;
        if (trip.status !== 'archived') {
            const bucket = getAdminTripExpirationBucket(trip, nowMs);
            if (bucket === 'expiring_24h' || bucket === 'expiring_7d') summary.expiringSoon += 1;
        }
    }
    return summary;
};

/**
 * The Trips screen used to host its own owner drawer at
 * `/admin/trips?user=<id>&drawer=user` (the trip page's admin banner still
 * links there). Owner details now live in the Users sheet only, so that link
 * forwards to `/admin/users?user=<id>&drawer=user`. Returns null when the
 * params are not an owner deep link.
 */
export const getLegacyOwnerDeepLinkTarget = (searchParams: URLSearchParams): string | null => {
    if (searchParams.get('drawer') !== 'user') return null;
    const userId = searchParams.get('user')?.trim();
    if (!userId) return null;
    return buildAdminUserSheetPath(userId);
};

export const buildAdminUserSheetPath = (userId: string): string => (
    `/admin/users?user=${encodeURIComponent(userId)}&drawer=user`
);

export type AdminTripsPageSelection = 'none' | 'some' | 'all';

/** Header checkbox state for the rows on the current page. */
export const getPageSelectionState = (
    pageTripIds: readonly string[],
    selectedTripIds: ReadonlySet<string>,
): AdminTripsPageSelection => {
    if (pageTripIds.length === 0) return 'none';
    let selected = 0;
    for (const tripId of pageTripIds) {
        if (selectedTripIds.has(tripId)) selected += 1;
    }
    if (selected === 0) return 'none';
    return selected === pageTripIds.length ? 'all' : 'some';
};

/**
 * A Trips screen URL pre-filtered the way a tile elsewhere counted (for example
 * the Overview's "Failed generations"), keeping the date range so the list
 * shows exactly that many trips. The Trips screen defaults to 30 days.
 */
export const buildAdminTripsFilterPath = (
    filters: Record<string, string>,
    range: '7d' | '30d' | '90d' | 'all',
): string => {
    const params = new URLSearchParams(filters);
    if (range !== '30d') params.set('range', range);
    return `/admin/trips?${params.toString()}`;
};

/**
 * Whether a trip falls in an admin date range. Trips are scoped by their last
 * update (falling back to creation), on the Trips screen and on every tile that
 * links to it, so a count and the list it opens always agree.
 */
export const isAdminTripInDateRange = (
    trip: Pick<AdminTripRecord, 'updated_at' | 'created_at'>,
    range: '7d' | '30d' | '90d' | 'all',
): boolean => isIsoDateInRange(trip.updated_at || trip.created_at, range);
