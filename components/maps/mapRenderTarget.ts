import type mapboxgl from 'mapbox-gl';

export const resolveActiveOverlayMapTarget = ({
  isMapboxEnabled,
  googleMap,
  mapboxMap,
}: {
  isMapboxEnabled: boolean;
  googleMap: google.maps.Map | null;
  mapboxMap: mapboxgl.Map | null;
}): unknown | null => (
  isMapboxEnabled ? mapboxMap : googleMap
);

export const shouldHideGoogleMapCanvas = ({
  isMapboxEnabled,
}: {
  isMapboxEnabled: boolean;
}): boolean => isMapboxEnabled;
