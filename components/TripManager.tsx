import React from 'react';
import { ITrip, ITimelineItem } from '../types';
import { X, Trash2, Star, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { getAllTrips, deleteTrip, saveTrip } from '../services/storageService';
import { COUNTRIES, getGoogleMapsApiKey } from '../utils';

interface TripManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip: (trip: ITrip) => void;
  currentTripId?: string;
  onUpdateTrip?: (trip: ITrip) => void;
}

interface TripBuckets {
  thisWeek: ITrip[];
  thisMonth: ITrip[];
  older: ITrip[];
}

interface TripRangeOffsets {
  startOffset: number;
  endOffset: number;
}

interface HoverAnchor {
  tripId: string;
  rect: DOMRect;
}

interface TooltipPosition {
  left: number;
  top: number;
  width: number;
  height: number;
  side: 'left' | 'right';
}

interface CountryMatch {
  code: string;
  name: string;
  flag: string;
}

const COUNTRY_CACHE_KEY = 'travelflow_country_cache_v1';

const COUNTRY_BY_NAME = new Map(
  COUNTRIES.map(country => [normalizeCountryToken(country.name), country] as const)
);
const COUNTRY_BY_CODE = new Map(
  COUNTRIES.map(country => [country.code.toLowerCase(), country] as const)
);

const COUNTRY_ALIASES = new Map<string, string>([
  ['usa', 'unitedstates'],
  ['us', 'unitedstates'],
  ['unitedstatesofamerica', 'unitedstates'],
  ['uk', 'unitedkingdom'],
  ['greatbritain', 'unitedkingdom'],
  ['uae', 'unitedarabemirates'],
  ['czechia', 'czechrepublic'],
]);

function normalizeCountryToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && parts.every(part => Number.isFinite(part))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getTripCityItems = (trip: ITrip): ITimelineItem[] =>
  trip.items
    .filter(item => item.type === 'city')
    .sort((a, b) => a.startDateOffset - b.startDateOffset);

const getTripRangeOffsets = (trip: ITrip): TripRangeOffsets => {
  const cityItems = getTripCityItems(trip);
  const source = cityItems.length > 0 ? cityItems : trip.items;

  if (source.length === 0) {
    return { startOffset: 0, endOffset: 1 };
  }

  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;

  source.forEach(item => {
    if (!Number.isFinite(item.startDateOffset) || !Number.isFinite(item.duration)) return;
    minStart = Math.min(minStart, item.startDateOffset);
    maxEnd = Math.max(maxEnd, item.startDateOffset + item.duration);
  });

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) {
    return { startOffset: 0, endOffset: 1 };
  }

  return { startOffset: minStart, endOffset: maxEnd };
};

const getTripDurationDays = (trip: ITrip): number => {
  const range = getTripRangeOffsets(trip);
  return Math.max(1, Math.ceil(range.endOffset - range.startOffset));
};

const getTripCityStops = (trip: ITrip) =>
  getTripCityItems(trip).map(item => ({
    id: item.id,
    title: item.title || item.location || 'City stop',
    startDateOffset: item.startDateOffset,
    duration: item.duration,
  }));

