const TRIP_VERSION_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SUMMARY_TITLE = "Shared Trip";
const DEFAULT_DESCRIPTION = "Plan and share travel routes with TravelFlow.";
const DEFAULT_MAP_LANGUAGE = "en";
const DEFAULT_OG_MAP_STYLE: OgMapStyle = "clean";
const DEFAULT_OG_ROUTE_MODE: OgRouteMode = "simple";
const DEFAULT_OG_SHOW_STOPS = true;
const DEFAULT_OG_SHOW_CITIES = true;
const MAX_REALISTIC_DIRECTION_LEGS = 8;
const OG_MAP_WIDTH = 426;
const OG_MAP_HEIGHT = 574;
const TOOLTIP_CLEAN_STYLE = [
  "style=element:geometry|color:0xf9f9f9",
  "style=element:labels.icon|visibility:off",
  "style=element:labels.text.fill|color:0x757575",
  "style=element:labels.text.stroke|color:0xf9f9f9|weight:2",
  "style=feature:administrative|element:geometry|visibility:off",
  "style=feature:administrative.country|element:geometry.stroke|color:0xa8a8a8|weight:1.6|visibility:on",
  "style=feature:administrative.province|element:geometry|visibility:off",
  "style=feature:administrative.province|element:labels|visibility:off",
  "style=feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd",
  "style=feature:poi|visibility:off",
  "style=feature:road|visibility:off",
  "style=feature:transit|visibility:off",
  "style=feature:water|element:geometry|color:0xdcefff",
  "style=feature:water|element:geometry.stroke|color:0x8fb6d9|weight:2.2|visibility:on",
  "style=feature:landscape.natural|element:geometry.stroke|color:0xa7c9e6|weight:1.4|visibility:on",
  "style=feature:water|element:labels.text.fill|color:0x9e9e9e",
].join("&");

const MINIMAL_MAP_STYLE = [
  "style=element:geometry|color:0xf5f5f5",
  "style=element:labels.icon|visibility:off",
  "style=element:labels.text.fill|color:0x616161",
  "style=element:labels.text.stroke|color:0xf5f5f5",
  "style=feature:administrative.country|element:geometry.stroke|color:0x9aa6b2|weight:1.4|visibility:on",
  "style=feature:administrative.province|element:geometry.stroke|color:0xd5dce3|weight:0.5",
  "style=feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd",
  "style=feature:poi|element:geometry|color:0xeeeeee",
  "style=feature:poi|element:labels.text.fill|color:0x757575",
  "style=feature:poi.park|element:geometry|color:0xe5e5e5",
  "style=feature:poi.park|element:labels.text.fill|color:0x9e9e9e",
  "style=feature:road|element:geometry|color:0xffffff",
  "style=feature:road.arterial|element:labels.text.fill|color:0x757575",
  "style=feature:road.highway|element:geometry|color:0xdadada",
  "style=feature:road.highway|element:labels.text.fill|color:0x616161",
  "style=feature:road.local|element:labels.text.fill|color:0x9e9e9e",
  "style=feature:transit.line|element:geometry|color:0xe5e5e5",
  "style=feature:transit.station|element:geometry|color:0xeeeeee",
  "style=feature:water|element:geometry|color:0xc9c9c9",
  "style=feature:water|element:labels.text.fill|color:0x9e9e9e",
].join("&");

const DARK_MAP_STYLE = [
  "style=element:geometry|color:0x242f3e",
  "style=element:labels.text.stroke|color:0x242f3e",
  "style=element:labels.text.fill|color:0x746855",
  "style=feature:administrative.locality|element:labels.text.fill|color:0xd59563",
  "style=feature:poi|element:labels.text.fill|color:0xd59563",
  "style=feature:poi.park|element:geometry|color:0x263c3f",
  "style=feature:poi.park|element:labels.text.fill|color:0x6b9a76",
  "style=feature:road|element:geometry|color:0x38414e",
  "style=feature:road|element:geometry.stroke|color:0x212a37",
  "style=feature:road|element:labels.text.fill|color:0x9ca5b3",
  "style=feature:road.highway|element:geometry|color:0x746855",
  "style=feature:road.highway|element:geometry.stroke|color:0x1f2835",
  "style=feature:road.highway|element:labels.text.fill|color:0xf3d19c",
  "style=feature:transit|element:geometry|color:0x2f3948",
  "style=feature:transit.station|element:labels.text.fill|color:0xd59563",
  "style=feature:water|element:geometry|color:0x17263c",
  "style=feature:water|element:labels.text.fill|color:0x515c6d",
  "style=feature:water|element:labels.text.stroke|color:0x17263c",
].join("&");


