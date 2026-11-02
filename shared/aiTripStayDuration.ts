/**
 * The itinerary compiler may append the origin as a departure marker, not an
 * overnight stay. Only that explicit terminal zero is exempt from the normal
 * positive-duration fallback used by timeline builders.
 */
export const isZeroNightReturnStop = (
  cities: readonly unknown[],
  index: number,
  roundTrip: boolean,
): boolean => {
  if (!roundTrip || index <= 0 || index !== cities.length - 1) return false;
  const first = cities[0] as { name?: unknown } | null;
  const last = cities[index] as { name?: unknown; days?: unknown } | null;
  if (!first || !last || last.days !== 0) return false;
  const normalizeName = (name: unknown): string => typeof name === 'string'
    ? name.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
  const origin = normalizeName(first.name);
  return Boolean(origin) && normalizeName(last.name) === origin;
};