const formatTripDateRange = (trip: ITrip): string => {
  const baseStart = parseLocalDate(trip.startDate);
  const range = getTripRangeOffsets(trip);
  const start = addDays(baseStart, Math.floor(range.startOffset));
  const end = addDays(baseStart, Math.ceil(range.endOffset) - 1);

  const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString(undefined, fmt)} - ${end.toLocaleDateString(undefined, fmt)}`;
};

const formatTripMonths = (trip: ITrip): string => {
  const baseStart = parseLocalDate(trip.startDate);
  const range = getTripRangeOffsets(trip);
  const start = addDays(baseStart, Math.floor(range.startOffset));
  const end = addDays(baseStart, Math.ceil(range.endOffset) - 1);

  const names: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    names.push(cursor.toLocaleDateString(undefined, { month: 'long' }));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return names.join('/');
};

const formatTripSummaryLine = (trip: ITrip): string => {
  const days = getTripDurationDays(trip);
  const cityCount = getTripCityItems(trip).length;
  const cityLabel = cityCount === 1 ? 'city' : 'cities';
  return `${days} ${days === 1 ? 'day' : 'days'} • ${formatTripMonths(trip)} • ${cityCount} ${cityLabel}`;
};

const formatCityStay = (duration: number): string => {
  const days = Math.max(1, Math.ceil(Number.isFinite(duration) ? duration : 1));
  const nights = Math.max(0, days - 1);
  return `${days} ${days === 1 ? 'day' : 'days'} • ${nights} ${nights === 1 ? 'night' : 'nights'}`;
};

const getCountryFromToken = (token: string): CountryMatch | null => {
  const normalized = normalizeCountryToken(token);
  if (!normalized) return null;

  const alias = COUNTRY_ALIASES.get(normalized) || normalized;
  const fromName = COUNTRY_BY_NAME.get(alias);
  if (fromName) {
    return { code: fromName.code, name: fromName.name, flag: fromName.flag };
  }

  const fromCode = COUNTRY_BY_CODE.get(alias);
  if (fromCode) {
    return { code: fromCode.code, name: fromCode.name, flag: fromCode.flag };
  }

  return null;
};

const parseCountryFromText = (item: ITimelineItem): CountryMatch | null => {
  const values = [item.location, item.title].filter(Boolean) as string[];

  for (const value of values) {
    const tokens = value
      .split(/[,\-|/]/g)
      .map(token => token.trim())
      .filter(Boolean);

    for (let i = tokens.length - 1; i >= 0; i--) {
      const match = getCountryFromToken(tokens[i]);
      if (match) return match;
    }
  }

  return null;
};

const getCountryFromStoredFields = (item: ITimelineItem): CountryMatch | null => {
  if (item.countryCode) {
    const byCode = COUNTRY_BY_CODE.get(item.countryCode.toLowerCase());
    if (byCode) return { code: byCode.code, name: byCode.name, flag: byCode.flag };
  }
  if (item.countryName) {
    const byName = COUNTRY_BY_NAME.get(normalizeCountryToken(item.countryName));
    if (byName) return { code: byName.code, name: byName.name, flag: byName.flag };
  }
  return null;
};

const getTripFlags = (trip: ITrip): string[] => {
  const seen = new Set<string>();
  const flags: string[] = [];

  getTripCityItems(trip).forEach(item => {
    const parsed = parseCountryFromText(item);
    const stored = getCountryFromStoredFields(item);
    const match = parsed || stored;
    if (!match) return;
    if (seen.has(match.code)) return;
    seen.add(match.code);
    flags.push(match.flag);
  });

  return flags.length > 0 ? flags : ['🌍'];
};

const buildMiniMapUrl = (trip: ITrip): string | null => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return null;

  const coordinates = getTripCityItems(trip)
    .map(item => item.coordinates)
    .filter((coord): coord is { lat: number; lng: number } =>
      Boolean(coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng))
    );

  if (coordinates.length === 0) return null;

  const markerParams = coordinates
    .slice(0, 20)
    .map(coord => `markers=${encodeURIComponent(`size:tiny|color:0x7c3aed|${coord.lat},${coord.lng}`)}`)
    .join('&');

  const path = coordinates.length > 1
    ? `&path=${encodeURIComponent(`color:0x7c3aed|weight:3|${coordinates.slice(0, 30).map(coord => `${coord.lat},${coord.lng}`).join('|')}`)}`
    : '';

  const cleanStyle = [
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
    'style=feature:water|element:geometry|color:0xe3f2fd',
    'style=feature:water|element:labels.text.fill|color:0x9e9e9e',
  ].join('&');

  return `https://maps.googleapis.com/maps/api/staticmap?size=640x360&scale=2&maptype=roadmap&${cleanStyle}&${markerParams}${path}&key=${encodeURIComponent(apiKey)}`;
};

const bucketTripsByRecency = (trips: ITrip[]): TripBuckets => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeekTs = startOfWeek.getTime();
  const startOfMonthTs = startOfMonth.getTime();

  const buckets: TripBuckets = { thisWeek: [], thisMonth: [], older: [] };
  trips.forEach(trip => {
    const updatedAt = Number.isFinite(trip.updatedAt) ? trip.updatedAt : 0;
    if (updatedAt >= startOfWeekTs) buckets.thisWeek.push(trip);
    else if (updatedAt >= startOfMonthTs) buckets.thisMonth.push(trip);
    else buckets.older.push(trip);
  });

  return buckets;
};