export type OgMapStyle = "minimal" | "standard" | "dark" | "satellite" | "clean";
export type OgRouteMode = "simple" | "realistic";

const MAP_STYLE_VALUES: OgMapStyle[] = ["minimal", "standard", "dark", "satellite", "clean"];
const ROUTE_MODE_VALUES: OgRouteMode[] = ["simple", "realistic"];

interface Coordinates {
  lat: number;
  lng: number;
}

interface TimelineItem {
  id?: string;
  type?: string;
  title?: string;
  location?: string;
  startDateOffset?: number;
  duration?: number;
  coordinates?: Coordinates | null;
  transportMode?: string;
  routeDistanceKm?: number;
}

interface TripPayload {
  id?: string;
  title?: string;
  startDate?: string;
  items?: TimelineItem[];
  updatedAt?: number;
}

export interface SharedViewSettings {
  mapStyle?: OgMapStyle;
  routeMode?: OgRouteMode;
  showStops?: boolean;
  showCities?: boolean;
  // Legacy key persisted by current app map settings.
  showCityNames?: boolean;
}

interface SupabaseSharedTripRow {
  trip_id?: string;
  data?: TripPayload;
  view_settings?: unknown;
  latest_version_id?: string | null;
  version_id?: string | null;
}

export interface RouteTarget {
  token?: string;
  tripId?: string;
  versionId: string | null;
}

export interface SharedTripLookupResult {
  trip: TripPayload;
  viewSettings: SharedViewSettings | null;
  latestVersionId: string | null;
  resolvedVersionId: string | null;
}

export interface TripOgSummary {
  title: string;
  weeksLabel: string;
  monthsLabel: string;
  distanceLabel: string | null;
  description: string;
  updatedAt: number | null;
  mapImageUrl: string | null;
  mapLabels: TripOgMapLabel[];
}

export interface TripOgMapLabel {
  text: string;
  subLabel?: string;
  x: number;
  y: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidVersionId = (value?: string | null): value is string =>
  Boolean(value && TRIP_VERSION_REGEX.test(value));

export const isOgMapStyle = (value?: string | null): value is OgMapStyle =>
  Boolean(value && MAP_STYLE_VALUES.includes(value as OgMapStyle));

export const isOgRouteMode = (value?: string | null): value is OgRouteMode =>
  Boolean(value && ROUTE_MODE_VALUES.includes(value as OgRouteMode));

const normalizeOgMapStyle = (value?: string | null): OgMapStyle =>
  isOgMapStyle(value) ? value : DEFAULT_OG_MAP_STYLE;

const normalizeOgRouteMode = (value?: string | null): OgRouteMode =>
  isOgRouteMode(value) ? value : DEFAULT_OG_ROUTE_MODE;

const normalizeShowStops = (value: unknown): boolean =>
  typeof value === "boolean" ? value : DEFAULT_OG_SHOW_STOPS;

const normalizeShowCities = (value: unknown): boolean =>
  typeof value === "boolean" ? value : DEFAULT_OG_SHOW_CITIES;

const getFirstString = (raw: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") return value;
  }
  return null;
};

const getFirstBoolean = (raw: Record<string, unknown>, keys: string[]): boolean | null => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return null;
};

const hasOgPreferenceValues = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  const mapStyle = getFirstString(raw, ["mapStyle", "map_style"]);
  if (isOgMapStyle(mapStyle)) return true;
  const routeMode = getFirstString(raw, ["routeMode", "route_mode"]);
  if (isOgRouteMode(routeMode)) return true;
  if (getFirstBoolean(raw, ["showStops", "show_stops"]) !== null) {
    return true;
  }
  if (getFirstBoolean(raw, ["showCities", "show_cities", "showCityNames", "show_city_names"]) !== null) return true;
  return false;
};

