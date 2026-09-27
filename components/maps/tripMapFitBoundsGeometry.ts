import { findTravelBetweenCities } from '../../utils';
import type { ITimelineItem } from '../../types';
import type { MapImplementation } from '../../shared/mapRuntime';
import { isFiniteLatLngLiteral } from '../../shared/coordinateUtils';
import { normalizeTransportMode } from '../../shared/transportModes';
import { buildFlightRouteVisualPaths } from './flightRouteGeometry';
import { resolveTripMapFlightCurveOptions } from './tripMapProviderPresentation';
import { buildTripMapDayTripDescriptors } from './tripMapDayTripModel';

export const collectTripMapFitBoundsCoordinates = ({
  cities,
  items,
  provider,
}: {
  cities: ITimelineItem[];
  items: ITimelineItem[];
  provider: MapImplementation;
}): google.maps.LatLngLiteral[] => {
  const coordinates: google.maps.LatLngLiteral[] = [];

  cities.forEach((city) => {
    if (!isFiniteLatLngLiteral(city.coordinates)) return;
    coordinates.push(city.coordinates);
  });

  // A day trip's destination is part of the journey's shape, so the overview
  // frames it; an ordinary activity pin never widens the frame.
  buildTripMapDayTripDescriptors(items).forEach((dayTrip) => {
    coordinates.push(dayTrip.destination);
  });

  for (let index = 0; index < cities.length - 1; index += 1) {
    const start = cities[index];
    const end = cities[index + 1];
    if (!isFiniteLatLngLiteral(start.coordinates) || !isFiniteLatLngLiteral(end.coordinates)) continue;

    const travelItem = findTravelBetweenCities(items, start, end);
    if (normalizeTransportMode(travelItem?.transportMode) !== 'plane') continue;

    const flightPath = buildFlightRouteVisualPaths(
      start.coordinates,
      end.coordinates,
      resolveTripMapFlightCurveOptions(provider),
    );
    flightPath.airPath.forEach((point) => {
      coordinates.push(point);
    });
  }

  return coordinates;
};
