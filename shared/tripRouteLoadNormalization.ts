import type { ITrip, ITimelineItem } from '../types';
import { normalizeTransportMode } from './transportModes';
import { normalizeTripForRuntime } from './tripRuntimeNormalization';

export const normalizeTripForRouteLoad = (trip: ITrip): ITrip => {
    const runtimeTrip = normalizeTripForRuntime(trip);
    let didChange = false;

    const normalizedItems = runtimeTrip.items.map((item) => {
        if (item.type !== 'travel' && item.type !== 'travel-empty') return item;

        const nextMode = normalizeTransportMode(item.transportMode);
        const nextType: ITimelineItem['type'] = nextMode === 'na' ? 'travel-empty' : 'travel';
        const modeChanged = item.transportMode !== nextMode;
        const typeChanged = item.type !== nextType;
        const shouldClearRouteMetrics = (
            modeChanged || nextMode === 'na'
        ) && (
            item.routeDistanceKm !== undefined || item.routeDurationHours !== undefined
        );

        if (!modeChanged && !typeChanged && !shouldClearRouteMetrics) {
            return item;
        }

        didChange = true;
        return {
            ...item,
            type: nextType,
            transportMode: nextMode,
            routeDistanceKm: shouldClearRouteMetrics ? undefined : item.routeDistanceKm,
            routeDurationHours: shouldClearRouteMetrics ? undefined : item.routeDurationHours,
        };
    });

    if (!didChange) return runtimeTrip;
    return {
        ...runtimeTrip,
        items: normalizedItems,
    };
};