const parseSharedViewSettings = (value: unknown): SharedViewSettings | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const mapStyle = normalizeOgMapStyle(
    getFirstString(raw, ["mapStyle", "map_style"]),
  );
  const routeMode = normalizeOgRouteMode(
    getFirstString(raw, ["routeMode", "route_mode"]),
  );
  const showCityNames = normalizeShowCities(
    getFirstBoolean(raw, ["showCityNames", "show_city_names"]),
  );
  const showStops = normalizeShowStops(
    getFirstBoolean(raw, ["showStops", "show_stops"]),
  );
  const showCities = normalizeShowCities(
    getFirstBoolean(raw, ["showCities", "show_cities"]) ?? showCityNames,
  );

  return {
    mapStyle,
    routeMode,
    showStops,
    showCities,
    showCityNames,
  };
};

const toLocalDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const parsed = new Date(dateStr);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getTripItems = (trip: TripPayload): TimelineItem[] =>
  Array.isArray(trip.items) ? trip.items : [];

const getCityItems = (trip: TripPayload): TimelineItem[] =>
  getTripItems(trip)
    .filter((item) => item?.type === "city")
    .sort(
      (a, b) =>
        (isFiniteNumber(a.startDateOffset) ? a.startDateOffset : 0) -
        (isFiniteNumber(b.startDateOffset) ? b.startDateOffset : 0),
    );

const getTripRangeOffsets = (trip: TripPayload): { startOffset: number; endOffset: number } => {
  const cityItems = getCityItems(trip);
  const source = cityItems.length > 0 ? cityItems : getTripItems(trip);

  if (source.length === 0) {
    return { startOffset: 0, endOffset: 1 };
  }

  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;

  for (const item of source) {
    const start = item?.startDateOffset;
    const duration = item?.duration;
    if (!isFiniteNumber(start) || !isFiniteNumber(duration)) continue;
    minStart = Math.min(minStart, start);
    maxEnd = Math.max(maxEnd, start + duration);
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) {
    return { startOffset: 0, endOffset: 1 };
  }

  return { startOffset: minStart, endOffset: maxEnd };
};

const getTripDurationDays = (trip: TripPayload): number => {
  const range = getTripRangeOffsets(trip);
  return Math.max(1, Math.ceil(range.endOffset - range.startOffset));
};

const formatTripWeeks = (days: number): string => {
  const weeks = Math.max(1, Math.round((days / 7) * 2) / 2);
  const weeksText = Number.isInteger(weeks) ? String(weeks) : weeks.toFixed(1);
  return `${weeksText} ${weeks === 1 ? "week" : "weeks"}`;
};

const formatTripMonths = (trip: TripPayload): string => {
  const baseStart = toLocalDate(trip.startDate);
  const range = getTripRangeOffsets(trip);
  const start = addDays(baseStart, Math.floor(range.startOffset));
  const end = addDays(baseStart, Math.ceil(range.endOffset) - 1);
  const sameYear = start.getFullYear() === end.getFullYear();
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });
  const startLabel = monthFormatter.format(start);
  const endLabel = monthFormatter.format(end);

  if (sameYear && startLabel === endLabel) return startLabel;
  if (sameYear) return `${startLabel} - ${endLabel}`;

  return `${startLabel} ${start.getFullYear()} - ${endLabel} ${end.getFullYear()}`;
};

const getDistanceKm = (from: Coordinates, to: Coordinates): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const findTravelBetweenCities = (
  items: TimelineItem[],
  fromCity: TimelineItem,
  toCity: TimelineItem,
): TimelineItem | null => {
  const fromEnd =
    (isFiniteNumber(fromCity.startDateOffset) ? fromCity.startDateOffset : 0) +
    (isFiniteNumber(fromCity.duration) ? fromCity.duration : 0);
  const toStart = isFiniteNumber(toCity.startDateOffset) ? toCity.startDateOffset : fromEnd;
  const windowStart = Math.min(fromEnd, toStart) - 0.6;
  const windowEnd = Math.max(fromEnd, toStart) + 0.6;

  const candidates = items.filter((item) => {
    if (!item) return false;
    if (item.type !== "travel" && item.type !== "travel-empty") return false;
    if (!isFiniteNumber(item.startDateOffset)) return false;
    return item.startDateOffset >= windowStart && item.startDateOffset <= windowEnd;
  });

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => {
    const aOffset = isFiniteNumber(a.startDateOffset) ? a.startDateOffset : 0;
    const bOffset = isFiniteNumber(b.startDateOffset) ? b.startDateOffset : 0;
    return Math.abs(aOffset - fromEnd) - Math.abs(bOffset - fromEnd);
  })[0];
};