const computeTooltipPosition = (anchorRect: DOMRect): TooltipPosition => {
  const width = 560;
  const height = 290;
  const gutter = 12;
  const margin = 8;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  const canOpenRight = anchorRect.right + gutter + width <= viewportWidth - margin;
  const side: TooltipPosition['side'] = canOpenRight ? 'right' : 'left';

  let left = side === 'right'
    ? anchorRect.right + gutter
    : anchorRect.left - width - gutter;
  left = Math.max(margin, Math.min(left, viewportWidth - width - margin));

  let top = anchorRect.top + anchorRect.height / 2 - height / 2;
  top = Math.max(margin, Math.min(top, viewportHeight - height - margin));

  return { left, top, width, height, side };
};

const computeHoverBridgeStyle = (anchorRect: DOMRect, tooltip: TooltipPosition): React.CSSProperties | null => {
  const startX = tooltip.side === 'right' ? anchorRect.right : tooltip.left + tooltip.width;
  const endX = tooltip.side === 'right' ? tooltip.left : anchorRect.left;
  const width = Math.abs(endX - startX);
  if (width < 2) return null;

  const anchorMidY = anchorRect.top + anchorRect.height / 2;
  const tooltipMidY = tooltip.top + tooltip.height / 2;
  const top = Math.min(anchorMidY, tooltipMidY) - 42;
  const height = Math.abs(anchorMidY - tooltipMidY) + 84;

  return {
    position: 'fixed',
    left: Math.min(startX, endX),
    top,
    width,
    height,
    background: 'transparent',
    zIndex: 1395,
  };
};

interface FolderHeaderProps {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}

const FolderHeader: React.FC<FolderHeaderProps> = ({ label, count, isOpen, onToggle }) => (
  <div className="group flex items-center justify-between px-2 py-1">
    <button
      type="button"
      onClick={onToggle}
      className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 hover:text-gray-600 transition-colors"
    >
      {label} <span className="text-gray-300">{count}</span>
    </button>
    <button
      type="button"
      onClick={onToggle}
      className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all"
      aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
      title={isOpen ? `Collapse ${label}` : `Expand ${label}`}
    >
      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
    </button>
  </div>
);

interface TripRowProps {
  trip: ITrip;
  currentTripId?: string;
  onSelectTrip: (trip: ITrip) => void;
  onToggleFavorite: (trip: ITrip) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onHoverAnchor: (tripId: string, rect: DOMRect) => void;
  onHoverEnd: () => void;
}

