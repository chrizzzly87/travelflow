import type { ActivityType, ITrip, ITimelineItem } from '../types';
import {
  MAP_PRESENTATION_VERSION,
  validateMapPresentation,
  type MapPresentationMarker,
  type MapPresentationModel,
  type MapPresentationRouteLeg,
} from '../shared/mapPresentation';
import { normalizeTransportMode } from '../shared/transportModes';
import { findTravelBetweenCities, TRAVEL_COLOR } from '../utils';

const ACTIVITY_TYPES = new Set<ActivityType>([
  'general',
  'food',
  'culture',
  'sightseeing',
  'relaxation',
  'nightlife',
  'sports',
  'hiking',
  'wildlife',
  'shopping',
  'adventure',
  'beach',
  'nature',
]);

export interface BuildTripMapPresentationOptions {
  selectedItemId?: string | null;
  includeActivities?: boolean;
}

const hasCoordinates = (item: ITimelineItem): item is ITimelineItem & {
  coordinates: { lat: number; lng: number };
} => Boolean(
  item.coordinates
  && Number.isFinite(item.coordinates.lat)
  && Number.isFinite(item.coordinates.lng)
  && Math.abs(item.coordinates.lat) <= 90
  && Math.abs(item.coordinates.lng) <= 180,
);

const markerIdForItem = (item: ITimelineItem): string => `${item.type}:${item.id}`;

const markerFromItem = (item: ITimelineItem, order: number): MapPresentationMarker => ({
  id: markerIdForItem(item),
  kind: item.type === 'city' ? 'city' : 'activity',
  position: item.coordinates!,
  label: item.title,
  secondaryLabel: item.location && item.location !== item.title ? item.location : undefined,
  order,
  color: item.color,
  imageUrl: item.imageUrl,
  categoryKeys: item.type === 'activity' ? item.activityType ?? [] : [],
  sourceItemId: item.id,
  metadata: {
    startDateOffset: item.startDateOffset,
    duration: item.duration,
    description: item.description ?? null,
    location: item.location ?? null,
    countryCode: item.countryCode ?? null,
    countryName: item.countryName ?? null,
    cost: item.cost ?? null,
  },
});

const asPositiveNumber = (value: number | undefined, multiplier: number): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value * multiplier : undefined
);

export const buildTripMapPresentation = (
  trip: Pick<ITrip, 'id' | 'items' | 'planningMeta' | 'roundTrip'>,
  options: BuildTripMapPresentationOptions = {},
): MapPresentationModel => {
  const includeActivities = options.includeActivities ?? true;
  const cityItems = trip.items
    .filter((item) => item.type === 'city')
    .sort((left, right) => left.startDateOffset - right.startDateOffset || left.id.localeCompare(right.id));
  const activityItems = includeActivities
    ? trip.items
      .filter((item) => item.type === 'activity' && hasCoordinates(item))
      .sort((left, right) => left.startDateOffset - right.startDateOffset || left.id.localeCompare(right.id))
    : [];
  const mappedCities = cityItems.filter(hasCoordinates);
  const markers = [
    ...mappedCities.map((item, index) => markerFromItem(item, index)),
    ...activityItems.map((item, index) => markerFromItem(item, mappedCities.length + index)),
  ];
  const markerIdBySourceItemId = new Map(markers.map((marker) => [marker.sourceItemId!, marker.id]));
  const routeLegs: MapPresentationRouteLeg[] = [];

  for (let index = 0; index < cityItems.length - 1; index += 1) {
    const fromCity = cityItems[index]!;
    const toCity = cityItems[index + 1]!;
    const fromMarkerId = markerIdBySourceItemId.get(fromCity.id);
    const toMarkerId = markerIdBySourceItemId.get(toCity.id);
    if (!fromMarkerId || !toMarkerId) continue;
    const travelItem = findTravelBetweenCities(trip.items, fromCity, toCity);
    const parsedMode = normalizeTransportMode(travelItem?.transportMode);
    const hasCachedMetrics = Boolean(travelItem?.routeDistanceKm || travelItem?.routeDurationHours);
    routeLegs.push({
      id: `route:${travelItem?.id ?? `${fromCity.id}:${toCity.id}`}`,
      fromMarkerId,
      toMarkerId,
      mode: parsedMode,
      geometryStatus: hasCachedMetrics ? 'computed' : 'unresolved',
      distanceMeters: asPositiveNumber(travelItem?.routeDistanceKm, 1_000),
      durationSeconds: asPositiveNumber(travelItem?.routeDurationHours, 3_600),
      color: travelItem?.color ?? TRAVEL_COLOR,
      sourceItemId: travelItem?.id,
      metadata: {
        title: travelItem?.title ?? `Travel to ${toCity.title}`,
        description: travelItem?.description ?? null,
        startDateOffset: travelItem?.startDateOffset ?? toCity.startDateOffset,
      },
    });
  }

  const selectedMarker = markers.find((marker) => marker.sourceItemId === options.selectedItemId);
  const selectedRoute = routeLegs.find((route) => route.sourceItemId === options.selectedItemId);
  const fitMarkerIds = mappedCities.length > 0
    ? mappedCities.map((item) => markerIdBySourceItemId.get(item.id)!).filter(Boolean)
    : markers.map((marker) => marker.id);
  const model: MapPresentationModel = {
    version: MAP_PRESENTATION_VERSION,
    markers,
    routeLegs,
    selection: {
      markerId: selectedMarker?.id,
      routeLegId: selectedRoute?.id,
    },
    viewport: {
      fitMarkerIds,
      focusMarkerId: selectedMarker?.id,
    },
    context: {
      source: 'travelflow_trip',
      datasetVersion: trip.planningMeta?.datasetVersion,
      templateKey: trip.planningMeta?.templateKey,
      metadata: {
        tripId: trip.id,
        roundTrip: trip.roundTrip ?? false,
      },
    },
  };

  const validation = validateMapPresentation(model);
  if (!validation.valid) {
    throw new Error(`Trip map presentation is invalid: ${validation.errors.join(' ')}`);
  }
  return model;
};

