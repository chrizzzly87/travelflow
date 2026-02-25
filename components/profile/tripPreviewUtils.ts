import type { AppLanguage, ITrip, ITimelineItem } from '../../types';
import {
  DEFAULT_DISTANCE_UNIT,
  formatDistance,
  getGoogleMapsApiKey,
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

const TOOLTIP_CLEAN_STYLE = [
  'style=element:geometry|color:0xf9f9f9',
  'style=element:labels.icon|visibility:off',
  'style=element:labels.text.fill|color:0x757575',
  'style=element:labels.text.stroke|color:0xf9f9f9|weight:2',
  'style=feature:administrative|element:geometry|visibility:off',
  'style=feature:administrative.country|element:geometry.stroke|color:0xa8a8a8|weight:1.6|visibility:on',
  'style=feature:administrative.province|element:geometry|visibility:off',
  'style=feature:administrative.province|element:labels|visibility:off',
  'style=feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd',
  'style=feature:poi|visibility:off',
  'style=feature:road|visibility:off',
  'style=feature:transit|visibility:off',
  'style=feature:water|element:geometry|color:0xdcefff',
  'style=feature:water|element:geometry.stroke|color:0x8fb6d9|weight:2.2|visibility:on',
  'style=feature:landscape.natural|element:geometry.stroke|color:0xa7c9e6|weight:1.4|visibility:on',
  'style=feature:water|element:labels.text.fill|color:0x9e9e9e',
].join('&');

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

export const buildMiniMapUrl = (trip: ITrip, mapLanguage: AppLanguage): string | null => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const coordinates = getTripCityItems(trip)
    .map((item) => item.coordinates)
    .filter((coord): coord is { lat: number; lng: number } =>
      Boolean(coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng))
    );

  if (coordinates.length === 0) return null;

  const routeCoordinates = coordinates.slice(0, 30);
  const formatCoord = (coord: { lat: number; lng: number }) => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;

  const markerParams: string[] = [];
  const visibleParams: string[] = [];
  const start = routeCoordinates[0];
  const end = routeCoordinates[routeCoordinates.length - 1];
  const mapColors = resolveMapColors();

  markerParams.push(`markers=${encodeURIComponent(`size:mid|color:0x${mapColors.start}|label:S|${formatCoord(start)}`)}`);
  if (routeCoordinates.length > 1) {
    markerParams.push(`markers=${encodeURIComponent(`size:mid|color:0x${mapColors.end}|label:E|${formatCoord(end)}`)}`);
  }

  routeCoordinates.slice(1, -1).slice(0, 18).forEach((coord) => {
    markerParams.push(`markers=${encodeURIComponent(`size:tiny|color:0x${mapColors.waypoint}|${formatCoord(coord)}`)}`);
  });

  routeCoordinates.forEach((coord) => {
    visibleParams.push(`visible=${encodeURIComponent(formatCoord(coord))}`);
  });

  const pathParams: string[] = [];
  if (routeCoordinates.length > 1) {
    pathParams.push(
      `path=${encodeURIComponent(`color:0x${mapColors.route}|weight:4|${routeCoordinates.map(formatCoord).join('|')}`)}`
    );
  }

  const markerQuery = markerParams.join('&');
  const visibleQuery = visibleParams.join('&');
  const pathQuery = pathParams.length > 0 ? `&${pathParams.join('&')}` : '';

  return `https://maps.googleapis.com/maps/api/staticmap?size=480x640&scale=2&maptype=roadmap&${TOOLTIP_CLEAN_STYLE}&language=${encodeURIComponent(mapLanguage)}&${visibleQuery}&${markerQuery}${pathQuery}&key=${encodeURIComponent(apiKey)}`;
};
