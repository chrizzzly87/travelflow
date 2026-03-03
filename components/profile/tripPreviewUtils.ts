import type { AppLanguage, ITrip, ITimelineItem } from '../../types';
import {
  DEFAULT_DISTANCE_UNIT,
  formatDistance,
  getHexFromColorClass,
  getTripDistanceKm,
} from '../../utils';

interface TripRangeOffsets {
  startOffset: number;
  endOffset: number;
}

export interface TripCityStop {
  id: string;
  title: string;
  startDateOffset: number;
  duration: number;
}

type TripMapPreviewVariant = 'standard' | 'accent';

interface MiniMapOptions {
  variant?: TripMapPreviewVariant;
}

type TripMapPreviewStyle = 'clean' | 'minimal' | 'standard' | 'dark' | 'cleanDark' | 'satellite';

const stripColorPrefix = (value: string): string => value.replace(/^0x/i, '').replace(/^#/, '').trim();

const normalizeCssColorToHex = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const rawHex = hexMatch[1];
    return rawHex.length === 3
      ? rawHex.split('').map((char) => `${char}${char}`).join('').toLowerCase()
      : rawHex.toLowerCase();
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) return null;

  const channels = rgbMatch[1]
    .split(',')
    .map((part) => Number(part.trim()))
    .slice(0, 3);

  if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return null;
  }

  return channels
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('');
};

const resolveMapColors = () => {
  const fallback = {
    start: '4f46e5',
    end: 'a5b4fc',
    waypoint: '6366f1',
    route: '4f46e5',
  };

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const styles = window.getComputedStyle(document.documentElement);
  const fromVar = (varName: string, fallbackHex: string) => {
    const normalized = normalizeCssColorToHex(styles.getPropertyValue(varName));
    return normalized || stripColorPrefix(fallbackHex);
  };

  return {
    start: fromVar('--tf-accent-600', fallback.start),
    end: fromVar('--tf-accent-300', fallback.end),
    waypoint: fromVar('--tf-accent-500', fallback.waypoint),
    route: fromVar('--tf-accent-600', fallback.route),
  };
};

const STANDARD_MAP_COLORS = {
  start: 'f97316',
  end: 'ef4444',
  waypoint: 'f97316',
  route: 'f97316',
};

const BRAND_ROUTE_COLOR = '4f46e5';

