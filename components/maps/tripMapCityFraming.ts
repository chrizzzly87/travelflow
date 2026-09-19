import type { ITimelineItem } from '../../types';
import type { MapImplementation } from '../../shared/mapRuntime';
import { isFiniteLatLngLiteral } from '../../shared/coordinateUtils';
import { getTripMapProviderTuning } from './tripMapProviderTuning';

/**
 * Framing a selected city.
 *
 * The old behaviour was a constant: centre on the city and `setZoom(14)`. That
 * answers "where is this place" and nothing else — Tokyo overflows the pane and
 * a village drowns in its region, both at the same number.
 *
 * What a traveller actually wants in frame is their own plan for that city, so
 * the camera fits the city centre together with the activities and stays booked
 * there. Everything here is pure: it takes items and a viewport and returns a
 * camera, so the framing can be tested without a map instance.
 */

export interface LatLngBoundsLiteral {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface CityFocusBoundsCamera {
  kind: 'bounds';
  bounds: LatLngBoundsLiteral;
  /** Applied after the fit — `fitBounds` alone will happily land at z17. */
  minZoom: number;
  maxZoom: number;
  /** How many of the city's own places the fit is built from, for diagnostics. */
  placeCount: number;
}

export interface CityFocusCenterCamera {
  kind: 'center';
  center: { lat: number; lng: number };
  zoom: number;
  placeCount: number;
}

export type CityFocusCamera = CityFocusBoundsCamera | CityFocusCenterCamera;

const KM_PER_LATITUDE_DEGREE = 111.32;

/**
 * A city frame narrower than this reads as a street view rather than a city, so
 * a one-activity city is widened to it instead of slamming to the pin.
 */
export const MIN_CITY_FRAME_SPAN_KM = 2.6;

/**
 * An activity this far from the city centre is a day trip, not part of the city.
 * Letting one of those into the bounding box zooms the whole frame out to the
 * region and defeats the point of focusing a city at all.
 */
export const MAX_CITY_ACTIVITY_DISTANCE_KM = 75;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const kilometresPerLongitudeDegree = (latitude: number): number => {
  const scale = Math.cos(toRadians(latitude));
  // Near the poles a longitude degree collapses toward zero; clamping keeps the
  // widening arithmetic finite instead of producing an infinite span.
  return KM_PER_LATITUDE_DEGREE * Math.max(scale, 0.01);
};

const haversineDistanceKm = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number => {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Which city an activity belongs to. Activities carry no city id, so ownership
 * is the date range that contains them, with the preceding city as the fallback
 * for anything that falls into a gap.
 */
export const resolveActivityOwnerCity = (
  activity: ITimelineItem,
  cityItems: ITimelineItem[],
): ITimelineItem | null => {
  const directOwner = cityItems.find((city) => (
    activity.startDateOffset >= city.startDateOffset
    && activity.startDateOffset < city.startDateOffset + Math.max(city.duration, 0)
  ));
  if (directOwner) return directOwner;

  const previousCity = [...cityItems].reverse().find((city) => city.startDateOffset <= activity.startDateOffset);
  if (previousCity) return previousCity;
  return cityItems[0] || null;
};

/**
 * The city's own places: activities the traveller pinned to a real coordinate.
 * An activity that merely inherited the city centre adds no information to a
 * bounding box, so it is left out rather than counted as a place.
 */
export const collectCityFramingCoordinates = ({
  city,
  items,
  cities,
  maxDistanceKm = MAX_CITY_ACTIVITY_DISTANCE_KM,
}: {
  city: ITimelineItem;
  items: ITimelineItem[];
  cities: ITimelineItem[];
  maxDistanceKm?: number;
}): Array<{ lat: number; lng: number }> => {
  if (!isFiniteLatLngLiteral(city.coordinates)) return [];
  const centre = { lat: city.coordinates.lat, lng: city.coordinates.lng };

  const owned = items.filter((item) => {
    if (item.type !== 'activity') return false;
    if (!isFiniteLatLngLiteral(item.coordinates)) return false;
    return resolveActivityOwnerCity(item, cities)?.id === city.id;
  });

  const withinCity = owned
    .map((item) => ({ lat: item.coordinates!.lat, lng: item.coordinates!.lng }))
    .filter((position) => haversineDistanceKm(centre, position) <= maxDistanceKm);

  return [centre, ...withinCity];
};

const buildBounds = (coordinates: Array<{ lat: number; lng: number }>): LatLngBoundsLiteral => (
  coordinates.reduce<LatLngBoundsLiteral>((bounds, position) => ({
    north: Math.max(bounds.north, position.lat),
    south: Math.min(bounds.south, position.lat),
    east: Math.max(bounds.east, position.lng),
    west: Math.min(bounds.west, position.lng),
  }), {
    north: coordinates[0].lat,
    south: coordinates[0].lat,
    east: coordinates[0].lng,
    west: coordinates[0].lng,
  })
);

/**
 * Grows a box that is tighter than `minSpanKm` on either axis, around its own
 * centre, so the fit keeps the city in view rather than the block.
 */
export const widenBoundsToMinimumSpan = (
  bounds: LatLngBoundsLiteral,
  minSpanKm: number,
): LatLngBoundsLiteral => {
  const centreLat = (bounds.north + bounds.south) / 2;
  const centreLng = (bounds.east + bounds.west) / 2;

  const minLatSpan = minSpanKm / KM_PER_LATITUDE_DEGREE;
  const minLngSpan = minSpanKm / kilometresPerLongitudeDegree(centreLat);

  const latSpan = Math.max(bounds.north - bounds.south, minLatSpan);
  const lngSpan = Math.max(bounds.east - bounds.west, minLngSpan);

  return {
    north: Math.min(85, centreLat + latSpan / 2),
    south: Math.max(-85, centreLat - latSpan / 2),
    east: centreLng + lngSpan / 2,
    west: centreLng - lngSpan / 2,
  };
};

/**
 * The camera for a selected city. Returns a `center` result only when the city
 * has no pinned places of its own — the one case the old constant was right
 * about, since there is nothing to frame but the city itself.
 */
export const resolveCityFocusCamera = ({
  city,
  items,
  cities,
  provider,
  minSpanKm = MIN_CITY_FRAME_SPAN_KM,
}: {
  city: ITimelineItem;
  items: ITimelineItem[];
  cities: ITimelineItem[];
  provider: MapImplementation;
  minSpanKm?: number;
}): CityFocusCamera | null => {
  if (!isFiniteLatLngLiteral(city.coordinates)) return null;

  const tuning = getTripMapProviderTuning(provider).selection;
  const coordinates = collectCityFramingCoordinates({ city, items, cities });
  const placeCount = Math.max(0, coordinates.length - 1);

  if (placeCount === 0) {
    return {
      kind: 'center',
      center: { lat: city.coordinates.lat, lng: city.coordinates.lng },
      zoom: tuning.cityFocusZoom,
      placeCount: 0,
    };
  }

  return {
    kind: 'bounds',
    bounds: widenBoundsToMinimumSpan(buildBounds(coordinates), minSpanKm),
    minZoom: tuning.cityFitMinZoom,
    maxZoom: tuning.cityFitMaxZoom,
    placeCount,
  };
};

/** Clamps a zoom a `fitBounds` landed on into the city-framing band. */
export const clampCityFocusZoom = (
  zoom: number | null | undefined,
  camera: CityFocusBoundsCamera,
): number | null => {
  if (!Number.isFinite(zoom)) return null;
  const clamped = Math.min(camera.maxZoom, Math.max(camera.minZoom, Number(zoom)));
  return clamped === zoom ? null : clamped;
};
