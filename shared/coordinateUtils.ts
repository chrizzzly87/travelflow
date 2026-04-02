export const isFiniteLatLngLiteral = (
  coordinates: google.maps.LatLngLiteral | null | undefined,
): coordinates is google.maps.LatLngLiteral => (
  Boolean(coordinates)
  && Number.isFinite(coordinates.lat)
  && Number.isFinite(coordinates.lng)
);

export const buildLatLngPrecisionKey = (
  coordinates: google.maps.LatLngLiteral | null | undefined,
  precision: number,
): string | null => {
  if (!isFiniteLatLngLiteral(coordinates)) return null;
  return `${coordinates.lat.toFixed(precision)},${coordinates.lng.toFixed(precision)}`;
};
