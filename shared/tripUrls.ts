import type { IViewSettings, TripPrefillData } from '../types';

export const generateTripId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const generateVersionId = (): string => {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildTripUrl = (tripId: string, versionId?: string | null): string => {
    const base = `/trip/${encodeURIComponent(tripId)}`;
    if (!versionId) return base;
    const params = new URLSearchParams();
    params.set('v', versionId);
    return `${base}?${params.toString()}`;
};

export const buildShareUrl = (token: string, versionId?: string | null): string => {
    const base = `/s/${encodeURIComponent(token)}`;
    if (!versionId) return base;
    const params = new URLSearchParams();
    params.set('v', versionId);
    return `${base}?${params.toString()}`;
};

const isLayoutMode = (value: string | null): value is IViewSettings['layoutMode'] =>
    value === 'vertical' || value === 'horizontal';

const isTimelineMode = (value: string | null): value is NonNullable<IViewSettings['timelineMode']> =>
    value === 'calendar' || value === 'timeline';

const isTimelineViewMode = (value: string | null): value is IViewSettings['timelineView'] =>
    value === 'vertical' || value === 'horizontal';

const isMapStyleValue = (value: string | null): value is IViewSettings['mapStyle'] =>
    value === 'minimal'
    || value === 'standard'
    || value === 'dark'
    || value === 'satellite'
    || value === 'clean'
    || value === 'cleanDark';

const isRouteModeValue = (value: string | null): value is NonNullable<IViewSettings['routeMode']> =>
    value === 'simple' || value === 'realistic';

export const applyViewSettingsToSearchParams = (
    params: URLSearchParams,
    view?: Partial<IViewSettings> | null
): void => {
    if (!view) return;

    const layoutMode = view.layoutMode ?? null;
    if (isLayoutMode(layoutMode)) params.set('layout', layoutMode);
    const timelineMode = view.timelineMode ?? null;
    if (isTimelineMode(timelineMode)) params.set('timelineMode', timelineMode);
    else params.delete('timelineMode');
    const timelineView = view.timelineView ?? null;
    if (isTimelineViewMode(timelineView)) params.set('timelineView', timelineView);
    const mapStyle = view.mapStyle ?? null;
    if (isMapStyleValue(mapStyle)) params.set('mapStyle', mapStyle);

    const routeMode = view.routeMode ?? null;
    if (isRouteModeValue(routeMode)) params.set('routeMode', routeMode);
    else params.delete('routeMode');

    if (typeof view.showCityNames === 'boolean') params.set('cityNames', view.showCityNames ? '1' : '0');
    else params.delete('cityNames');

    if (typeof view.zoomLevel === 'number' && Number.isFinite(view.zoomLevel)) params.set('zoom', view.zoomLevel.toFixed(2));
    else params.delete('zoom');

    if (typeof view.sidebarWidth === 'number' && Number.isFinite(view.sidebarWidth)) params.set('sidebarWidth', String(Math.round(view.sidebarWidth)));
    else params.delete('sidebarWidth');

    if (typeof view.detailsWidth === 'number' && Number.isFinite(view.detailsWidth)) params.set('detailsWidth', String(Math.round(view.detailsWidth)));
    else params.delete('detailsWidth');

    if (typeof view.timelineHeight === 'number' && Number.isFinite(view.timelineHeight)) params.set('timelineHeight', String(Math.round(view.timelineHeight)));
    else params.delete('timelineHeight');
};

export const isUuid = (value?: string | null): boolean => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

// --- TRIP PREFILL (URL-encoded create-trip parameters) ---

export const encodeTripPrefill = (data: TripPrefillData): string => {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const buildCreateTripUrl = (data: TripPrefillData): string => {
    const encoded = encodeTripPrefill(data);
    return `/create-trip?prefill=${encoded}`;
};
