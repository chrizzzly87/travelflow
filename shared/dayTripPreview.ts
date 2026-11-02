/**
 * Day trips on the static trip previews: card map images, the OG image map,
 * the committed homepage PNGs and the lane under every trip card.
 *
 * A day trip is drawn like the planner map draws it — a dashed line from the
 * stay out to the destination (and back, or on to the stay the day ends at)
 * plus a pin at the destination. Static map providers cannot dash a line, so
 * the dashes are separate short segments.
 *
 * The lines are always straight. They never ask a Directions API for a route,
 * so adding day trips to a preview costs no upstream calls.
 *
 * Imported by edge functions: keep this module free of app-only imports.
 */

import { isDayTrip, resolveActivityStay, resolveDayTripReturnStay } from './activityStay.ts';

export const MAP_PREVIEW_DAY_TRIPS_PARAM = 'dayTrips';

/** More than this and a preview is a cloud of pins; the planner still shows all. */
export const MAX_MAP_PREVIEW_DAY_TRIPS = 12;

/** 12 entries of "29,-89.12345,-179.12345,aabbcc,29|" ≈ 420 chars. */
export const MAX_MAP_PREVIEW_DAY_TRIPS_PARAM_LENGTH = 600;

const DAY_TRIP_DASH_COUNT = 4;

type LatLng = { lat: number; lng: number };

/**
 * One day trip as a preview encodes it. `stayIndex` and `returnIndex` point
 * into the preview's own `coords` list, so the spoke starts exactly where the
 * route draws the stay.
 */
export interface MapPreviewDayTrip {
  stayIndex: number;
  destination: LatLng;
  /** Hex without `#`. */
  color: string;
  /** Present only when the day ends at another stay. */
  returnIndex?: number;
}

interface PreviewTimelineItem {
  id?: string;
  type?: string;
  title?: string;
  location?: string;
  activityKind?: string;
  startDateOffset?: number;
  duration?: number;
  stayCityId?: string;
  dayTripReturnCityId?: string;
  coordinates?: { lat: number; lng: number } | null;
}

const isFiniteLatLng = (value: unknown): value is LatLng => (
  Boolean(value)
  && typeof value === 'object'
  && Number.isFinite((value as LatLng).lat)
  && Number.isFinite((value as LatLng).lng)
  && Math.abs((value as LatLng).lat) <= 90
  && Math.abs((value as LatLng).lng) <= 180
);

const toStay = <T extends PreviewTimelineItem>(item: T) => ({
  item,
  id: item.id || '',
  startDateOffset: Number.isFinite(item.startDateOffset) ? Number(item.startDateOffset) : 0,
  duration: Number.isFinite(item.duration) ? Number(item.duration) : 0,
});

const toPlacedActivity = (item: PreviewTimelineItem) => ({
  startDateOffset: Number.isFinite(item.startDateOffset) ? Number(item.startDateOffset) : 0,
  stayCityId: item.stayCityId,
  dayTripReturnCityId: item.dayTripReturnCityId,
});

export interface ResolvedPreviewDayTrip<T extends PreviewTimelineItem> {
  item: T;
  stay: T;
  returnStay: T;
  destinationLabel: string;
}

/**
 * Day trips that can be drawn: a destination position and a stay with one.
 * Ownership goes through `shared/activityStay.ts`, like everywhere else.
 */
export const resolvePreviewDayTrips = <T extends PreviewTimelineItem>(items: T[]): Array<ResolvedPreviewDayTrip<T>> => {
  const stays = items
    .filter((item) => item.type === 'city' && isFiniteLatLng(item.coordinates))
    .map(toStay)
    .sort((left, right) => left.startDateOffset - right.startDateOffset);
  if (stays.length === 0) return [];

  return items
    .filter((item) => isDayTrip(item) && isFiniteLatLng(item.coordinates))
    .sort((left, right) => (left.startDateOffset ?? 0) - (right.startDateOffset ?? 0))
    .flatMap((item) => {
      const placed = toPlacedActivity(item);
      const stay = resolveActivityStay(placed, stays);
      if (!stay) return [];
      const returnStay = resolveDayTripReturnStay(placed, stays) ?? stay;
      const label = (item.location || item.title || '').split(',')[0].trim() || item.title || '';
      return [{ item, stay: stay.item, returnStay: returnStay.item, destinationLabel: label }];
    });
};

/**
 * The day trips of a preview whose stays are `routeStays`, in that order.
 * A day trip whose stay is not on the preview route is left out.
 */
