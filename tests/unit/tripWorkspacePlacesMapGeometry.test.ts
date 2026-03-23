import { describe, expect, it } from 'vitest';

import { getTripWorkspaceCityGuideById } from '../../components/tripview/workspace/tripWorkspaceDemoData';
import {
  buildTripWorkspacePlacesFitBoundsCoordinates,
  buildTripWorkspacePlacesMapGeometry,
  projectPercentPointToCoordinate,
} from '../../components/tripview/workspace/tripWorkspacePlacesMapGeometry';

describe('tripWorkspacePlacesMapGeometry', () => {
  it('projects relative map points into stable coordinates around the city center', () => {
    const origin = { lat: 13.7563, lng: 100.5018 };
    const center = projectPercentPointToCoordinate(origin, { x: 50, y: 50 });
    const offset = projectPercentPointToCoordinate(origin, { x: 70, y: 30 });

    expect(center.lat).toBeCloseTo(origin.lat, 6);
    expect(center.lng).toBeCloseTo(origin.lng, 6);
    expect(offset.lat).toBeGreaterThan(origin.lat);
    expect(offset.lng).toBeGreaterThan(origin.lng);
  });

  it('derives neighborhood circles, stay anchors, and focus path coordinates from the active layer', () => {
    const city = getTripWorkspaceCityGuideById('bangkok');

    expect(city).not.toBeNull();

    const activeLayer = city!.mapLayers[0];
    const visibleNeighborhoods = city!.neighborhoods.filter((neighborhood) => activeLayer.neighborhoodNames.includes(neighborhood.name));
    const visibleStays = city!.savedStays.filter((stay) => activeLayer.stayAreas.includes(stay.area));
    const geometry = buildTripWorkspacePlacesMapGeometry({
      origin: { lat: 13.7563, lng: 100.5018 },
      visibleNeighborhoods,
      visibleStays,
      activeLayer,
    });

    expect(geometry.neighborhoods).toHaveLength(2);
    expect(geometry.stays).toHaveLength(1);
    expect(geometry.focusPath).toHaveLength(activeLayer.focusPath.length);
    expect(geometry.calloutCoordinate).not.toBeNull();
    expect(geometry.neighborhoods[0]?.radiusMeters).toBeGreaterThan(1000);
  });

  it('builds fit-bounds coordinates that cover neighborhood radii and route callouts', () => {
    const city = getTripWorkspaceCityGuideById('bangkok');

    expect(city).not.toBeNull();

    const geometry = buildTripWorkspacePlacesMapGeometry({
      origin: { lat: 13.7563, lng: 100.5018 },
      visibleNeighborhoods: city!.neighborhoods,
      visibleStays: city!.savedStays,
      activeLayer: city!.mapLayers[0],
    });
    const fitBoundsCoordinates = buildTripWorkspacePlacesFitBoundsCoordinates(geometry);

    expect(fitBoundsCoordinates.length).toBeGreaterThan(geometry.neighborhoods.length);
    expect(fitBoundsCoordinates).toContainEqual(geometry.neighborhoods[0]!.center);
    expect(fitBoundsCoordinates).toContainEqual(geometry.stays[0]!.coordinate);
    expect(fitBoundsCoordinates).toContainEqual(geometry.calloutCoordinate!);
  });
});
