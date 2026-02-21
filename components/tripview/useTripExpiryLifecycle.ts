import { useEffect, useMemo, useState } from 'react';

import { APP_NAME } from '../../config/appGlobals';
import {
    getDebugTripExpiredOverride,
    getTripLifecycleState,
    setDebugTripExpiredOverride,
    shouldShowTripPaywall,
    TRIP_EXPIRY_DEBUG_EVENT,
} from '../../config/paywall';
import type { ITrip } from '../../types';

const IS_DEV = import.meta.env.DEV;
const TRIP_EXPIRED_DEBUG_EVENT = 'tf:trip-expired-debug';

type TripDebugWindow = Window & typeof globalThis & {
    toggleExpired?: (force?: boolean) => boolean;
};

interface UseTripExpiryLifecycleOptions {
    trip: ITrip;
    isTripDetailRoute: boolean;
}

interface UseTripExpiryLifecycleResult {
    nowMs: number;
    tripExpiresAtMs: number | null;
    lifecycleState: ReturnType<typeof getTripLifecycleState>;
    isTripExpired: boolean;
    isTripLockedByExpiry: boolean;
    expirationLabel: string | null;
    expirationRelativeLabel: string | null;
}

export const useTripExpiryLifecycle = ({
    trip,
    isTripDetailRoute,
}: UseTripExpiryLifecycleOptions): UseTripExpiryLifecycleResult => {
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [expiredPreviewOverride, setExpiredPreviewOverride] = useState<boolean | null>(
        () => getDebugTripExpiredOverride(trip.id)
    );

    const tripExpiresAtMs = useMemo(() => {
        if (!trip.tripExpiresAt) return null;
        const parsed = Date.parse(trip.tripExpiresAt);
        return Number.isFinite(parsed) ? parsed : null;
    }, [trip.tripExpiresAt]);

    const lifecycleState = useMemo(
        () => getTripLifecycleState(trip, { nowMs, expiredOverride: expiredPreviewOverride }),
        [trip, nowMs, expiredPreviewOverride]
    );
    const isTripExpired = lifecycleState === 'expired';
    const isTripLockedByExpiry = useMemo(
        () => shouldShowTripPaywall(trip, { lifecycleState }),
        [trip, lifecycleState]
    );

    const expirationLabel = useMemo(() => {
        if (!tripExpiresAtMs) return null;
        const date = new Date(tripExpiresAtMs);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }, [tripExpiresAtMs]);

    const expirationRelativeLabel = useMemo(() => {
        if (!tripExpiresAtMs) return null;
        const diffMs = tripExpiresAtMs - nowMs;
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        if (diffDays > 1) return `Expires in ${diffDays} days`;
        if (diffDays === 1) return 'Expires tomorrow';
        if (diffDays === 0) return 'Expires today';
        return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
    }, [tripExpiresAtMs, nowMs]);

    useEffect(() => {
        setExpiredPreviewOverride(getDebugTripExpiredOverride(trip.id));
    }, [trip.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const syncOverride = (event: Event) => {
            const detail = (event as CustomEvent<{ tripId?: string }>).detail;
            if (detail?.tripId && detail.tripId !== trip.id) return;
            setExpiredPreviewOverride(getDebugTripExpiredOverride(trip.id));
        };
        window.addEventListener(TRIP_EXPIRY_DEBUG_EVENT, syncOverride as EventListener);
        return () => window.removeEventListener(TRIP_EXPIRY_DEBUG_EVENT, syncOverride as EventListener);
    }, [trip.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as TripDebugWindow;

        if (!isTripDetailRoute) {
            if (host.toggleExpired) {
                delete host.toggleExpired;
            }
            window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
                detail: { available: false, expired: false },
            }));
            return;
        }

        const toggleExpired = (force?: boolean) => {
            let nextExpired = false;
            setExpiredPreviewOverride((prev) => {
                const baseExpired = typeof prev === 'boolean' ? prev : isTripExpired;
                nextExpired = typeof force === 'boolean' ? force : !baseExpired;
                setDebugTripExpiredOverride(trip.id, nextExpired);
                return nextExpired;
            });
            window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
                detail: { available: true, expired: nextExpired },
            }));
            if (IS_DEV) {
                console.info(
                    `[${APP_NAME}] toggleExpired(${typeof force === 'boolean' ? force : 'toggle'}) -> ${nextExpired ? 'expired preview ON' : 'expired preview OFF'} for trip ${trip.id}`
                );
            }
            return nextExpired;
        };

        host.toggleExpired = toggleExpired;
        window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
            detail: {
                available: true,
                expired: typeof expiredPreviewOverride === 'boolean' ? expiredPreviewOverride : isTripExpired,
            },
        }));

        return () => {
            if (host.toggleExpired === toggleExpired) {
                delete host.toggleExpired;
            }
            window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
                detail: { available: false, expired: false },
            }));
        };
    }, [trip.id, isTripExpired, isTripDetailRoute, expiredPreviewOverride]);

    useEffect(() => {
        if (!tripExpiresAtMs) return;
        const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
        return () => window.clearInterval(interval);
    }, [tripExpiresAtMs]);

    return {
        nowMs,
        tripExpiresAtMs,
        lifecycleState,
        isTripExpired,
        isTripLockedByExpiry,
        expirationLabel,
        expirationRelativeLabel,
    };
};