const getTripDistanceKm = (trip: TripPayload): number | null => {
  const items = getTripItems(trip);
  const cities = getCityItems(trip);

  if (cities.length < 2) return null;

  let total = 0;
  let hasAnyDistance = false;

  for (let i = 0; i < cities.length - 1; i += 1) {
    const fromCity = cities[i];
    const toCity = cities[i + 1];
    const fromCoord = fromCity?.coordinates;
    const toCoord = toCity?.coordinates;
    if (
      !fromCoord ||
      !toCoord ||
      !isFiniteNumber(fromCoord.lat) ||
      !isFiniteNumber(fromCoord.lng) ||
      !isFiniteNumber(toCoord.lat) ||
      !isFiniteNumber(toCoord.lng)
    ) {
      continue;
    }

    const airDistance = getDistanceKm(fromCoord, toCoord);
    const travelItem = findTravelBetweenCities(items, fromCity, toCity);

    if (travelItem?.transportMode === "plane") {
      total += airDistance;
      hasAnyDistance = true;
      continue;
    }

    if (isFiniteNumber(travelItem?.routeDistanceKm)) {
      total += Number(travelItem?.routeDistanceKm);
      hasAnyDistance = true;
      continue;
    }

    total += airDistance;
    hasAnyDistance = true;
  }

  return hasAnyDistance ? total : null;
};

const formatDistance = (distanceKm: number | null): string | null => {
  if (!isFiniteNumber(distanceKm) || distanceKm <= 0) return null;
  const rounded = Math.round(distanceKm);
  return `${rounded.toLocaleString("en-US")} km`;
};

const formatCoord = (coord: Coordinates): string => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;

const getRouteCities = (trip: TripPayload): TimelineItem[] =>
  getCityItems(trip)
    .filter(
      (item) =>
        Boolean(
          item?.coordinates &&
            isFiniteNumber(item.coordinates.lat) &&
            isFiniteNumber(item.coordinates.lng),
        ),
    )
    .slice(0, 30);

const buildMarkerParam = (
  coord: Coordinates,
  options: { size: "mid" | "tiny"; color: string; label?: string },
): string => {
  const segments = [`size:${options.size}`, `color:0x${options.color}`];
  if (options.label) segments.push(`label:${options.label}`);
  segments.push(formatCoord(coord));
  return `markers=${encodeURIComponent(segments.join("|"))}`;
};

const buildSimplePathParam = (coords: Coordinates[], color = "4f46e5", weight = 4): string | null => {
  if (coords.length < 2) return null;
  return `path=${encodeURIComponent(`color:0x${color}|weight:${weight}|${coords.map(formatCoord).join("|")}`)}`;
};

const normalizeCityName = (value?: string): string =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/\s+/g, " ") || "";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const latToMercator = (lat: number): number => {
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return clamp(y, 0, 1);
};

const lngToMercator = (lng: number): number => ((lng + 180) / 360 + 1) % 1;

const getWorldPixel = (coord: Coordinates, zoom: number): { x: number; y: number } => {
  const scale = 256 * 2 ** zoom;
  return {
    x: lngToMercator(coord.lng) * scale,
    y: latToMercator(coord.lat) * scale,
  };
};

const zoomForFraction = (mapPx: number, worldFraction: number): number => {
  if (!Number.isFinite(worldFraction) || worldFraction <= 0) return 18;
  const zoom = Math.floor(Math.log(mapPx / 256 / worldFraction) / Math.LN2);
  return Number.isFinite(zoom) ? zoom : 18;
};

interface MapViewport {
  center: Coordinates;
  zoom: number;
}

