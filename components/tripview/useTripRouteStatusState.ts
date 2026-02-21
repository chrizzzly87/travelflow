import { useCallback, useState } from 'react';

import type { ITrip, ITimelineItem, IViewSettings, RouteStatus } from '../../types';
import { buildRouteCacheKey, getTravelLegMetricsForItem } from '../../utils';
import { normalizeTransportMode } from '../../shared/transportModes';

interface UseTripRouteStatusStateOptions {
    tripRef: React.MutableRefObject<ITrip>;
    pendingCommitRef: React.MutableRefObject<{ trip: ITrip; view: IViewSettings } | null>;
    onUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
}

interface RouteMetricsPayload {
    routeDistanceKm?: number;
    routeDurationHours?: number;
    mode?: string;
    routeKey?: string;
}

interface RouteStatusMeta {
    mode?: string;
    routeKey?: string;
}

export const useTripRouteStatusState = ({
    tripRef,
    pendingCommitRef,
    onUpdateTrip,
}: UseTripRouteStatusStateOptions) => {
    const [routeStatusById, setRouteStatusById] = useState<Record<string, RouteStatus>>({});

    const clearRouteStatusForItem = useCallback((travelItemId: string) => {
        setRouteStatusById((previous) => {
            if (!previous[travelItemId]) return previous;
            const next = { ...previous };
            delete next[travelItemId];
            return next;
        });
    }, []);

    const handleRouteMetrics = useCallback((travelItemId: string, metrics: RouteMetricsPayload) => {
        const currentTrip = tripRef.current;
        const item = currentTrip.items.find((candidate) => candidate.id === travelItemId);
        if (!item) return;

        const normalizedItemMode = normalizeTransportMode(item.transportMode);
        if (metrics.mode && normalizedItemMode !== normalizeTransportMode(metrics.mode)) return;

        if (metrics.routeKey) {
            const leg = getTravelLegMetricsForItem(currentTrip.items, travelItemId);
            if (!leg?.fromCity.coordinates || !leg?.toCity.coordinates) return;

            const expectedKey = buildRouteCacheKey(
                leg.fromCity.coordinates,
                leg.toCity.coordinates,
                normalizedItemMode
            );
            if (expectedKey !== metrics.routeKey) return;
        }

        const updates: Partial<ITimelineItem> = {};
        if (Number.isFinite(metrics.routeDistanceKm)) {
            const nextDistance = metrics.routeDistanceKm as number;
            if (!Number.isFinite(item.routeDistanceKm) || Math.abs((item.routeDistanceKm as number) - nextDistance) > 0.01) {
                updates.routeDistanceKm = nextDistance;
            }
        }

        if (Number.isFinite(metrics.routeDurationHours)) {
            const nextDuration = metrics.routeDurationHours as number;
            if (!Number.isFinite(item.routeDurationHours) || Math.abs((item.routeDurationHours as number) - nextDuration) > 0.01) {
                updates.routeDurationHours = nextDuration;
            }
        }

        if (Object.keys(updates).length === 0) return;

        const nextItems = currentTrip.items.map((candidate) =>
            candidate.id === travelItemId ? { ...candidate, ...updates } : candidate
        );
        const updatedTrip: ITrip = {
            ...currentTrip,
            items: nextItems,
            updatedAt: Date.now(),
        };

        tripRef.current = updatedTrip;
        if (pendingCommitRef.current?.trip?.id === updatedTrip.id) {
            pendingCommitRef.current = {
                ...pendingCommitRef.current,
                trip: updatedTrip,
            };
        }

        onUpdateTrip(updatedTrip);
    }, [onUpdateTrip, pendingCommitRef, tripRef]);

    const handleRouteStatus = useCallback((travelItemId: string, status: RouteStatus, meta?: RouteStatusMeta) => {
        const currentTrip = tripRef.current;
        const item = currentTrip.items.find((candidate) => candidate.id === travelItemId);
        if (!item) return;

        const normalizedItemMode = normalizeTransportMode(item.transportMode);
        if (meta?.mode && normalizedItemMode !== normalizeTransportMode(meta.mode)) return;

        if (meta?.routeKey) {
            const leg = getTravelLegMetricsForItem(currentTrip.items, travelItemId);
            if (!leg?.fromCity.coordinates || !leg?.toCity.coordinates) return;

            const expectedKey = buildRouteCacheKey(
                leg.fromCity.coordinates,
                leg.toCity.coordinates,
                normalizedItemMode
            );
            if (expectedKey !== meta.routeKey) return;
        }

        setRouteStatusById((previous) => {
            if (previous[travelItemId] === status) return previous;
            return {
                ...previous,
                [travelItemId]: status,
            };
        });
    }, [tripRef]);

    return {
        routeStatusById,
        handleRouteMetrics,
        handleRouteStatus,
        clearRouteStatusForItem,
    };
};