const TripRow: React.FC<TripRowProps> = ({
  trip,
  currentTripId,
  onSelectTrip,
  onToggleFavorite,
  onDelete,
  onHoverAnchor,
  onHoverEnd,
}) => {
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const flags = React.useMemo(() => getTripFlags(trip), [trip]);
  const displayFlags = flags.slice(0, 3).join(' ');
  const extraFlags = Math.max(0, flags.length - 3);
  const showFavoriteByDefault = Boolean(trip.isFavorite);

  const emitHoverAnchor = () => {
    if (!rowRef.current) return;
    onHoverAnchor(trip.id, rowRef.current.getBoundingClientRect());
  };

  return (
    <div
      ref={rowRef}
      className={`group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors ${
        trip.id === currentTripId ? 'bg-indigo-50' : 'hover:bg-gray-50'
      }`}
      onMouseEnter={emitHoverAnchor}
      onMouseMove={emitHoverAnchor}
      onMouseLeave={onHoverEnd}
    >
      <button
        type="button"
        onClick={() => onSelectTrip(trip)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm leading-none">{displayFlags}</span>
          {extraFlags > 0 && <span className="text-[10px] text-gray-300">+{extraFlags}</span>}
          <span className={`truncate text-sm font-medium ${trip.id === currentTripId ? 'text-indigo-700' : 'text-gray-700'}`}>
            {trip.title}
          </span>
        </div>
        <div className="text-[11px] text-gray-400 mt-0.5">{formatTripSummaryLine(trip)}</div>
      </button>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => onDelete(e, trip.id)}
          className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete trip"
          aria-label="Delete trip"
        >
          <Trash2 size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(trip);
          }}
          className={`p-1.5 rounded-md hover:bg-amber-50 transition-colors ${
            showFavoriteByDefault ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          title={trip.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={trip.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={14}
            className={trip.isFavorite ? 'text-amber-500 fill-amber-400' : 'text-gray-300 hover:text-amber-500'}
          />
        </button>
      </div>
    </div>
  );
};

interface TripTooltipProps {
  trip: ITrip;
  position: TooltipPosition;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

const TripTooltip: React.FC<TripTooltipProps> = ({ trip, position, onHoverStart, onHoverEnd }) => {
  const [shouldLoadMap, setShouldLoadMap] = React.useState(false);
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);

  React.useEffect(() => {
    setShouldLoadMap(false);
    setMapLoaded(false);
    setMapError(false);
    const timer = window.setTimeout(() => setShouldLoadMap(true), 80);
    return () => window.clearTimeout(timer);
  }, [trip.id, position.left, position.top]);

  const mapUrl = React.useMemo(() => {
    if (!shouldLoadMap) return null;
    return buildMiniMapUrl(trip);
  }, [shouldLoadMap, trip]);

  const cityStops = React.useMemo(() => getTripCityStops(trip), [trip]);

  return (
    <div
      className="fixed z-[1400]"
      style={{ left: position.left, top: position.top, width: position.width, height: position.height }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div className="h-full w-full rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="grid grid-cols-2 h-full">
          <div className="p-3.5 flex flex-col gap-3 border-r border-gray-100 min-h-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{trip.title}</div>
              <div className="text-sm font-semibold text-purple-600 mt-1">{formatTripDateRange(trip)}</div>
            </div>

            <div className="min-h-0 flex-1 flex flex-col">
              <span className="uppercase tracking-wide text-[10px] text-gray-400 font-semibold">City Stays</span>
              <div className="mt-1.5 space-y-1.5 overflow-y-auto pr-1">
                {cityStops.length === 0 ? (
                  <div className="text-[11px] text-gray-400">No city stops yet</div>
                ) : (
                  cityStops.map((stop, idx) => (
                    <div key={stop.id} className="text-[11px] text-gray-600 leading-tight">
                      <div className="font-medium text-gray-700">{idx + 1}. {stop.title}</div>
                      <div className="text-gray-400">{formatCityStay(stop.duration)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-gray-50">
            <div className="h-full w-full rounded-lg border border-gray-200 bg-gray-100 overflow-hidden relative">
              {shouldLoadMap ? (
                mapUrl && !mapError ? (
                  <>
                    {!mapLoaded && <div className="absolute inset-0 animate-pulse bg-gray-200" />}
                    <img
                      src={mapUrl}
                      alt={`Map preview for ${trip.title}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onLoad={() => setMapLoaded(true)}
                      onError={() => setMapError(true)}
                    />
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-500">
                    Map preview unavailable
                  </div>
                )
              ) : (
                <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-500">
                  Loading preview...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BucketListProps {
  label: string;
  trips: ITrip[];
  currentTripId?: string;
  onSelectTrip: (trip: ITrip) => void;
  onToggleFavorite: (trip: ITrip) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onHoverAnchor: (tripId: string, rect: DOMRect) => void;
  onHoverEnd: () => void;
}

const BucketList: React.FC<BucketListProps> = ({
  label,
  trips,
  currentTripId,
  onSelectTrip,
  onToggleFavorite,
  onDelete,
  onHoverAnchor,
  onHoverEnd,
}) => {
  if (trips.length === 0) return null;

  return (
    <div className="space-y-1">
      {label && <div className="px-2 pt-1 text-[10px] uppercase tracking-wide font-semibold text-gray-300">{label}</div>}
      <div className="space-y-0.5">
        {trips.map(trip => (
          <TripRow
            key={trip.id}
            trip={trip}
            currentTripId={currentTripId}
            onSelectTrip={onSelectTrip}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
            onHoverAnchor={onHoverAnchor}
            onHoverEnd={onHoverEnd}
          />
        ))}
      </div>
    </div>
  );
};

export const TripManager: React.FC<TripManagerProps> = ({
  isOpen,
  onClose,
  onSelectTrip,
  currentTripId,
  onUpdateTrip,
}) => {
  const [trips, setTrips] = React.useState<ITrip[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [favoritesOpen, setFavoritesOpen] = React.useState(true);
  const [tripsOpen, setTripsOpen] = React.useState(true);
  const [showOlderFavorites, setShowOlderFavorites] = React.useState(false);
  const [showOlderTrips, setShowOlderTrips] = React.useState(false);
  const [hoverAnchor, setHoverAnchor] = React.useState<HoverAnchor | null>(null);

  const closeHoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEnrichingRef = React.useRef(false);
  const countryCacheRef = React.useRef<Record<string, { countryCode: string; countryName: string }>>({});

  const cancelHoverClose = React.useCallback(() => {
    if (closeHoverTimerRef.current) {
      clearTimeout(closeHoverTimerRef.current);
      closeHoverTimerRef.current = null;
    }
  }, []);

  const hideHoverNow = React.useCallback(() => {
    cancelHoverClose();
    setHoverAnchor(null);
  }, [cancelHoverClose]);

  const scheduleHoverClose = React.useCallback(() => {
    cancelHoverClose();
    closeHoverTimerRef.current = setTimeout(() => setHoverAnchor(null), 220);
  }, [cancelHoverClose]);

  React.useEffect(() => {
    return () => cancelHoverClose();
  }, [cancelHoverClose]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(COUNTRY_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        countryCacheRef.current = parsed;
      }
    } catch {
      countryCacheRef.current = {};
    }
  }, []);

  const persistCountryCache = React.useCallback(() => {
    try {
      localStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify(countryCacheRef.current));
    } catch {
      // ignore cache persistence failures
    }
  }, []);

  const getCountryCacheKey = React.useCallback((lat: number, lng: number) => {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  }, []);

  const reverseGeocodeCountry = React.useCallback(async (lat: number, lng: number): Promise<CountryMatch | null> => {
    const key = getCountryCacheKey(lat, lng);
    const cached = countryCacheRef.current[key];
    if (cached) {
      const byCode = COUNTRY_BY_CODE.get(cached.countryCode.toLowerCase());
      if (byCode) return { code: byCode.code, name: byCode.name, flag: byCode.flag };
      return null;
    }

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) return null;

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&result_type=country&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const payload = await response.json();
      if (!Array.isArray(payload?.results) || payload.results.length === 0) return null;

      const components = payload.results[0]?.address_components;
      if (!Array.isArray(components)) return null;

      const countryComponent = components.find((component: any) =>
        Array.isArray(component?.types) && component.types.includes('country')
      );
      if (!countryComponent) return null;

      const shortName = String(countryComponent.short_name || '').toLowerCase();
      const longName = String(countryComponent.long_name || '');
      const byCode = COUNTRY_BY_CODE.get(shortName);
      if (!byCode) return null;

      countryCacheRef.current[key] = {
        countryCode: byCode.code,
        countryName: longName || byCode.name,
      };
      persistCountryCache();

      return { code: byCode.code, name: byCode.name, flag: byCode.flag };
    } catch {
      return null;
    }
  }, [getCountryCacheKey, persistCountryCache]);

  const loadTrips = React.useCallback(() => {
    setTrips(getAllTrips());
  }, []);

  const enrichTripsWithCountryData = React.useCallback(async (sourceTrips: ITrip[]) => {
    if (isEnrichingRef.current) return;
    isEnrichingRef.current = true;

    try {
      let hasChanges = false;

      for (const trip of sourceTrips) {
        let tripChanged = false;
        const nextItems: ITimelineItem[] = [];

        for (const item of trip.items) {
          if (item.type !== 'city') {
            nextItems.push(item);
            continue;
          }

          const parsed = parseCountryFromText(item);
          const geocoded = item.coordinates && Number.isFinite(item.coordinates.lat) && Number.isFinite(item.coordinates.lng)
            ? await reverseGeocodeCountry(item.coordinates.lat, item.coordinates.lng)
            : null;
          const stored = getCountryFromStoredFields(item);
          const resolved = geocoded || parsed || stored;

          if (!resolved) {
            nextItems.push(item);
            continue;
          }

          const needsUpdate = item.countryCode !== resolved.code || item.countryName !== resolved.name;
          if (!needsUpdate) {
            nextItems.push(item);
            continue;
          }

          tripChanged = true;
          nextItems.push({
            ...item,
            countryCode: resolved.code,
            countryName: resolved.name,
          });
        }

        if (!tripChanged) continue;

        const updatedTrip: ITrip = { ...trip, items: nextItems };
        saveTrip(updatedTrip, { preserveUpdatedAt: true });
        if (onUpdateTrip && currentTripId === updatedTrip.id) {
          onUpdateTrip(updatedTrip);
        }
        hasChanges = true;
      }

      if (hasChanges) {
        setTrips(getAllTrips());
      }
    } finally {
      isEnrichingRef.current = false;
    }
  }, [currentTripId, onUpdateTrip, reverseGeocodeCountry]);

  React.useEffect(() => {
    if (isOpen) {
      const loaded = getAllTrips();
      setTrips(loaded);
      void enrichTripsWithCountryData(loaded);
    } else {
      hideHoverNow();
    }
  }, [isOpen, enrichTripsWithCountryData, hideHoverNow]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this trip?")) {
      deleteTrip(id);
      if (hoverAnchor?.tripId === id) hideHoverNow();
      loadTrips();
    }
  };

  const handleToggleFavorite = (trip: ITrip) => {
    const updatedTrip: ITrip = {
      ...trip,
      isFavorite: !trip.isFavorite,
      updatedAt: Date.now(),
    };

    saveTrip(updatedTrip);
    if (onUpdateTrip && currentTripId === updatedTrip.id) {
      onUpdateTrip(updatedTrip);
    }
    loadTrips();
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredTrips = React.useMemo(() => {
    if (!normalizedQuery) return trips;

    return trips.filter(trip => {
      const haystack = [
        trip.title,
        ...getTripCityItems(trip).flatMap(item => [item.title || '', item.location || '', item.countryName || '', item.countryCode || '']),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [trips, normalizedQuery]);

  const favoriteTrips = React.useMemo(() => filteredTrips.filter(trip => !!trip.isFavorite), [filteredTrips]);
  const regularTrips = React.useMemo(() => filteredTrips.filter(trip => !trip.isFavorite), [filteredTrips]);

  const favoriteBuckets = React.useMemo(() => bucketTripsByRecency(favoriteTrips), [favoriteTrips]);
  const regularBuckets = React.useMemo(() => bucketTripsByRecency(regularTrips), [regularTrips]);
  const forceExpandOlder = normalizedQuery.length > 0;

  const hoveredTrip = React.useMemo(() => {
    if (!hoverAnchor) return null;
    return filteredTrips.find(trip => trip.id === hoverAnchor.tripId) || null;
  }, [hoverAnchor, filteredTrips]);

  const tooltipPosition = React.useMemo(() => {
    if (!hoverAnchor) return null;
    return computeTooltipPosition(hoverAnchor.rect);
  }, [hoverAnchor]);

  const hoverBridgeStyle = React.useMemo(() => {
    if (!hoverAnchor || !tooltipPosition) return null;
    return computeHoverBridgeStyle(hoverAnchor.rect, tooltipPosition);
  }, [hoverAnchor, tooltipPosition]);

  React.useEffect(() => {
    if (!hoverAnchor) return;
    if (!hoveredTrip) hideHoverNow();
  }, [hoverAnchor, hoveredTrip, hideHoverNow]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[1100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div className={`fixed inset-y-0 left-0 w-[380px] max-w-[94vw] bg-white shadow-2xl z-[1200] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">My Plans</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={hideHoverNow}
              placeholder="Search trips or cities..."
              className="w-full h-9 pl-8 pr-2.5 rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2" onScroll={hideHoverNow}>
          {trips.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No saved plans yet.</div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No matches for "{searchQuery}".</div>
          ) : (
            <>
              <section>
                <FolderHeader
                  label="Favorites"
                  count={favoriteTrips.length}
                  isOpen={favoritesOpen}
                  onToggle={() => setFavoritesOpen(prev => !prev)}
                />
                {favoritesOpen && (
                  <div className="space-y-1">
                    <BucketList
                      label="This week"
                      trips={favoriteBuckets.thisWeek}
                      currentTripId={currentTripId}
                      onSelectTrip={(trip) => { onSelectTrip(trip); onClose(); }}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                      onHoverAnchor={(tripId, rect) => { cancelHoverClose(); setHoverAnchor({ tripId, rect }); }}
                      onHoverEnd={scheduleHoverClose}
                    />
                    <BucketList
                      label="This month"
                      trips={favoriteBuckets.thisMonth}
                      currentTripId={currentTripId}
                      onSelectTrip={(trip) => { onSelectTrip(trip); onClose(); }}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                      onHoverAnchor={(tripId, rect) => { cancelHoverClose(); setHoverAnchor({ tripId, rect }); }}
                      onHoverEnd={scheduleHoverClose}
                    />
                    {favoriteBuckets.older.length > 0 && (
                      <div className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setShowOlderFavorites(prev => !prev)}
                          className="text-[10px] uppercase tracking-wide font-semibold text-gray-300 hover:text-gray-500 flex items-center gap-1"
                        >
                          {forceExpandOlder || showOlderFavorites ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          Older ({favoriteBuckets.older.length})
                        </button>
                        {(forceExpandOlder || showOlderFavorites) && (
                          <div className="mt-1">
                            <BucketList
                              label=""
                              trips={favoriteBuckets.older}
                              currentTripId={currentTripId}
                              onSelectTrip={(trip) => { onSelectTrip(trip); onClose(); }}
                              onToggleFavorite={handleToggleFavorite}
                              onDelete={handleDelete}
                              onHoverAnchor={(tripId, rect) => { cancelHoverClose(); setHoverAnchor({ tripId, rect }); }}
                              onHoverEnd={scheduleHoverClose}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section>
                <FolderHeader
                  label="Your Trips"
                  count={regularTrips.length}
                  isOpen={tripsOpen}
                  onToggle={() => setTripsOpen(prev => !prev)}
                />
                {tripsOpen && (
                  <div className="space-y-1">
                    <BucketList
                      label="This week"
                      trips={regularBuckets.thisWeek}
                      currentTripId={currentTripId}
                      onSelectTrip={(trip) => { onSelectTrip(trip); onClose(); }}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                      onHoverAnchor={(tripId, rect) => { cancelHoverClose(); setHoverAnchor({ tripId, rect }); }}
                      onHoverEnd={scheduleHoverClose}
                    />
                    <BucketList
                      label="This month"
                      trips={regularBuckets.thisMonth}
                      currentTripId={currentTripId}
                      onSelectTrip={(trip) => { onSelectTrip(trip); onClose(); }}
                      onToggleFavorite={handleToggleFavorite}
                      onDelete={handleDelete}
                      onHoverAnchor={(tripId, rect) => { cancelHoverClose(); setHoverAnchor({ tripId, rect }); }}
                      onHoverEnd={scheduleHoverClose}
                    />
                    {regularBuckets.older.length > 0 && (
                      <div className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setShowOlderTrips(prev => !prev)}
                          className="text-[10px] uppercase tracking-wide font-semibold text-gray-300 hover:text-gray-500 flex items-center gap-1"
                        >
                          {forceExpandOlder || showOlderTrips ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          Older ({regularBuckets.older.length})
                        </button>
                        {(forceExpandOlder || showOlderTrips) && (
                          <div className="mt-1">
                            <BucketList
                              label=""
                              trips={regularBuckets.older}
                              currentTripId={currentTripId}
                              onSelectTrip={(trip) => { onSelectTrip(trip); onClose(); }}
                              onToggleFavorite={handleToggleFavorite}
                              onDelete={handleDelete}
                              onHoverAnchor={(tripId, rect) => { cancelHoverClose(); setHoverAnchor({ tripId, rect }); }}
                              onHoverEnd={scheduleHoverClose}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {isOpen && hoverAnchor && hoveredTrip && tooltipPosition && (
        <>
          {hoverBridgeStyle && (
            <div
              style={hoverBridgeStyle}
              onMouseEnter={cancelHoverClose}
              onMouseLeave={scheduleHoverClose}
            />
          )}
          <TripTooltip
            trip={hoveredTrip}
            position={tooltipPosition}
            onHoverStart={cancelHoverClose}
            onHoverEnd={scheduleHoverClose}
          />
        </>
      )}
    </>
  );
};