const DIRECT_STATIC_MAP_STYLE_TOKENS: Record<Exclude<TripMapPreviewStyle, 'standard' | 'satellite'>, string[]> = {
  clean: [
    'element:geometry|color:0xf9f9f9',
    'element:labels.icon|visibility:off',
    'element:labels.text.fill|color:0x757575',
    'element:labels.text.stroke|color:0xf9f9f9|weight:2',
    'feature:administrative|element:geometry|visibility:off',
    'feature:poi|visibility:off',
    'feature:road|element:geometry|color:0xe0e0e0',
    'feature:road|element:labels|visibility:off',
    'feature:transit|visibility:off',
    'feature:water|element:geometry|color:0xc9d6e5',
    'feature:water|element:labels|visibility:off',
  ],
  minimal: [
    'element:geometry|color:0xf5f5f5',
    'element:labels.icon|visibility:off',
    'element:labels.text.fill|color:0x616161',
    'element:labels.text.stroke|color:0xf5f5f5',
    'feature:administrative.country|element:geometry.stroke|color:0x9aa6b2|weight:1.4|visibility:on',
    'feature:administrative.province|element:geometry.stroke|color:0xd5dce3|weight:0.5',
    'feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd',
    'feature:poi|element:geometry|color:0xeeeeee',
    'feature:poi|element:labels.text.fill|color:0x757575',
    'feature:poi.park|element:geometry|color:0xe5e5e5',
    'feature:poi.park|element:labels.text.fill|color:0x9e9e9e',
    'feature:road|element:geometry|color:0xffffff',
    'feature:road.arterial|element:labels.text.fill|color:0x757575',
    'feature:road.highway|element:geometry|color:0xdadada',
    'feature:road.highway|element:labels.text.fill|color:0x616161',
    'feature:road.local|element:labels.text.fill|color:0x9e9e9e',
    'feature:transit.line|element:geometry|color:0xe5e5e5',
    'feature:transit.station|element:geometry|color:0xeeeeee',
    'feature:water|element:geometry|color:0xc9c9c9',
    'feature:water|element:labels.text.fill|color:0x9e9e9e',
  ],
  dark: [
    'element:geometry|color:0x1b2230',
    'element:labels.text.stroke|color:0x1b2230',
    'element:labels.text.fill|color:0xd0d8e2',
    'feature:administrative.locality|element:labels.text.fill|color:0xf3c98b',
    'feature:administrative.country|element:geometry.stroke|color:0x9fb3c8|weight:1.2|visibility:on',
    'feature:poi|element:labels.text.fill|color:0x8fb3c0',
    'feature:poi.park|element:geometry|color:0x1a3b3a',
    'feature:poi.park|element:labels.text.fill|color:0x8bc2b3',
    'feature:road|element:geometry|color:0x3a4558',
    'feature:road|element:geometry.stroke|color:0x243246',
    'feature:road|element:labels.text.fill|color:0xd5dde8',
    'feature:road.highway|element:geometry|color:0x566579',
    'feature:road.highway|element:geometry.stroke|color:0x2f3c4f',
    'feature:road.highway|element:labels.text.fill|color:0xf7ddb0',
    'feature:transit|element:geometry|color:0x34506b',
    'feature:transit.station|element:labels.text.fill|color:0x9fc6e5',
    'feature:water|element:geometry|color:0x0b3f5f',
    'feature:water|element:labels.text.fill|color:0xb7d5ea',
    'feature:water|element:labels.text.stroke|color:0x0b3f5f',
  ],
  cleanDark: [
    'element:geometry|color:0x1b2230',
    'element:labels.icon|visibility:off',
    'element:labels.text.fill|visibility:off',
    'element:labels.text.stroke|visibility:off',
    'feature:administrative|element:geometry|visibility:off',
    'feature:administrative.country|element:geometry.stroke|color:0x8ea3b7|weight:1.2|visibility:on',
    'feature:poi|visibility:off',
    'feature:road|visibility:off',
    'feature:transit|visibility:off',
    'feature:water|element:geometry|color:0x0b3f5f',
    'feature:water|element:labels|visibility:off',
  ],
};

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
};

const parsePreviewStyle = (value: string | null): TripMapPreviewStyle => {
  if (value === 'clean' || value === 'minimal' || value === 'standard' || value === 'dark' || value === 'cleanDark' || value === 'satellite') {
    return value;
  }
  return 'standard';
};

const parsePreviewCoords = (value: string | null): Array<{ lat: number; lng: number }> => {
  if (!value) return [];
  return value
    .split('|')
    .map((pair) => {
      const [latRaw, lngRaw] = pair.split(',');
      return {
        lat: Number(latRaw),
        lng: Number(lngRaw),
      };
    })
    .filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng));
};

const parsePreviewLegColors = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map((part) => stripColorPrefix(part))
    .map((part) => normalizeCssColorToHex(part.startsWith('#') ? part : `#${part}`) ?? normalizeCssColorToHex(part))
    .filter((part): part is string => typeof part === 'string' && part.length === 6);
};

const normalizeMapPreviewColor = (value: string | null, fallback: string): string => {
  if (!value) return stripColorPrefix(fallback);
  const normalized = normalizeCssColorToHex(value)
    ?? normalizeCssColorToHex(`#${stripColorPrefix(value)}`)
    ?? normalizeCssColorToHex(stripColorPrefix(value));
  return normalized || stripColorPrefix(fallback);
};

const resolveLegColor = (legColors: string[], index: number, fallback: string): string => {
  if (legColors.length === 0) return fallback;
  return legColors[index] || legColors[legColors.length - 1] || fallback;
};

const formatCoord = (coord: { lat: number; lng: number }): string => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;

