import { computeMapViewport, getWorldPixel, getMapboxAccessTokenFromEnv, getTripPrimaryCityColorHex, findTravelBetweenCities, resolveColorHex, type TripPayload } from '../edge-lib/trip-og-data.ts';
import { TRIP_VIDEO, type TripVideoStyle, type TripVideoRouteMode } from '../../shared/tripOgVideo.ts';

import { resolvePreviewDayTrips } from '../../shared/dayTripPreview.ts';
import { normalizeTransportMode } from '../../shared/transportModes.ts';
import { buildRouteCacheKey } from '../../shared/routeCacheKey.ts';

export interface TripVideoRouteCacheEntry { key: string; expiresAt: number; coordinates: { lat: number; lng: number }[] }
export type TripVideoRouteCache = TripVideoRouteCacheEntry[];
const ROUTE_CACHE_LIMIT = 16;
const ROUTE_POINT_LIMIT = 256;

type Stop = NonNullable<TripPayload['items']>[number] & { coordinates: { lat: number; lng: number } };
const mapped = (item: NonNullable<TripPayload['items']>[number]): item is Stop => Boolean(item.coordinates
  && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng)
  && Math.abs(item.coordinates.lat) <= 85 && Math.abs(item.coordinates.lng) <= 180);
// Same explicit day-trip ownership and return-stay model as planner and images.
export const buildTripVideoStops = (trip: TripPayload) => {
  const items = trip.items || [];
  const cities = items.filter(item => item.type === 'city' && mapped(item)).sort((a, b) => (a.startDateOffset || 0) - (b.startDateOffset || 0)) as Stop[];
  const excursions = resolvePreviewDayTrips(items);
  const stops: (Stop & { excursion?: boolean; returnToBase?: boolean })[] = [];
  for (const city of cities) {
    if (stops.length >= TRIP_VIDEO.maxStops) break;
    stops.push(city);
    for (const dayTrip of excursions.filter(entry => entry.stay === city)) {
      if (stops.length + 2 > TRIP_VIDEO.maxStops || !mapped(dayTrip.item) || !mapped(dayTrip.returnStay)) break;
      stops.push({ ...dayTrip.item, title: dayTrip.destinationLabel, color: city.color, excursion: true },
        { ...dayTrip.returnStay, color: city.color, returnToBase: true });
    }
  }
  return stops;
};

export const tripVideoStopLabel = (title: string) => {
  const label = title.replace(/^day trip (to|at) /i, '').split(',')[0];
  return label.length > 27 ? label.slice(0, 26).replace(/\s+\S*$/, '').trimEnd() + '…' : label;
};

const styles: Record<TripVideoStyle, string> = { clean: 'light-v11', minimal: 'light-v11', standard: 'streets-v12', dark: 'dark-v11', satellite: 'satellite-streets-v12' };