const computeMapViewport = (coords: Coordinates[]): MapViewport => {
  if (coords.length === 0) {
    return {
      center: { lat: 0, lng: 0 },
      zoom: 2,
    };
  }
  if (coords.length === 1) {
    return {
      center: coords[0],
      zoom: 9,
    };
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const coord of coords) {
    minLat = Math.min(minLat, coord.lat);
    maxLat = Math.max(maxLat, coord.lat);
    minLng = Math.min(minLng, coord.lng);
    maxLng = Math.max(maxLng, coord.lng);
  }

  const latFraction = Math.abs(latToMercator(maxLat) - latToMercator(minLat));
  const lngFraction = Math.abs((maxLng - minLng) / 360);
  const widthFit = Math.max(1, OG_MAP_WIDTH - 72);
  const heightFit = Math.max(1, OG_MAP_HEIGHT - 96);
  const latZoom = zoomForFraction(heightFit, latFraction);
  const lngZoom = zoomForFraction(widthFit, lngFraction);
  const zoom = clamp(Math.min(latZoom, lngZoom), 2, 18);

  return {
    center: {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    },
    zoom,
  };
};

const buildMapLabels = (
  routeCities: TimelineItem[],
  viewport: MapViewport,
): TripOgMapLabel[] => {
  if (routeCities.length === 0) return [];

  const labels: TripOgMapLabel[] = [];
  const startCity = routeCities[0];
  const endCity = routeCities[routeCities.length - 1];
  const startKey = normalizeCityName(startCity?.title || startCity?.location);
  const endKey = normalizeCityName(endCity?.title || endCity?.location);
  const isRoundTrip = Boolean(startKey && endKey && startKey === endKey);
  const shownRoundTrip = new Set<string>();
  const centerPixel = getWorldPixel(viewport.center, viewport.zoom);
  const worldWidth = 256 * 2 ** viewport.zoom;

  for (const city of routeCities) {
    const coord = city.coordinates;
    if (!coord) continue;

    const name = (city.title || city.location || "").trim();
    if (!name) continue;

    const key = normalizeCityName(name);
    let subLabel: string | undefined;

    if (isRoundTrip && key === startKey) {
      if (shownRoundTrip.has(key)) continue;
      shownRoundTrip.add(key);
      subLabel = "START • END";
    } else if (startCity?.id === city.id) {
      subLabel = "START";
    } else if (endCity?.id === city.id) {
      subLabel = "END";
    }

    const point = getWorldPixel(coord, viewport.zoom);
    let dx = point.x - centerPixel.x;
    if (dx > worldWidth / 2) dx -= worldWidth;
    if (dx < -worldWidth / 2) dx += worldWidth;
    const dy = point.y - centerPixel.y;

    const x = clamp((OG_MAP_WIDTH / 2 + dx + 12) / OG_MAP_WIDTH, 0.06, 0.88);
    const y = clamp((OG_MAP_HEIGHT / 2 + dy - 4) / OG_MAP_HEIGHT, 0.06, 0.94);

    labels.push({
      text: name,
      subLabel,
      x,
      y,
    });
  }

  return labels;
};

const getMapType = (mapStyle: OgMapStyle): "roadmap" | "satellite" =>
  mapStyle === "satellite" ? "satellite" : "roadmap";

const getMapStyleQuery = (mapStyle: OgMapStyle): string => {
  if (mapStyle === "clean") return TOOLTIP_CLEAN_STYLE;
  if (mapStyle === "minimal") return MINIMAL_MAP_STYLE;
  if (mapStyle === "dark") return DARK_MAP_STYLE;
  return "";
};

const getDirectionsModeForTransport = (
  transportMode?: string,
): "driving" | "walking" | "bicycling" | null => {
  if (!transportMode) return "driving";
  if (transportMode === "walk") return "walking";
  if (transportMode === "bicycle") return "bicycling";
  if (transportMode === "plane" || transportMode === "boat" || transportMode === "na") return null;
  return "driving";
};

const fetchDirectionsPolyline = async (
  from: Coordinates,
  to: Coordinates,
  mapsApiKey: string,
  transportMode?: string,
): Promise<string | null> => {
  const mode = getDirectionsModeForTransport(transportMode);
  if (!mode) return null;

  const endpoint = new URL("https://maps.googleapis.com/maps/api/directions/json");
  endpoint.searchParams.set("origin", formatCoord(from));
  endpoint.searchParams.set("destination", formatCoord(to));
  endpoint.searchParams.set("mode", mode);
  endpoint.searchParams.set("alternatives", "false");
  endpoint.searchParams.set("key", mapsApiKey);

  try {
    const response = await fetch(endpoint.toString());
    if (!response.ok) return null;
    const data = await response.json();
    const encoded = data?.routes?.[0]?.overview_polyline?.points;
    return typeof encoded === "string" && encoded.length > 0 ? encoded : null;
  } catch {
    return null;
  }
};