export const buildMapPreviewDayTrips = <T extends PreviewTimelineItem>(
  items: T[],
  routeStays: T[],
  resolveColor: (stay: T, stayIndex: number) => string,
): MapPreviewDayTrip[] => (
  resolvePreviewDayTrips(items)
    .flatMap((dayTrip) => {
      const stayIndex = routeStays.indexOf(dayTrip.stay);
      if (stayIndex < 0) return [];
      const returnIndex = routeStays.indexOf(dayTrip.returnStay);
      const entry: MapPreviewDayTrip = {
        stayIndex,
        destination: { lat: dayTrip.item.coordinates!.lat, lng: dayTrip.item.coordinates!.lng },
        color: resolveColor(dayTrip.stay, stayIndex).replace(/^#/, '').toLowerCase(),
      };
      if (returnIndex >= 0 && returnIndex !== stayIndex) entry.returnIndex = returnIndex;
      return [entry];
    })
    .slice(0, MAX_MAP_PREVIEW_DAY_TRIPS)
);

export const serializeMapPreviewDayTrips = (dayTrips: MapPreviewDayTrip[]): string => (
  dayTrips
    .slice(0, MAX_MAP_PREVIEW_DAY_TRIPS)
    .map((dayTrip) => {
      const parts = [
        String(dayTrip.stayIndex),
        dayTrip.destination.lat.toFixed(5),
        dayTrip.destination.lng.toFixed(5),
        dayTrip.color,
      ];
      if (typeof dayTrip.returnIndex === 'number') parts.push(String(dayTrip.returnIndex));
      return parts.join(',');
    })
    .join('|')
);

const INDEX_PATTERN = /^\d{1,2}$/;
const COORD_PATTERN = /^-?\d{1,3}(?:\.\d{1,10})?$/;
const COLOR_PATTERN = /^[0-9a-f]{6}$/i;

/**
 * Forgiving on purpose: a malformed entry is dropped rather than failing the
 * whole preview, and indexes must point at a coordinate the preview has.
 */
export const parseMapPreviewDayTrips = (value: string | null, coordCount: number): MapPreviewDayTrip[] => {
  if (!value || value.length > MAX_MAP_PREVIEW_DAY_TRIPS_PARAM_LENGTH) return [];
  return value
    .split('|')
    .slice(0, MAX_MAP_PREVIEW_DAY_TRIPS)
    .flatMap((entry) => {
      const [stayRaw, latRaw, lngRaw, colorRaw, returnRaw] = entry.trim().split(',');
      if (!INDEX_PATTERN.test(stayRaw || '') || !COORD_PATTERN.test(latRaw || '') || !COORD_PATTERN.test(lngRaw || '')) {
        return [];
      }
      const stayIndex = Number(stayRaw);
      const destination = { lat: Number(latRaw), lng: Number(lngRaw) };
      if (stayIndex >= coordCount || !isFiniteLatLng(destination)) return [];
      const color = COLOR_PATTERN.test(colorRaw || '') ? colorRaw.toLowerCase() : '';
      const parsed: MapPreviewDayTrip = { stayIndex, destination, color };
      if (returnRaw !== undefined && INDEX_PATTERN.test(returnRaw)) {
        const returnIndex = Number(returnRaw);
        if (returnIndex < coordCount && returnIndex !== stayIndex) parsed.returnIndex = returnIndex;
      }
      return [parsed];
    });
};

/** A straight line cut into `dashCount` dashes with equal gaps between them. */
export const buildDashedSegments = (from: LatLng, to: LatLng, dashCount = DAY_TRIP_DASH_COUNT): Array<[LatLng, LatLng]> => {
  const steps = dashCount * 2 - 1;
  const at = (fraction: number): LatLng => ({
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  });
  const segments: Array<[LatLng, LatLng]> = [];
  for (let index = 0; index < steps; index += 2) {
    segments.push([at(index / steps), at((index + 1) / steps)]);
  }
  return segments;
};

/** The legs a day trip draws: out and back, or out and on to another stay. */
export const listDayTripLegs = (dayTrip: MapPreviewDayTrip, coords: LatLng[]): Array<[LatLng, LatLng]> => {
  const stay = coords[dayTrip.stayIndex];
  if (!stay) return [];
  const legs: Array<[LatLng, LatLng]> = [[stay, dayTrip.destination]];
  const returnStay = typeof dayTrip.returnIndex === 'number' ? coords[dayTrip.returnIndex] : undefined;
  if (returnStay) legs.push([dayTrip.destination, returnStay]);
  return legs;
};

const formatLngLat = (coord: LatLng): string => `${coord.lng.toFixed(5)},${coord.lat.toFixed(5)}`;
const formatLatLng = (coord: LatLng): string => `${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`;

const encodePolylineValue = (value: number): string => {
  let current = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';
  while (current >= 0x20) {
    encoded += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
    current >>= 5;
  }
  return encoded + String.fromCharCode(current + 63);
};

const encodeSegmentPolyline = ([from, to]: [LatLng, LatLng]): string => {
  const fromLat = Math.round(from.lat * 1e5);
  const fromLng = Math.round(from.lng * 1e5);
  return encodePolylineValue(fromLat)
    + encodePolylineValue(fromLng)
    + encodePolylineValue(Math.round(to.lat * 1e5) - fromLat)
    + encodePolylineValue(Math.round(to.lng * 1e5) - fromLng);
};

/**
 * Mapbox Static Images overlays: one short path per dash, then one pin per
 * destination. Callers put the pins last so they sit above the route.
 */
export const buildMapboxDayTripOverlays = (
  dayTrips: MapPreviewDayTrip[],
  coords: LatLng[],
  fallbackColor: string,
): { paths: string[]; pins: string[] } => {
  const paths: string[] = [];
  const pins: string[] = [];
  dayTrips.forEach((dayTrip) => {
    const color = dayTrip.color || fallbackColor;
    listDayTripLegs(dayTrip, coords).forEach(([from, to]) => {
      buildDashedSegments(from, to).forEach((dash) => {
        paths.push(`path-3+${color}-0.9(${encodeSegmentPolyline(dash)})`);
      });
    });
    pins.push(`pin-s-attraction+${color}(${formatLngLat(dayTrip.destination)})`);
  });
  return { paths, pins };
};

const darkenHex = (hex: string, amount = 48): string => {
  if (!COLOR_PATTERN.test(hex)) return hex;
  return [0, 2, 4]
    .map((index) => Math.max(0, Number.parseInt(hex.slice(index, index + 2), 16) - amount).toString(16).padStart(2, '0'))
    .join('');
};

/** Google Static Maps `path` and `markers` values (without the `path=` prefix). */
export const buildGoogleDayTripParams = (
  dayTrips: MapPreviewDayTrip[],
  coords: LatLng[],
  fallbackColor: string,
): { paths: string[]; markers: string[] } => {
  const paths: string[] = [];
  const markers: string[] = [];
  dayTrips.forEach((dayTrip) => {
    const color = dayTrip.color || fallbackColor;
    listDayTripLegs(dayTrip, coords).forEach(([from, to]) => {
      buildDashedSegments(from, to).forEach(([dashFrom, dashTo]) => {
        paths.push(`color:0x${color}e6|weight:3|${formatLatLng(dashFrom)}|${formatLatLng(dashTo)}`);
      });
    });
    // Tiny, like a stay waypoint, but a shade darker: a larger pin would
    // outrank the stay it belongs to at country zoom.
    markers.push(`size:tiny|color:0x${darkenHex(color)}|${formatLatLng(dayTrip.destination)}`);
  });
  return { paths, markers };
};

export interface TripLaneDayTripMark {
  id: string;
  label: string;
  /** 0–1 along the stay's lane segment. */
  position: number;
}

/**
 * Day trips grouped by the stay lane they sit on, positioned at the middle of
 * their day. Keyed by stay id; stays without day trips have no entry.
 */
export const buildTripLaneDayTripMarks = <T extends PreviewTimelineItem>(items: T[]): Map<string, TripLaneDayTripMark[]> => {
  const marks = new Map<string, TripLaneDayTripMark[]>();
  const stays = items
    .filter((item) => item.type === 'city')
    .map(toStay)
    .sort((left, right) => left.startDateOffset - right.startDateOffset);
  if (stays.length === 0) return marks;

  items
    .filter((item) => isDayTrip(item))
    .sort((left, right) => (left.startDateOffset ?? 0) - (right.startDateOffset ?? 0))
    .forEach((item) => {
      const stay = resolveActivityStay(toPlacedActivity(item), stays);
      if (!stay?.id) return;
      const start = Number.isFinite(item.startDateOffset) ? Number(item.startDateOffset) : stay.startDateOffset;
      const dayMiddle = Math.floor(start + 0.00001) + 0.5;
      const span = Math.max(stay.duration, 0.5);
      const position = Math.min(0.92, Math.max(0.08, (dayMiddle - stay.startDateOffset) / span));
      const label = (item.location || item.title || '').split(',')[0].trim() || item.title || '';
      const list = marks.get(stay.id) || [];
      list.push({ id: item.id || `${stay.id}-day-trip-${list.length}`, label, position });
      marks.set(stay.id, list);
    });
  return marks;
};