export const buildDirectStaticMapPreviewUrlWithKey = (params: URLSearchParams, mapsApiKey: string): string | null => {
  const normalizedKey = mapsApiKey.trim();
  if (!normalizedKey) return null;

  const coords = parsePreviewCoords(params.get('coords'));
  if (coords.length === 0) return null;

  const style = parsePreviewStyle(params.get('style'));
  const w = clampInt(Number.parseInt(params.get('w') || '640', 10), 240, 1280);
  const h = clampInt(Number.parseInt(params.get('h') || '360', 10), 160, 960);
  const scale = clampInt(Number.parseInt(params.get('scale') || '2', 10), 1, 2);
  const colorMode = params.get('colorMode') === 'trip' ? 'trip' : 'brand';
  const pathColor = colorMode === 'trip'
    ? normalizeMapPreviewColor(params.get('pathColor'), BRAND_ROUTE_COLOR)
    : BRAND_ROUTE_COLOR;
  const requestedLegColors = parsePreviewLegColors(params.get('legColors'));
  const legColors = coords.slice(0, -1).map((_, index) => (
    colorMode === 'trip' ? resolveLegColor(requestedLegColors, index, pathColor) : BRAND_ROUTE_COLOR
  ));
  const startMarkerColor = normalizeMapPreviewColor(params.get('startMarkerColor'), legColors[0] || pathColor);
  const endMarkerColor = normalizeMapPreviewColor(
    params.get('endMarkerColor'),
    legColors[legColors.length - 1] || pathColor,
  );
  const waypointColor = normalizeMapPreviewColor(params.get('waypointColor'), pathColor);
  const directParams = new URLSearchParams();
  directParams.set('size', `${w}x${h}`);
  directParams.set('scale', String(scale));
  directParams.set('maptype', style === 'satellite' ? 'satellite' : 'roadmap');

  const language = params.get('language')?.trim();
  if (language) {
    directParams.set('language', language);
  }

  if (style === 'clean' || style === 'minimal' || style === 'dark' || style === 'cleanDark') {
    DIRECT_STATIC_MAP_STYLE_TOKENS[style].forEach((token) => {
      directParams.append('style', token);
    });
  }

  for (let index = 0; index < coords.length - 1; index += 1) {
    const legColor = resolveLegColor(legColors, index, pathColor);
    directParams.append('path', `color:0x${legColor}|weight:4|${formatCoord(coords[index])}|${formatCoord(coords[index + 1])}`);
  }

  const start = coords[0];
  const end = coords[coords.length - 1];
  directParams.append('markers', `size:mid|color:0x${startMarkerColor}|label:S|${formatCoord(start)}`);
  if (coords.length > 1) {
    directParams.append('markers', `size:mid|color:0x${endMarkerColor}|label:E|${formatCoord(end)}`);
  }

  coords.slice(1, -1).forEach((coord, index) => {
    const legWaypointColor = legColors[Math.min(index + 1, legColors.length - 1)] || waypointColor;
    directParams.append('markers', `size:tiny|color:0x${legWaypointColor}|${formatCoord(coord)}`);
  });

  directParams.set('key', normalizedKey);
  return `https://maps.googleapis.com/maps/api/staticmap?${directParams.toString()}`;
};

const resolveTripItemColorHex = (value?: string | null): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;

  const directHex = normalizeCssColorToHex(trimmed);
  if (directHex) return directHex;

  const resolvedHex = normalizeCssColorToHex(getHexFromColorClass(trimmed));
  return resolvedHex;
};

const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getTripCityItems = (trip: ITrip): ITimelineItem[] =>
  trip.items
    .filter((item) => item.type === 'city')
    .sort((a, b) => a.startDateOffset - b.startDateOffset);

export const getTripRangeOffsets = (trip: ITrip): TripRangeOffsets => {
  const cityItems = getTripCityItems(trip);
  const source = cityItems.length > 0 ? cityItems : trip.items;

  if (source.length === 0) {
    return { startOffset: 0, endOffset: 1 };
  }

  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;

  source.forEach((item) => {
    if (!Number.isFinite(item.startDateOffset) || !Number.isFinite(item.duration)) return;
    minStart = Math.min(minStart, item.startDateOffset);
    maxEnd = Math.max(maxEnd, item.startDateOffset + item.duration);
  });

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) {
    return { startOffset: 0, endOffset: 1 };
  }

  return { startOffset: minStart, endOffset: maxEnd };
};

export const getTripDateRange = (trip: ITrip): { start: Date; end: Date } => {
  const baseStart = parseLocalDate(trip.startDate);
  const range = getTripRangeOffsets(trip);
  const start = addDays(baseStart, Math.floor(range.startOffset));
  const end = addDays(baseStart, Math.ceil(range.endOffset) - 1);
  return { start, end };
};

export const getTripDurationDays = (trip: ITrip): number => {
  const range = getTripRangeOffsets(trip);
  return Math.max(1, Math.ceil(range.endOffset - range.startOffset));
};

