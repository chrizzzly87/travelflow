import type { ITrip, ITimelineItem, IViewSettings } from '../types';
import { normalizeTransportMode } from './transportModes';
import { isFiniteLatLngLiteral } from './coordinateUtils';
import { toFiniteNumber, toOptionalFiniteNumber, toPositiveFiniteNumber } from './numberUtils';

const isLayoutModeValue = (value: unknown): value is IViewSettings['layoutMode'] =>
  value === 'vertical' || value === 'horizontal';

const isTimelineModeValue = (value: unknown): value is NonNullable<IViewSettings['timelineMode']> =>
  value === 'calendar' || value === 'timeline';

const isTimelineViewValue = (value: unknown): value is IViewSettings['timelineView'] =>
  value === 'vertical' || value === 'horizontal';

const isMapStyleValue = (value: unknown): value is IViewSettings['mapStyle'] =>
  value === 'minimal'
  || value === 'standard'
  || value === 'dark'
  || value === 'satellite'
  || value === 'clean'
  || value === 'cleanDark';

const isRouteModeValue = (value: unknown): value is NonNullable<IViewSettings['routeMode']> =>
  value === 'simple' || value === 'realistic';

const isMapDockModeValue = (value: unknown): value is NonNullable<IViewSettings['mapDockMode']> =>
  value === 'docked' || value === 'floating';

const isZoomBehaviorValue = (value: unknown): value is NonNullable<IViewSettings['zoomBehavior']> =>
  value === 'fit' || value === 'manual';

const getFallbackDurationDays = (item: ITimelineItem): number => (
  item.type === 'city' ? 1 : 0.25
);

export const normalizeViewSettingsForRuntime = (
  value: IViewSettings | Partial<IViewSettings> | null | undefined,
): IViewSettings | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const view = value as Partial<IViewSettings>;
  return {
    layoutMode: isLayoutModeValue(view.layoutMode) ? view.layoutMode : 'horizontal',
    timelineMode: isTimelineModeValue(view.timelineMode) ? view.timelineMode : 'calendar',
    timelineView: isTimelineViewValue(view.timelineView) ? view.timelineView : 'horizontal',
    mapStyle: isMapStyleValue(view.mapStyle) ? view.mapStyle : 'standard',
    zoomLevel: toFiniteNumber(view.zoomLevel, 1),
    zoomBehavior: isZoomBehaviorValue(view.zoomBehavior) ? view.zoomBehavior : 'fit',
    mapDockMode: isMapDockModeValue(view.mapDockMode) ? view.mapDockMode : undefined,
    routeMode: isRouteModeValue(view.routeMode) ? view.routeMode : undefined,
    showCityNames: typeof view.showCityNames === 'boolean' ? view.showCityNames : undefined,
    sidebarWidth: toOptionalFiniteNumber(view.sidebarWidth),
    detailsWidth: toOptionalFiniteNumber(view.detailsWidth),
    timelineHeight: toOptionalFiniteNumber(view.timelineHeight),
  };
};

export const normalizeTimelineItemForRuntime = (item: ITimelineItem): ITimelineItem => {
  const fallbackDuration = getFallbackDurationDays(item);
  const nextMode = item.type === 'travel' || item.type === 'travel-empty'
    ? normalizeTransportMode(item.transportMode)
    : item.transportMode;
  const nextType: ITimelineItem['type'] =
    item.type === 'travel' || item.type === 'travel-empty'
      ? (nextMode === 'na' ? 'travel-empty' : 'travel')
      : item.type;

  const routeDistanceKm = toOptionalFiniteNumber(item.routeDistanceKm);
  const routeDurationHours = toOptionalFiniteNumber(item.routeDurationHours);
  const shouldClearRouteMetrics = (
    item.type === 'travel' || item.type === 'travel-empty'
  ) && (
    item.transportMode !== nextMode || nextMode === 'na'
  );

  return {
    ...item,
    type: nextType,
    transportMode: nextMode,
    startDateOffset: toFiniteNumber(item.startDateOffset, 0),
    duration: toPositiveFiniteNumber(item.duration, fallbackDuration, 0.05),
    coordinates: isFiniteLatLngLiteral(item.coordinates) ? item.coordinates : undefined,
    bufferBefore: toOptionalFiniteNumber(item.bufferBefore),
    bufferAfter: toOptionalFiniteNumber(item.bufferAfter),
    routeDistanceKm: shouldClearRouteMetrics ? undefined : routeDistanceKm,
    routeDurationHours: shouldClearRouteMetrics ? undefined : routeDurationHours,
  };
};

export const normalizeTripForRuntime = (trip: ITrip): ITrip => ({
  ...trip,
  defaultView: normalizeViewSettingsForRuntime(trip.defaultView),
  items: Array.isArray(trip.items)
    ? trip.items.map(normalizeTimelineItemForRuntime)
    : [],
});
