import { computeMapViewport, getWorldPixel, getMapboxAccessTokenFromEnv, getTripPrimaryCityColorHex, type TripPayload } from '../edge-lib/trip-og-data.ts';
import { TRIP_VIDEO, type TripVideoStyle, type TripVideoRouteMode } from '../../shared/tripOgVideo.ts';

type Stop = NonNullable<TripPayload['items']>[number] & { coordinates: { lat: number; lng: number } };
const mapped = (item: NonNullable<TripPayload['items']>[number]): item is Stop => Boolean(item.coordinates
  && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng)
  && Math.abs(item.coordinates.lat) <= 85 && Math.abs(item.coordinates.lng) <= 180);
const distanceKm = (a: Stop, b: Stop) => {
  const rad = Math.PI / 180;
  const lat = (a.coordinates.lat - b.coordinates.lat) * rad;
  const lng = (a.coordinates.lng - b.coordinates.lng) * rad;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.sin(lat / 2) ** 2
    + Math.cos(a.coordinates.lat * rad) * Math.cos(b.coordinates.lat * rad) * Math.sin(lng / 2) ** 2)));
};

// A mapped activity outside its city's local area is an excursion, not the next
// overnight stop. Insert its return to base before continuing the main itinerary.
export const buildTripVideoStops = (trip: TripPayload) => {
  const cities = (trip.items || []).filter(item => item.type === 'city' && mapped(item)).sort((a, b) => (a.startDateOffset || 0) - (b.startDateOffset || 0)) as Stop[];
  const activities = (trip.items || []).filter(item => item.type === 'activity' && mapped(item)) as Stop[];
  const stops: (Stop & { excursion?: boolean; returnToBase?: boolean })[] = [];
  for (const city of cities) {
    if (stops.length >= TRIP_VIDEO.maxStops) break;
    stops.push(city);
    const excursions = activities.filter(item => {
      const day = item.startDateOffset || 0;
      return day >= (city.startDateOffset || 0) && day < (city.startDateOffset || 0) + (city.duration || 0)
        && distanceKm(city, item) >= 10;
    }).sort((a, b) => (a.startDateOffset || 0) - (b.startDateOffset || 0));
    for (const activity of excursions) {
      if (stops.length + 2 > TRIP_VIDEO.maxStops) break;
      stops.push({ ...activity, excursion: true }, { ...city, returnToBase: true });
    }
  }
  return stops;
};

export const tripVideoStopLabel = (title: string) => {
  const label = title.replace(/^day trip (to|at) /i, '').split(',')[0];
  return label.length > 27 ? label.slice(0, 26).replace(/\s+\S*$/, '').trimEnd() + '…' : label;
};

const styles: Record<TripVideoStyle, string> = { clean: 'light-v11', minimal: 'light-v11', standard: 'streets-v12', dark: 'dark-v11', satellite: 'satellite-streets-v12' };

export const buildTripVideoMap = async (trip: TripPayload, style: TripVideoStyle = 'clean', routeMode: TripVideoRouteMode = 'simple') => {
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
  const points = stops.map(stop => ({ ...project(stop.coordinates), label: stop.returnToBase ? '' : tripVideoStopLabel(stop.title || stop.location || ''), excursion: Boolean(stop.excursion), hidden: Boolean(stop.returnToBase) }));
  const legs: { x: number; y: number }[][] = [];
  let requests = 0;
  for (let index = 1; index < stops.length; index++) {
    const from = stops[index - 1], to = stops[index];
    let coordinates = [from.coordinates, to.coordinates];
    const travel = (trip.items || []).find(item => item.type === 'travel' && Math.abs((item.startDateOffset || 0) - (to.startDateOffset || 0)) < 0.5);
    const mode = to.excursion || to.returnToBase ? 'car' : travel?.transportMode;
    // At most eight bounded requests per render, never one per frame. Unsupported
    // transport and failed/missing routes retain an honest straight-line fallback.
    if (routeMode === 'realistic' && requests < 8 && !['plane', 'boat', 'train', 'na'].includes(mode || '')) {
      requests++;
      const profile = mode === 'walk' ? 'walking' : mode === 'bicycle' ? 'cycling' : 'driving';
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.coordinates.lng},${from.coordinates.lat};${to.coordinates.lng},${to.coordinates.lat}`);
      url.searchParams.set('access_token', token);
      url.searchParams.set('geometries', 'geojson'); url.searchParams.set('overview', 'simplified');
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const data = await response.json();
          const path = data.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(path) && path.length >= 2 && path.length <= 2000
            && path.every((p: unknown) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
            coordinates = path.map(([lng, lat]: number[]) => ({ lat, lng }));
          }
        }
      } catch { /* A failed directions lookup must not trigger render retries. */ }
    }
    legs.push(coordinates.map(project));
  }
  // Mapbox uses a 512px world at zoom zero; the shared viewport uses 256px.
  const mapUrl = new URL(`https://api.mapbox.com/styles/v1/mapbox/${styles[style]}/static/${viewport.center.lng.toFixed(6)},${viewport.center.lat.toFixed(6)},${Math.max(0, viewport.zoom - 1)},0/426x574@2x`);
  mapUrl.searchParams.set('access_token', token);
  return { points, legs, mapUrl: mapUrl.toString(), color: trip.mapColorMode === 'brand' ? '#4f46e5' : `#${getTripPrimaryCityColorHex(trip)}` };
};