const buildRealisticPathParams = async (
  trip: TripPayload,
  mapsApiKey: string,
  color = "4f46e5",
  weight = 4,
): Promise<string[]> => {
  const routeCities = getRouteCities(trip);
  const items = getTripItems(trip);
  const pathParams: string[] = [];
  if (routeCities.length < 2) return pathParams;

  let directionsCalls = 0;

  for (let index = 0; index < routeCities.length - 1; index += 1) {
    const fromCity = routeCities[index];
    const toCity = routeCities[index + 1];
    const fromCoord = fromCity.coordinates;
    const toCoord = toCity.coordinates;
    if (!fromCoord || !toCoord) continue;

    let encodedPolyline: string | null = null;
    if (directionsCalls < MAX_REALISTIC_DIRECTION_LEGS) {
      const travelItem = findTravelBetweenCities(items, fromCity, toCity);
      encodedPolyline = await fetchDirectionsPolyline(
        fromCoord,
        toCoord,
        mapsApiKey,
        travelItem?.transportMode,
      );
      directionsCalls += 1;
    }

    if (encodedPolyline) {
      pathParams.push(`path=${encodeURIComponent(`color:0x${color}|weight:${weight}|enc:${encodedPolyline}`)}`);
      continue;
    }

    const fallbackDirectPath = buildSimplePathParam([fromCoord, toCoord], color, weight);
    if (fallbackDirectPath) pathParams.push(fallbackDirectPath);
  }

  return pathParams;
};

export interface MapPreviewPreferences {
  mapStyle?: OgMapStyle;
  routeMode?: OgRouteMode;
  showStops?: boolean;
  // Controls custom city-name overlays near route stops.
  showCities?: boolean;
  // Legacy shared-view key from TripView map settings.
  showCityNames?: boolean;
}

interface MapPreviewResult {
  mapUrl: string | null;
  mapLabels: TripOgMapLabel[];
}