const metadataNumber = (metadata: Record<string, unknown>, key: string, fallback: number): number => {
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const metadataString = (metadata: Record<string, unknown>, key: string): string | undefined => {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const activityTypesFromCategories = (categories: string[]): ActivityType[] => {
  const matches = categories.filter((category): category is ActivityType => ACTIVITY_TYPES.has(category as ActivityType));
  return matches.length > 0 ? matches : ['general'];
};

export const mapPresentationToTimelineItems = (presentation: MapPresentationModel): ITimelineItem[] => {
  const validation = validateMapPresentation(presentation);
  if (!validation.valid) throw new Error(`Map presentation is invalid: ${validation.errors.join(' ')}`);

  const markerOrder = new Map(presentation.markers.map((marker, index) => [marker.id, marker.order ?? index]));
  const markerItems: ITimelineItem[] = presentation.markers.map((marker, index) => ({
    id: marker.sourceItemId ?? marker.id,
    type: marker.kind === 'city' ? 'city' : 'activity',
    title: marker.label,
    startDateOffset: metadataNumber(marker.metadata, 'startDateOffset', marker.order ?? index),
    duration: metadataNumber(marker.metadata, 'duration', marker.kind === 'city' ? 1 : 0.15),
    color: marker.color ?? '#4f46e5',
    description: metadataString(marker.metadata, 'description'),
    location: metadataString(marker.metadata, 'location') ?? marker.secondaryLabel ?? marker.label,
    coordinates: marker.position,
    imageUrl: marker.imageUrl,
    countryCode: metadataString(marker.metadata, 'countryCode'),
    countryName: metadataString(marker.metadata, 'countryName'),
    cost: metadataString(marker.metadata, 'cost'),
    activityType: marker.kind === 'city' ? undefined : activityTypesFromCategories(marker.categoryKeys),
  }));
  const routeItems: ITimelineItem[] = presentation.routeLegs.map((route) => {
    const toOrder = markerOrder.get(route.toMarkerId) ?? 1;
    return {
      id: route.sourceItemId ?? route.id,
      type: 'travel',
      title: metadataString(route.metadata, 'title') ?? 'Travel',
      startDateOffset: metadataNumber(route.metadata, 'startDateOffset', Math.max(0, toOrder - 0.15)),
      duration: 0.1,
      color: route.color ?? TRAVEL_COLOR,
      description: metadataString(route.metadata, 'description'),
      transportMode: route.mode,
      routeDistanceKm: route.distanceMeters === undefined ? undefined : route.distanceMeters / 1_000,
      routeDurationHours: route.durationSeconds === undefined ? undefined : route.durationSeconds / 3_600,
    };
  });

  return [...markerItems, ...routeItems];
};