export const buildTripVideoMap = async (trip: TripPayload, style: TripVideoStyle = 'standard', routeMode: TripVideoRouteMode = 'simple', routeCache: TripVideoRouteCache = []) => {
  const token = getMapboxAccessTokenFromEnv();
  if (!token) throw new Error('Mapbox token is required for trip video previews.');
  const stops = buildTripVideoStops(trip);
  const viewport = computeMapViewport(stops.map(stop => stop.coordinates));
  const center = getWorldPixel(viewport.center, viewport.zoom);
  const worldWidth = 256 * 2 ** viewport.zoom;
  const project = (coord: { lat: number; lng: number }) => {
    const pixel = getWorldPixel(coord, viewport.zoom);
    let dx = pixel.x - center.x;
    if (dx > worldWidth / 2) dx -= worldWidth;
    if (dx < -worldWidth / 2) dx += worldWidth;
    return { x: (426 / 2 + dx) / 426, y: (574 / 2 + pixel.y - center.y) / 574 };
  };
  const colorFor = (stop: Stop) => trip.mapColorMode === 'brand' ? '#4f46e5' : `#${resolveColorHex(stop.color) || getTripPrimaryCityColorHex(trip)}`;
  // Expiring, bounded per-trip geometry cache, independent of the basemap style.
  const now = Date.now();
  routeCache.splice(0, routeCache.length, ...routeCache.filter(entry => entry.expiresAt > now && entry.coordinates.length <= ROUTE_POINT_LIMIT).slice(-ROUTE_CACHE_LIMIT));
  const points = stops.map(stop => ({ ...project(stop.coordinates), label: stop.returnToBase ? '' : tripVideoStopLabel(stop.title || stop.location || ''), color: colorFor(stop), excursion: Boolean(stop.excursion), hidden: Boolean(stop.returnToBase) }));
  const legs: { x: number; y: number }[][] = [];
  const legStyles: { color: string; dashed: boolean }[] = [];
  let requests = 0;
  for (let index = 1; index < stops.length; index++) {
    const from = stops[index - 1], to = stops[index];
    let coordinates = [from.coordinates, to.coordinates];
    const travel = findTravelBetweenCities(trip.items || [], from, to);
    const mode = travel?.transportMode ? normalizeTransportMode(travel.transportMode) : 'car';
    const dayTripLeg = Boolean(to.excursion || to.returnToBase);
    legStyles.push({ color: colorFor(from), dashed: dayTripLeg });
    const profile = mode === 'walk' ? 'walking' : mode === 'bicycle' ? 'cycling' : 'driving';
    const cacheKey = `mapbox-v1/${profile}/${buildRouteCacheKey(from.coordinates, to.coordinates, mode)}`;
    const cached = routeCache.find(entry => entry.key === cacheKey);
    const routable = routeMode === 'realistic' && !dayTripLeg && !['plane', 'boat', 'train', 'na'].includes(mode)
      && (from.coordinates.lat !== to.coordinates.lat || from.coordinates.lng !== to.coordinates.lng);
    if (routable && cached) coordinates = cached.coordinates;
    // Day trips use the planner's dashed straight spokes: no paid route lookups.
    if (routable && !cached && requests < 8) {
      requests++;
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.coordinates.lng},${from.coordinates.lat};${to.coordinates.lng},${to.coordinates.lat}`);
      url.searchParams.set('access_token', token);
      url.searchParams.set('geometries', 'geojson'); url.searchParams.set('overview', 'simplified');
      let routeResolved = false;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const data = await response.json();
          const path = data.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(path) && path.length >= 2 && path.length <= 2000
            && path.every((p: unknown) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
            routeResolved = true;
            const stride = Math.max(1, Math.ceil((path.length - 1) / (ROUTE_POINT_LIMIT - 1)));
            coordinates = path.filter((_: unknown, n: number) => n % stride === 0 || n === path.length - 1).map(([lng, lat]: number[]) => ({ lat, lng }));
          }
        }
      } catch { /* Cache fallback briefly; never automatically retry a render. */ }
      routeCache.push({ key: cacheKey, expiresAt: now + (routeResolved ? 30 * 24 * 60 * 60_000 : 15 * 60_000), coordinates });
      if (routeCache.length > ROUTE_CACHE_LIMIT) routeCache.shift();
    }
    legs.push(coordinates.map(project));
  }
  // Mapbox uses a 512px world at zoom zero; the shared viewport uses 256px.
  const mapUrl = new URL(`https://api.mapbox.com/styles/v1/mapbox/${styles[style]}/static/${viewport.center.lng.toFixed(6)},${viewport.center.lat.toFixed(6)},${Math.max(0, viewport.zoom - 1)},0/426x574@2x`);
  mapUrl.searchParams.set('access_token', token);
  return { points, legs, legStyles, mapUrl: mapUrl.toString(), color: trip.mapColorMode === 'brand' ? '#4f46e5' : `#${getTripPrimaryCityColorHex(trip)}` };
};