const buildMapPreviewUrl = async (
  trip: TripPayload,
  mapsApiKey?: string,
  mapLanguage = DEFAULT_MAP_LANGUAGE,
  preferences?: MapPreviewPreferences,
): Promise<MapPreviewResult> => {
  if (!mapsApiKey) return { mapUrl: null, mapLabels: [] };

  const routeCities = getRouteCities(trip);
  const routeCoordinates = routeCities
    .map((item) => item.coordinates)
    .filter((coord): coord is Coordinates => Boolean(coord));
  if (routeCoordinates.length === 0) return { mapUrl: null, mapLabels: [] };

  const mapStyle = normalizeOgMapStyle(preferences?.mapStyle);
  const routeMode = normalizeOgRouteMode(preferences?.routeMode);
  const showStops = typeof preferences?.showStops === "boolean"
    ? preferences.showStops
    : DEFAULT_OG_SHOW_STOPS;
  const showCities = typeof preferences?.showCities === "boolean"
    ? preferences.showCities
    : typeof preferences?.showCityNames === "boolean"
    ? preferences.showCityNames
    : DEFAULT_OG_SHOW_CITIES;
  const viewport = computeMapViewport(routeCoordinates);

  const start = routeCoordinates[0];
  const end = routeCoordinates[routeCoordinates.length - 1];
  const markerParams: string[] = [];

  if (showStops) {
    markerParams.push(
      buildMarkerParam(start, {
        size: "mid",
        color: "4f46e5",
        label: routeCoordinates.length > 1 ? "S" : undefined,
      }),
    );

    if (routeCoordinates.length > 1) {
      markerParams.push(
        buildMarkerParam(end, {
          size: "mid",
          color: "a5b4fc",
          label: "E",
        }),
      );
    }

  }

  let pathParams: string[] = [];
  if (routeMode === "realistic") {
    pathParams = await buildRealisticPathParams(trip, mapsApiKey);
  }

  if (pathParams.length === 0) {
    const simplePath = buildSimplePathParam(routeCoordinates);
    if (simplePath) pathParams = [simplePath];
  }

  const styleParams = [getMapStyleQuery(mapStyle)];

  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?size=${OG_MAP_WIDTH}x${OG_MAP_HEIGHT}&scale=2&maptype=${getMapType(mapStyle)}` +
    `&center=${encodeURIComponent(formatCoord(viewport.center))}` +
    `&zoom=${viewport.zoom}` +
    (styleParams.filter(Boolean).length > 0 ? `&${styleParams.filter(Boolean).join("&")}` : "") +
    `&language=${encodeURIComponent(mapLanguage)}` +
    (markerParams.length > 0 ? `&${markerParams.join("&")}` : "") +
    (pathParams.length > 0 ? `&${pathParams.join("&")}` : "") +
    `&key=${encodeURIComponent(mapsApiKey)}`;

  return {
    mapUrl,
    mapLabels: showCities ? buildMapLabels(routeCities, viewport) : [],
  };
};

export const parseRouteTarget = (url: URL): RouteTarget | null => {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const versionRaw = url.searchParams.get("v");
  const versionId = isValidVersionId(versionRaw) ? versionRaw : null;
  const decodeSegment = (value: string): string | null => {
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  };

  if (segments[0] === "s" && segments[1]) {
    const token = decodeSegment(segments[1]);
    return token ? { token, versionId } : null;
  }

  if (segments[0] === "trip" && segments[1]) {
    const tripId = decodeSegment(segments[1]);
    return tripId ? { tripId, versionId } : null;
  }

  return null;
};

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

const fetchSupabaseRpc = async (
  rpcName: string,
  payload: Record<string, unknown>,
): Promise<SupabaseSharedTripRow | null> => {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const raw = await response.json();
    const row = Array.isArray(raw) ? raw[0] : raw;
    if (!row || typeof row !== "object") return null;
    return row as SupabaseSharedTripRow;
  } catch {
    return null;
  }
};

export const fetchSharedTrip = async (
  token: string,
  versionId: string | null,
): Promise<SharedTripLookupResult | null> => {
  if (!token) return null;

  if (isValidVersionId(versionId)) {
    const versionRow = await fetchSupabaseRpc("get_shared_trip_version", {
      p_token: token,
      p_version_id: versionId,
    });
    if (versionRow?.data) {
      return {
        trip: versionRow.data,
        viewSettings: parseSharedViewSettings(versionRow.view_settings),
        latestVersionId:
          typeof versionRow.latest_version_id === "string" ? versionRow.latest_version_id : null,
        resolvedVersionId:
          typeof versionRow.version_id === "string" ? versionRow.version_id : versionId,
      };
    }
  }

  const row = await fetchSupabaseRpc("get_shared_trip", { p_token: token });
  if (!row?.data) return null;
  const latestVersionId = typeof row.latest_version_id === "string" ? row.latest_version_id : null;
  let viewSettings = parseSharedViewSettings(row.view_settings);

  if (!hasOgPreferenceValues(row.view_settings) && isValidVersionId(latestVersionId)) {
    const latestVersionRow = await fetchSupabaseRpc("get_shared_trip_version", {
      p_token: token,
      p_version_id: latestVersionId,
    });
    if (latestVersionRow && hasOgPreferenceValues(latestVersionRow.view_settings)) {
      viewSettings = parseSharedViewSettings(latestVersionRow.view_settings);
    }
  }

  return {
    trip: row.data,
    viewSettings,
    latestVersionId,
    resolvedVersionId: null,
  };
};

export const getMapsApiKeyFromEnv = (): string => readEnv("VITE_GOOGLE_MAPS_API_KEY");

export const buildTripOgSummary = async (
  trip: TripPayload,
  options?: {
    mapsApiKey?: string;
    mapLanguage?: string;
    mapStyle?: OgMapStyle;
    routeMode?: OgRouteMode;
    showStops?: boolean;
    showCities?: boolean;
    // Legacy shared-view key from TripView map settings.
    showCityNames?: boolean;
    includeMapImage?: boolean;
  },
): Promise<TripOgSummary> => {
  const title = (trip?.title || "").trim() || DEFAULT_SUMMARY_TITLE;
  const days = getTripDurationDays(trip);
  const weeksLabel = formatTripWeeks(days);
  const monthsLabel = formatTripMonths(trip);
  const distanceLabel = formatDistance(getTripDistanceKm(trip));
  const description = distanceLabel
    ? `${weeksLabel} • ${monthsLabel} • ${distanceLabel}`
    : `${weeksLabel} • ${monthsLabel}`;

  const updatedAt = isFiniteNumber(trip?.updatedAt) ? trip.updatedAt : null;
  const mapPreview = options?.includeMapImage === false
    ? { mapUrl: null, mapLabels: [] as TripOgMapLabel[] }
    : await buildMapPreviewUrl(
      trip,
      options?.mapsApiKey,
      options?.mapLanguage || DEFAULT_MAP_LANGUAGE,
      {
        mapStyle: options?.mapStyle,
        routeMode: options?.routeMode,
        showStops: options?.showStops,
        showCities: options?.showCities ?? options?.showCityNames,
        showCityNames: options?.showCityNames,
      },
    );

  return {
    title,
    weeksLabel,
    monthsLabel,
    distanceLabel,
    description,
    updatedAt,
    mapImageUrl: mapPreview.mapUrl,
    mapLabels: mapPreview.mapLabels,
  };
};

export const buildOgImageUrl = (
  origin: string,
  payload: {
    token?: string;
    tripId?: string;
    versionId?: string | null;
    updatedAt?: number | null;
    mapStyle?: OgMapStyle | null;
    routeMode?: OgRouteMode | null;
    showStops?: boolean | null;
    showCities?: boolean | null;
    // Legacy alias for showCities.
    cityNames?: boolean | null;
  },
): string => {
  const url = new URL("/api/og/trip", origin);
  if (payload.token) url.searchParams.set("s", payload.token);
  if (payload.tripId) url.searchParams.set("trip", payload.tripId);
  if (isValidVersionId(payload.versionId)) url.searchParams.set("v", payload.versionId);
  if (isFiniteNumber(payload.updatedAt)) {
    url.searchParams.set("u", String(Math.floor(payload.updatedAt)));
  }
  if (isOgMapStyle(payload.mapStyle ?? null)) {
    url.searchParams.set("mapStyle", payload.mapStyle);
  }
  if (isOgRouteMode(payload.routeMode ?? null)) {
    url.searchParams.set("routeMode", payload.routeMode);
  }
  const showStops = typeof payload.showStops === "boolean" ? payload.showStops : null;
  const showCities = typeof payload.showCities === "boolean"
    ? payload.showCities
    : typeof payload.cityNames === "boolean"
    ? payload.cityNames
    : null;
  if (typeof showStops === "boolean") {
    url.searchParams.set("showStops", showStops ? "1" : "0");
  }
  if (typeof showCities === "boolean") {
    url.searchParams.set("showCities", showCities ? "1" : "0");
  }
  return url.toString();
};

export const buildCanonicalUrl = (
  origin: string,
  routeTarget: RouteTarget,
): string => {
  if (routeTarget.token) {
    const canonical = new URL(`/s/${encodeURIComponent(routeTarget.token)}`, origin);
    if (isValidVersionId(routeTarget.versionId)) {
      canonical.searchParams.set("v", routeTarget.versionId);
    }
    return canonical.toString();
  }

  if (routeTarget.tripId) {
    const canonical = new URL(`/trip/${encodeURIComponent(routeTarget.tripId)}`, origin);
    if (isValidVersionId(routeTarget.versionId)) {
      canonical.searchParams.set("v", routeTarget.versionId);
    }
    return canonical.toString();
  }

  return new URL("/", origin).toString();
};

export const buildDisplayPath = (routeTarget: RouteTarget): string => {
  if (routeTarget.token) {
    const base = `/s/${routeTarget.token}`;
    if (isValidVersionId(routeTarget.versionId)) {
      return `${base}?v=${routeTarget.versionId}`;
    }
    return base;
  }

  if (routeTarget.tripId) {
    const base = `/trip/${routeTarget.tripId}`;
    if (isValidVersionId(routeTarget.versionId)) {
      return `${base}?v=${routeTarget.versionId}`;
    }
    return base;
  }

  return "/";
};

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const fallbackSummary = (): TripOgSummary => ({
  title: DEFAULT_SUMMARY_TITLE,
  weeksLabel: "1 week",
  monthsLabel: "Any month",
  distanceLabel: null,
  description: DEFAULT_DESCRIPTION,
  updatedAt: null,
  mapImageUrl: null,
  mapLabels: [],
});
