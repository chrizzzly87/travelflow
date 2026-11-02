import type { RouteFailureReason } from '../../types';
import { GOOGLE_ROUTES_COMPUTE_FIELDS } from '../../services/routeService';

/**
 * Which Google Routes travel modes to try for a leg, and how a failed or
 * skipped attempt maps onto a route failure reason. Moved verbatim from
 * `ItineraryMap.tsx`.
 */

export const MAX_WALK_ROUTE_CHECK_KM = 60;
export const MAX_BICYCLE_ROUTE_CHECK_KM = 160;
export const MAX_TRANSIT_ROUTE_CHECK_KM = 1400;
export const MAX_DRIVING_ROUTE_CHECK_KM = 3000;
export const TRANSIT_SECOND_PASS_MAX_KM = 320;
export const TRANSIT_DRIVING_RETRY_MAX_KM = TRANSIT_SECOND_PASS_MAX_KM;
export const ROUTES_COMPUTE_FIELDS = GOOGLE_ROUTES_COMPUTE_FIELDS;
export type RouteApiMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
export type RouteAttemptPolicy = {
    shouldAttempt: boolean;
    modes: RouteApiMode[];
    reason?: 'unsupported_mode' | 'invalid_distance' | 'distance_cap_exceeded';
};

export const mapRouteAttemptPolicyReasonToFailureReason = (
    reason?: RouteAttemptPolicy['reason'],
): RouteFailureReason => {
    if (reason === 'unsupported_mode') return 'unsupported_mode';
    if (reason === 'distance_cap_exceeded') return 'distance_cap_exceeded';
    if (reason === 'invalid_distance') return 'invalid_distance';
    return 'request_error';
};

export const classifyRouteComputationError = (error: unknown): RouteFailureReason => {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : '';
    const normalized = message.toUpperCase();

    if (normalized.includes('ZERO_RESULTS') || normalized.includes('NO ROUTE COULD BE FOUND')) {
        return 'zero_results';
    }
    if (normalized.includes('NO ROUTE PATH RETURNED')) {
        return 'no_route_path';
    }
    if (normalized.includes('ROUTE PATH IS STRAIGHT')) {
        return 'straight_path';
    }
    if (normalized.includes('ROUTES API UNAVAILABLE')) {
        return 'api_unavailable';
    }
    return 'request_error';
};

export const buildRouteAttemptPolicy = (
    mode: string,
    straightDistanceKm: number,
): RouteAttemptPolicy => {
    if (!Number.isFinite(straightDistanceKm) || straightDistanceKm <= 0) {
        return { shouldAttempt: false, modes: [], reason: 'invalid_distance' };
    }

    switch (mode) {
        case 'walk':
            return straightDistanceKm <= MAX_WALK_ROUTE_CHECK_KM
                ? { shouldAttempt: true, modes: ['WALKING'] }
                : { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
        case 'bicycle':
            return straightDistanceKm <= MAX_BICYCLE_ROUTE_CHECK_KM
                ? { shouldAttempt: true, modes: ['BICYCLING'] }
                : { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
        case 'train':
        case 'bus':
            if (straightDistanceKm > MAX_TRANSIT_ROUTE_CHECK_KM) {
                return { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
            }
            if (straightDistanceKm <= TRANSIT_SECOND_PASS_MAX_KM) {
                // Second pass stays in TRANSIT mode but drops strict train/bus submode filters.
                return { shouldAttempt: true, modes: ['TRANSIT', 'TRANSIT'] };
            }
            return { shouldAttempt: true, modes: ['TRANSIT'] };
        case 'car':
        case 'motorcycle':
            return straightDistanceKm <= MAX_DRIVING_ROUTE_CHECK_KM
                ? { shouldAttempt: true, modes: ['DRIVING'] }
                : { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
        default:
            return { shouldAttempt: false, modes: [], reason: 'unsupported_mode' };
    }
};
