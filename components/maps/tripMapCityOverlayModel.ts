import type { MapImplementation } from '../../shared/mapRuntime';
import type { ITimelineItem } from '../../types';
import { getNormalizedCityName } from '../../utils';
import { buildLatLngPrecisionKey, isFiniteLatLngLiteral } from '../../shared/coordinateUtils';
import {
  resolveTripMapCityLabelAnchor,
  type TripMapCityLabelAnchor,
} from './tripMapProviderPresentation';

const DEFAULT_CITY_MARKER_OVERLAP_RADIUS_METERS = 420;
const DEFAULT_COORDINATE_GROUP_PRECISION = 5;

export interface TripMapCityOverlayDescriptor {
  key: string;
  city: ITimelineItem;
  cityIndex: number;
  cityKey: string;
  labelName: string;
  markerPosition: google.maps.LatLngLiteral;
}

export interface TripMapCityLabelOverlayDescriptor extends TripMapCityOverlayDescriptor {
  subLabel?: string;
  defaultAnchor: TripMapCityLabelAnchor;
}

export const getMapLabelCityName = (value?: string): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const firstSegment = raw.split(',')[0]?.trim();
  return firstSegment || raw;
};

export const resolveTripMapCityLabelName = (
  city: Pick<ITimelineItem, 'title' | 'location'>,
): string => {
  const locationName = getMapLabelCityName(city.location);
  if (locationName) return locationName;
  const titleName = getMapLabelCityName(city.title);
  return titleName || city.title || city.location || '';
};

export const offsetLatLngByMeters = (
  origin: google.maps.LatLngLiteral,
  eastMeters: number,
  northMeters: number,
): google.maps.LatLngLiteral => {
  const metersPerDegreeLat = 111_320;
  const safeCosine = Math.max(0.01, Math.cos((origin.lat * Math.PI) / 180));
  const metersPerDegreeLng = metersPerDegreeLat * safeCosine;
  return {
    lat: origin.lat + (northMeters / metersPerDegreeLat),
    lng: origin.lng + (eastMeters / metersPerDegreeLng),
  };
};

export const buildOverlappingMarkerPosition = (
  origin: google.maps.LatLngLiteral,
  overlapIndex: number,
  overlapCount: number,
  radiusMeters = DEFAULT_CITY_MARKER_OVERLAP_RADIUS_METERS,
): google.maps.LatLngLiteral => {
  if (overlapCount <= 1 || overlapIndex < 0 || overlapIndex >= overlapCount) {
    return origin;
  }
  const angle = (-Math.PI / 2) + ((2 * Math.PI * overlapIndex) / overlapCount);
  const eastMeters = Math.cos(angle) * radiusMeters;
  const northMeters = Math.sin(angle) * radiusMeters;
  return offsetLatLngByMeters(origin, eastMeters, northMeters);
};

export const buildTripMapCoordinateGroupKey = (
  coordinates: google.maps.LatLngLiteral | null | undefined,
  precision = DEFAULT_COORDINATE_GROUP_PRECISION,
): string | null => buildLatLngPrecisionKey(coordinates, precision);

export const buildTripMapCityCoordinateGroups = (
  cities: ITimelineItem[],
): Map<string, number[]> => {
  const coordinateMarkerGroups = new Map<string, number[]>();
  cities.forEach((city, index) => {
    if (!isFiniteLatLngLiteral(city.coordinates)) return;
    const key = buildTripMapCoordinateGroupKey(city.coordinates);
    if (!key) return;
    const grouped = coordinateMarkerGroups.get(key) ?? [];
    grouped.push(index);
    coordinateMarkerGroups.set(key, grouped);
  });
  return coordinateMarkerGroups;
};

export const resolveTripMapCityMarkerPosition = ({
  city,
  cityIndex,
  coordinateGroups,
  radiusMeters = DEFAULT_CITY_MARKER_OVERLAP_RADIUS_METERS,
}: {
  city: ITimelineItem;
  cityIndex: number;
  coordinateGroups: Map<string, number[]>;
  radiusMeters?: number;
}): google.maps.LatLngLiteral | null => {
  if (!isFiniteLatLngLiteral(city.coordinates)) return null;
  const key = buildTripMapCoordinateGroupKey(city.coordinates);
  if (!key) return city.coordinates;
  const grouped = coordinateGroups.get(key);
  if (!grouped || grouped.length <= 1) return city.coordinates;
  const overlapIndex = grouped.indexOf(cityIndex);
  if (overlapIndex < 0) return city.coordinates;
  return buildOverlappingMarkerPosition(city.coordinates, overlapIndex, grouped.length, radiusMeters);
};

export const buildTripMapCityOverlayDescriptors = (
  cities: ITimelineItem[],
): TripMapCityOverlayDescriptor[] => {
  const coordinateGroups = buildTripMapCityCoordinateGroups(cities);

  return cities.flatMap((city, cityIndex) => {
    const markerPosition = resolveTripMapCityMarkerPosition({
      city,
      cityIndex,
      coordinateGroups,
    });
    if (!markerPosition) return [];
    const labelName = resolveTripMapCityLabelName(city);
    return [{
      key: `${city.id ?? cityIndex}:${cityIndex}`,
      city,
      cityIndex,
      cityKey: getNormalizedCityName(labelName),
      labelName,
      markerPosition,
    }];
  });
};

export const buildTripMapCityLabelOverlayDescriptors = ({
  provider,
  cityOverlays,
}: {
  provider: MapImplementation;
  cityOverlays: TripMapCityOverlayDescriptor[];
}): TripMapCityLabelOverlayDescriptor[] => {
  const startCityDescriptor = cityOverlays[0];
  const endCityDescriptor = cityOverlays[cityOverlays.length - 1];
  const startCityKey = startCityDescriptor?.cityKey ?? '';
  const endCityKey = endCityDescriptor?.cityKey ?? '';
  const isRoundTrip = Boolean(startCityKey && endCityKey && startCityKey === endCityKey);

  const findNeighborMarkerPosition = (
    fromIndex: number,
    direction: -1 | 1,
  ): google.maps.LatLngLiteral | null => {
    let cursor = fromIndex + direction;
    while (cursor >= 0 && cursor < cityOverlays.length) {
      const candidate = cityOverlays[cursor]?.markerPosition;
      if (candidate) return candidate;
      cursor += direction;
    }
    return null;
  };

  const shownRoundTripLabelKeys = new Set<string>();

  return cityOverlays.flatMap((descriptor, descriptorIndex) => {
    if (!descriptor.labelName) return [];
    const previousCoordinates = findNeighborMarkerPosition(descriptorIndex, -1);
    const nextCoordinates = findNeighborMarkerPosition(descriptorIndex, 1);
    const defaultAnchor = resolveTripMapCityLabelAnchor(
      provider,
      descriptor.markerPosition,
      previousCoordinates,
      nextCoordinates,
    );

    let subLabel: string | undefined;
    if (startCityDescriptor && descriptor.city.id === startCityDescriptor.city.id) subLabel = 'START';
    if (endCityDescriptor && descriptor.city.id === endCityDescriptor.city.id) {
      subLabel = subLabel ? 'START • END' : 'END';
    }
    if (isRoundTrip && descriptor.cityKey && descriptor.cityKey === startCityKey) {
      subLabel = 'START • END';
      if (shownRoundTripLabelKeys.has(descriptor.cityKey)) return [];
      shownRoundTripLabelKeys.add(descriptor.cityKey);
    }

    return [{
      ...descriptor,
      subLabel,
      defaultAnchor,
    }];
  });
};
