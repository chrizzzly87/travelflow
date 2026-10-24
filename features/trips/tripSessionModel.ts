import type { ITrip, IViewSettings, ITimelineItem } from '../../types';
import type { useNavigate } from '../../app/navigation';
import { normalizeTransportMode } from '../../shared/transportModes';
import { createTripHistorySnapshotEntry } from '../../services/historyService';
const toFiniteNumber = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeSettingsForPersistence = (settings: IViewSettings) => ({
    mapStyle: settings.mapStyle,
    routeMode: settings.routeMode,
    layoutMode: settings.layoutMode,
    timelineMode: settings.timelineMode,
    timelineView: settings.timelineView,
    showCityNames: Boolean(settings.showCityNames),
    zoomLevel: Number(toFiniteNumber(settings.zoomLevel, 1).toFixed(2)),
    sidebarWidth: Math.round(toFiniteNumber(settings.sidebarWidth, 560)),
    timelineHeight: Math.round(toFiniteNumber(settings.timelineHeight, 340)),
});

export const normalizeTripForRuntimeLoad = (trip: ITrip): ITrip => {
    let didChange = false;

    const normalizedItems = trip.items.map((item) => {
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

        if (!modeChanged && !typeChanged && !shouldClearRouteMetrics) return item;

        didChange = true;
        return {
            ...item,
            type: nextType,
            transportMode: nextMode,
            routeDistanceKm: shouldClearRouteMetrics ? undefined : item.routeDistanceKm,
            routeDurationHours: shouldClearRouteMetrics ? undefined : item.routeDurationHours,
        };
    });

    if (!didChange) return trip;
    return {
        ...trip,
        items: normalizedItems,
    };
};

export const createLocalHistoryEntry = (
    navigate: ReturnType<typeof useNavigate>,
    updatedTrip: ITrip,
    view: IViewSettings | undefined,
    label: string,
    options?: { replace?: boolean },
    ts?: number,
    baseUrlOverride?: string,
    versionId?: string,
    changeSetId?: string
) => {
    const { url } = createTripHistorySnapshotEntry({
        tripId: updatedTrip.id,
        trip: updatedTrip,
        view,
        label,
        ts,
        baseUrlOverride,
        versionId,
        changeSetId,
    });
    navigate(url, { replace: options?.replace ?? false });
    return url;
};