export const formatTripDateRange = (trip: ITrip, locale: AppLanguage): string => {
  const { start, end } = getTripDateRange(trip);

  const currentYear = new Date().getFullYear();
  const includeYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;
  const fmt: Intl.DateTimeFormatOptions = includeYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' };

  return `${start.toLocaleDateString(locale, fmt)} - ${end.toLocaleDateString(locale, fmt)}`;
};

export const getTripCityStops = (trip: ITrip): TripCityStop[] =>
  getTripCityItems(trip).map((item) => ({
    id: item.id,
    title: item.title || item.location || 'City stop',
    startDateOffset: item.startDateOffset,
    duration: item.duration,
  }));

const formatTripMonths = (trip: ITrip, locale: AppLanguage): string => {
  const { start, end } = getTripDateRange(trip);
  const names: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    names.push(cursor.toLocaleDateString(locale, { month: 'long' }));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return names.join('/');
};

const buildDirectStaticMapPreviewUrl = (params: URLSearchParams): string | null => {
  const rawMapsApiKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined)
    : undefined;
  const mapsApiKey = typeof rawMapsApiKey === 'string' ? rawMapsApiKey : '';
  return buildDirectStaticMapPreviewUrlWithKey(params, mapsApiKey);
};

export const formatTripSummaryLine = (trip: ITrip, locale: AppLanguage = 'en'): string => {
  const days = getTripDurationDays(trip);
  const cityCount = getTripCityItems(trip).length;
  const cityLabel = cityCount === 1 ? 'city' : 'cities';
  const totalDistanceKm = getTripDistanceKm(trip.items);
  const distanceLabel = totalDistanceKm > 0
    ? formatDistance(totalDistanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 0 })
    : null;
  const distancePart = distanceLabel ? ` • ${distanceLabel}` : '';
  return `${days} ${days === 1 ? 'day' : 'days'} • ${formatTripMonths(trip, locale)} • ${cityCount} ${cityLabel}${distancePart}`;
};

export const buildMiniMapUrl = (
  trip: ITrip,
  mapLanguage: AppLanguage,
  options?: MiniMapOptions
): string | null => {
  const variant = options?.variant || 'standard';

  const coordinates = getTripCityItems(trip)
    .map((item) => ({
      coordinates: item.coordinates,
      colorHex: variant === 'standard' ? resolveTripItemColorHex(item.color) : null,
    }))
    .filter((item): item is { coordinates: { lat: number; lng: number }; colorHex: string | null } =>
      Boolean(item.coordinates && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng))
    );

  if (coordinates.length === 0) return null;

  const routeCoordinates = coordinates.slice(0, 30);
  const formatCoord = (coord: { lat: number; lng: number }) => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;
  const start = routeCoordinates[0];
  const end = routeCoordinates[routeCoordinates.length - 1];
  const mapColors = variant === 'accent' ? resolveMapColors() : STANDARD_MAP_COLORS;
  const pathColor = start.colorHex || mapColors.route;
  const legColors = routeCoordinates
    .slice(1)
    .map((coord) => coord.colorHex || mapColors.route);

  const params = new URLSearchParams();
  params.set('coords', routeCoordinates.map((coord) => formatCoord(coord.coordinates)).join('|'));
  params.set('style', variant === 'accent' ? 'clean' : 'standard');
  params.set('routeMode', 'simple');
  params.set('colorMode', 'trip');
  params.set('pathColor', pathColor);
  params.set('startMarkerColor', start.colorHex || mapColors.start);
  params.set('endMarkerColor', end.colorHex || mapColors.end);
  params.set('waypointColor', mapColors.waypoint);
  params.set('w', '640');
  params.set('h', '360');
  params.set('scale', '2');
  params.set('language', mapLanguage);

  if (legColors.length > 0) {
    params.set('legColors', legColors.join('|'));
  }

  const previewPath = `/api/trip-map-preview?${params.toString()}`;
  if (typeof window !== 'undefined') {
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalHost && window.location.port === '5173') {
      // `pnpm dev` does not guarantee a local Netlify edge runtime.
      // Fall back to a direct Static Maps URL for local-only preview reliability.
      return buildDirectStaticMapPreviewUrl(params) || previewPath;
    }
  }
  return previewPath;
};
