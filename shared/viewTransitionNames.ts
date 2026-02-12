export const getExampleMapViewTransitionName = (enabled?: boolean): string | undefined =>
    enabled ? 'trip-map' : undefined;

export const getExampleCityLaneViewTransitionName = (
    enabled?: boolean,
    cityIndex?: number
): string | undefined => {
    if (!enabled || !Number.isFinite(cityIndex)) return undefined;
    return `trip-city-lane-${Math.max(0, Math.floor(cityIndex as number))}`;
};

export const getExampleTitleViewTransitionName = (enabled?: boolean): string | undefined =>
    enabled ? 'trip-title' : undefined;
