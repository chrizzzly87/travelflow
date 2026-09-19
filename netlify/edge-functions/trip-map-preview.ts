/**
 * Edge function that renders a trip's static map preview.
 *
 * The rendered image is fetched here and returned as bytes, not handed to the
 * browser as a redirect. Every parameter that changes the picture is part of
 * the URL, so the response is a pure function of that URL and Netlify's durable
 * CDN cache can hold it: one render per trip state, shared by every viewer,
 * regenerated only when the trip itself changes. The redirect this replaced put
 * the image on the provider's origin instead, which meant a fresh billed static
 * render — and, in "realistic" mode, a fresh fan-out of Directions calls — for
 * every visitor whose browser cache was cold.
 *
 * Query params:
 *   coords     — pipe-separated lat,lng pairs (e.g. "35.68,139.65|34.69,135.50")
 *   style      — "clean" (default) | "minimal" | "standard" | "dark" | "satellite"
 *   routeMode  — "simple" (default) | "realistic"
 *   legModes   — optional pipe-separated transport mode per leg (e.g. "plane|car")
 *   colorMode  — "brand" (default) | "trip"
 *   pathColor  — optional hex/rgb color (used when colorMode=trip)
 *   legColors  — optional pipe/comma-separated hex/rgb colors (used per route leg when colorMode=trip)
 *   startMarkerColor — optional hex/rgb color override for the start marker
 *   endMarkerColor — optional hex/rgb color override for the end marker
 *   waypointColor — optional hex/rgb color override for waypoint markers
 *   language  — optional map language code (e.g. "en", "de", "pt-BR")
 *   w          — width in pixels (default 680)
 *   h          — height in pixels (default 288)
 *   scale      — 1 or 2 (default 2)
 */

import { getMapboxAccessTokenFromEnv, getMapsApiKeyFromEnv } from "../edge-lib/trip-og-data.ts";
import { resolveEdgeMapRuntimeAsync } from "../edge-lib/map-runtime.ts";
import { buildFlightPreviewCurvePath } from "../../shared/flightRouteCurve.ts";
import { parseMapPreviewLegModes } from "../../shared/mapPreviewLegModes.ts";
import type { TransportMode } from "../../shared/transportModes.ts";
import {
  buildPreviewNetlifyVaryValue,
  createTokenBucketLimiter,
  parsePreviewCoords,
  resolvePreviewClientIp,
} from "../edge-lib/trip-map-preview-guard.ts";

type MapPreviewStyle = "clean" | "minimal" | "standard" | "dark" | "satellite";
type RoutePreviewMode = "simple" | "realistic";
type MapPreviewColorMode = "brand" | "trip";

const BRAND_ROUTE_COLOR = "4f46e5";
const MAX_REALISTIC_DIRECTION_LEGS = 8;
const STATIC_MAP_SATELLITE_FALLBACK: MapPreviewStyle = "clean";
// Mapbox Static Images caps the whole request URL at 8192 characters.
const MAPBOX_MAX_OVERLAY_SEGMENT_LENGTH = 7000;

const CLEAN_STYLE = [
  "element:geometry|color:0xf9f9f9",
  "element:labels.icon|visibility:off",
  "element:labels.text.fill|color:0x757575",
  "element:labels.text.stroke|color:0xf9f9f9|weight:2",
  "feature:administrative|element:geometry|visibility:off",
  "feature:poi|visibility:off",
  "feature:road|element:geometry|color:0xe0e0e0",
  "feature:road|element:labels|visibility:off",
  "feature:transit|visibility:off",
  "feature:water|element:geometry|color:0xc9d6e5",
  "feature:water|element:labels|visibility:off",
];

const MINIMAL_STYLE = [
  "element:geometry|color:0xf5f5f5",
  "element:labels.icon|visibility:off",
  "element:labels.text.fill|color:0x616161",
  "element:labels.text.stroke|color:0xf5f5f5",
  "feature:administrative.country|element:geometry.stroke|color:0x9aa6b2|weight:1.4|visibility:on",
  "feature:administrative.province|element:geometry.stroke|color:0xd5dce3|weight:0.5",
  "feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd",
  "feature:poi|element:geometry|color:0xeeeeee",
  "feature:poi|element:labels.text.fill|color:0x757575",
  "feature:poi.park|element:geometry|color:0xe5e5e5",
  "feature:poi.park|element:labels.text.fill|color:0x9e9e9e",
  "feature:road|element:geometry|color:0xffffff",
  "feature:road.arterial|element:labels.text.fill|color:0x757575",
  "feature:road.highway|element:geometry|color:0xdadada",
  "feature:road.highway|element:labels.text.fill|color:0x616161",
  "feature:road.local|element:labels.text.fill|color:0x9e9e9e",
  "feature:transit.line|element:geometry|color:0xe5e5e5",
  "feature:transit.station|element:geometry|color:0xeeeeee",
  "feature:water|element:geometry|color:0xc9c9c9",
  "feature:water|element:labels.text.fill|color:0x9e9e9e",
];

const DARK_STYLE = [
  "element:geometry|color:0x1b2230",
  "element:labels.text.stroke|color:0x1b2230",
  "element:labels.text.fill|color:0xd0d8e2",
  "feature:administrative.locality|element:labels.text.fill|color:0xf3c98b",
  "feature:administrative.country|element:geometry.stroke|color:0x9fb3c8|weight:1.2|visibility:on",
  "feature:poi|element:labels.text.fill|color:0x8fb3c0",
  "feature:poi.park|element:geometry|color:0x1a3b3a",
  "feature:poi.park|element:labels.text.fill|color:0x8bc2b3",
  "feature:road|element:geometry|color:0x3a4558",
  "feature:road|element:geometry.stroke|color:0x243246",
  "feature:road|element:labels.text.fill|color:0xd5dde8",
  "feature:road.highway|element:geometry|color:0x566579",
  "feature:road.highway|element:geometry.stroke|color:0x2f3c4f",
  "feature:road.highway|element:labels.text.fill|color:0xf7ddb0",
  "feature:transit|element:geometry|color:0x34506b",
  "feature:transit.station|element:labels.text.fill|color:0x9fc6e5",
  "feature:water|element:geometry|color:0x0b3f5f",
  "feature:water|element:labels.text.fill|color:0xb7d5ea",
  "feature:water|element:labels.text.stroke|color:0x0b3f5f",
];

const MAPBOX_STYLE_IDS: Record<MapPreviewStyle, { owner: string; styleId: string }> = {
  clean: { owner: "mapbox", styleId: "light-v11" },
  minimal: { owner: "mapbox", styleId: "light-v11" },
  standard: { owner: "mapbox", styleId: "streets-v12" },
  dark: { owner: "mapbox", styleId: "dark-v11" },
  satellite: { owner: "mapbox", styleId: "satellite-streets-v12" },
};

const clampInt = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
};

const parseStyle = (value: string | null): MapPreviewStyle => {
  if (value === "clean" || value === "minimal" || value === "standard" || value === "dark" || value === "satellite") {
    return value;
  }
  return "clean";
};

const parseRouteMode = (value: string | null): RoutePreviewMode => {
  if (value === "realistic") return "realistic";
  return "simple";
};

const parseColorMode = (value: string | null): MapPreviewColorMode => {
  if (value === "trip") return "trip";
  return "brand";
};

const formatCoord = (coord: { lat: number; lng: number }): string => `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;

const encodePolylineDelta = (delta: number): string => {
  let current = delta < 0 ? ~(delta << 1) : delta << 1;
  let encoded = "";
  while (current >= 0x20) {
    encoded += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
    current >>= 5;
  }
  encoded += String.fromCharCode(current + 63);
  return encoded;
};

const encodePolyline = (coords: Array<{ lat: number; lng: number }>): string => {
  let previousLat = 0;
  let previousLng = 0;
  let encoded = "";

  coords.forEach((coord) => {
    const lat = Math.round(coord.lat * 1e5);
    const lng = Math.round(coord.lng * 1e5);
    encoded += encodePolylineDelta(lat - previousLat);
    encoded += encodePolylineDelta(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  });

  return encoded;
};

/**
 * Upstream budgets. A synchronous Netlify function is terminated at 60s, and a
 * slow third-party upstream held open at the edge is how this site has taken
 * outages before (docs/incidents/2026-02-24-edge-timeout-site-outage.md), so
 * every call out of this function is bounded.
 */
const DIRECTIONS_TIMEOUT_MS = 2500;
const UPSTREAM_IMAGE_TIMEOUT_MS = 6000;

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const isFlightLeg = (legModes: TransportMode[], index: number): boolean => legModes[index] === "plane";

/**
 * A plane leg is drawn as the same arc the planner map draws. Anything else
 * keeps its straight two-point geometry until a routing provider replaces it.
 */
const buildLegGeometry = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  isFlight: boolean,
): Array<{ lat: number; lng: number }> => (
  isFlight ? buildFlightPreviewCurvePath(from, to) : [from, to]
);

const normalizeColor = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  const hex = trimmed.replace(/^0x/, "").replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return hex;
  if (/^[0-9a-f]{3}$/i.test(hex)) return hex.split("").map((char) => `${char}${char}`).join("");

  const rgbMatch = trimmed.match(
    /^rgb\(\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*\)$/,
  );
  if (!rgbMatch) return null;

  return rgbMatch.slice(1).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
};

const parseLegColors = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map((entry) => normalizeColor(entry))
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
};

const parseMapLanguage = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/i.test(trimmed)) return null;
  return trimmed;
};

const shiftColor = (hex: string, amount: number): string => {
  const normalized = normalizeColor(hex) || BRAND_ROUTE_COLOR;
  const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
  return channels
    .map((channel) => Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, "0"))
    .join("");
};

const getStyleTokens = (style: MapPreviewStyle): string[] => {
  if (style === "clean") return CLEAN_STYLE;
  if (style === "minimal") return MINIMAL_STYLE;
  if (style === "dark") return DARK_STYLE;
  return [];
};

const getMapType = (style: MapPreviewStyle): "roadmap" | "satellite" => {
  if (style === "satellite") return "satellite";
  return "roadmap";
};

const getEffectiveStaticMapStyle = (style: MapPreviewStyle): MapPreviewStyle => {
  // Static Maps satellite/hybrid requests can be blocked by account/region policy.
  // Fall back to a styled roadmap for deterministic, non-error previews.
  if (style === "satellite") return STATIC_MAP_SATELLITE_FALLBACK;
  return style;
};

const fetchDirectionsPolyline = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  apiKey: string,
): Promise<string | null> => {
  const directionsUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
  directionsUrl.searchParams.set("origin", formatCoord(from));
  directionsUrl.searchParams.set("destination", formatCoord(to));
  directionsUrl.searchParams.set("mode", "driving");
  directionsUrl.searchParams.set("alternatives", "false");
  directionsUrl.searchParams.set("key", apiKey);

  try {
    const response = await fetchWithTimeout(directionsUrl.toString(), DIRECTIONS_TIMEOUT_MS);
    if (!response.ok) return null;
    const data = await response.json();
    const encoded = data?.routes?.[0]?.overview_polyline?.points;
    return typeof encoded === "string" && encoded.length > 0 ? encoded : null;
  } catch {
    return null;
  }
};

const fetchMapboxDirectionsPolyline = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mapboxToken: string,
): Promise<string | null> => {
  const coordinatePair = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
  const directionsUrl = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatePair}`);
  directionsUrl.searchParams.set("geometries", "polyline");
  directionsUrl.searchParams.set("overview", "simplified");
  directionsUrl.searchParams.set("alternatives", "false");
  directionsUrl.searchParams.set("steps", "false");
  directionsUrl.searchParams.set("access_token", mapboxToken);

  try {
    const response = await fetchWithTimeout(directionsUrl.toString(), DIRECTIONS_TIMEOUT_MS);
    if (!response.ok) return null;
    const data = await response.json();
    const encoded = data?.routes?.[0]?.geometry;
    return typeof encoded === "string" && encoded.length > 0 ? encoded : null;
  } catch {
    return null;
  }
};

const buildSimplePath = (
  coords: Array<{ lat: number; lng: number }>,
  color: string,
): string | null => {
  if (coords.length < 2) return null;
  return `color:0x${color}|weight:4|${coords.map(formatCoord).join("|")}`;
};

const buildMapboxPathOverlay = (encodedPolyline: string, color: string): string =>
  `path-4+${color}-0.85(${encodedPolyline})`;

const resolveLegColor = (legColors: string[], index: number, fallback: string): string => {
  if (legColors.length === 0) return fallback;
  return legColors[index] || legColors[legColors.length - 1] || fallback;
};

const buildSimpleSegmentPaths = (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
  legModes: TransportMode[] = [],
): string[] => {
  if (coords.length < 2) return [];
  const paths: string[] = [];

  for (let index = 0; index < coords.length - 1; index += 1) {
    const color = resolveLegColor(legColors, index, fallbackColor);
    if (isFlightLeg(legModes, index)) {
      const curve = buildLegGeometry(coords[index], coords[index + 1], true);
      paths.push(`color:0x${color}|weight:4|enc:${encodePolyline(curve)}`);
      continue;
    }
    const segment = buildSimplePath([coords[index], coords[index + 1]], color);
    if (segment) paths.push(segment);
  }

  return paths;
};

interface RealisticLegPlan {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  isFlight: boolean;
  /** True when this leg gets one of the limited Directions calls. */
  routable: boolean;
}

/**
 * Assigns the Directions budget before any request goes out.
 *
 * The budget used to be spent inside the request loop, which forced the calls
 * to run one after another: a five-stop card waited for four sequential round
 * trips to the routing provider, and a cold render took seconds. Deciding up
 * front keeps the same deterministic cap (the first
 * MAX_REALISTIC_DIRECTION_LEGS routable legs, flights never spending one) while
 * letting the fan-out happen in parallel.
 */
const planRealisticLegs = (
  coords: Array<{ lat: number; lng: number }>,
  legModes: TransportMode[],
): RealisticLegPlan[] => {
  let budget = MAX_REALISTIC_DIRECTION_LEGS;
  return coords.slice(0, -1).map((from, index) => {
    // Directions have no answer for a flight, so asking would only buy a
    // straight-line fallback. Draw the arc and keep the paid call for a leg
    // that can actually be routed.
    const isFlight = isFlightLeg(legModes, index);
    const routable = !isFlight && budget > 0;
    if (routable) budget -= 1;
    return { from, to: coords[index + 1], isFlight, routable };
  });
};

const buildRealisticPaths = async (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
  apiKey: string,
  legModes: TransportMode[] = [],
): Promise<string[]> => {
  if (coords.length < 2) return [];

  const plans = planRealisticLegs(coords, legModes);
  const geometries = await Promise.all(plans.map(async (plan) => {
    if (plan.isFlight) {
      return { encoded: encodePolyline(buildLegGeometry(plan.from, plan.to, true)), routed: true };
    }
    const encodedPolyline = plan.routable
      ? await fetchDirectionsPolyline(plan.from, plan.to, apiKey)
      : null;
    return encodedPolyline ? { encoded: encodedPolyline, routed: true } : { encoded: null, routed: false };
  }));

  return geometries.flatMap((geometry, index) => {
    const color = resolveLegColor(legColors, index, fallbackColor);
    if (geometry.routed && geometry.encoded) {
      return [`color:0x${color}|weight:4|enc:${geometry.encoded}`];
    }
    const fallbackSegment = buildSimplePath([plans[index].from, plans[index].to], color);
    return fallbackSegment ? [fallbackSegment] : [];
  });
};

const buildMapboxSimpleSegmentOverlays = (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
  legModes: TransportMode[] = [],
): string[] => {
  if (coords.length < 2) return [];
  const overlays: string[] = [];
  for (let index = 0; index < coords.length - 1; index += 1) {
    const color = resolveLegColor(legColors, index, fallbackColor);
    const geometry = buildLegGeometry(coords[index], coords[index + 1], isFlightLeg(legModes, index));
    overlays.push(buildMapboxPathOverlay(encodePolyline(geometry), color));
  }
  return overlays;
};

/** Last-resort overlays: straight lines everywhere, used only past the URL cap. */
const buildMapboxStraightSegmentOverlays = (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
): string[] => buildMapboxSimpleSegmentOverlays(coords, legColors, fallbackColor, []);

/**
 * Mapbox previews draw the same realistic geometry as the Google ones.
 * Directions come from Mapbox first (the provider whose token is guaranteed to
 * be present on a Mapbox preview), and only fall back to Google Directions when
 * Mapbox has no route for a leg. Without this the Mapbox branch silently drew
 * straight lines on every deployment that has no Google key.
 */
const buildMapboxRealisticOverlays = async (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
  mapboxToken: string,
  googleApiKey: string,
  legModes: TransportMode[] = [],
): Promise<string[]> => {
  if (coords.length < 2) return [];

  const plans = planRealisticLegs(coords, legModes);
  const geometries = await Promise.all(plans.map(async (plan) => {
    if (plan.isFlight) return encodePolyline(buildLegGeometry(plan.from, plan.to, true));
    if (!plan.routable) return encodePolyline([plan.from, plan.to]);

    let encodedPolyline: string | null = null;
    if (mapboxToken) {
      encodedPolyline = await fetchMapboxDirectionsPolyline(plan.from, plan.to, mapboxToken);
    }
    if (!encodedPolyline && googleApiKey) {
      encodedPolyline = await fetchDirectionsPolyline(plan.from, plan.to, googleApiKey);
    }
    return encodedPolyline || encodePolyline([plan.from, plan.to]);
  }));

  return geometries.map((geometry, index) => buildMapboxPathOverlay(
    geometry,
    resolveLegColor(legColors, index, fallbackColor),
  ));
};

const buildMapboxMarkerOverlays = (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  pathColor: string,
  startMarkerColor: string,
  endMarkerColor: string,
  waypointColor: string,
): string[] => {
  if (coords.length === 0) return [];

  const overlays: string[] = [];
  const start = coords[0];
  overlays.push(`pin-s-s+${startMarkerColor}(${start.lng.toFixed(6)},${start.lat.toFixed(6)})`);

  if (coords.length > 1) {
    const end = coords[coords.length - 1];
    overlays.push(`pin-s-e+${endMarkerColor}(${end.lng.toFixed(6)},${end.lat.toFixed(6)})`);
  }

  coords.slice(1, -1).forEach((coord, index) => {
    const legWaypointColor = legColors[Math.min(index + 1, legColors.length - 1)] || waypointColor || pathColor;
    overlays.push(`pin-s+${legWaypointColor}(${coord.lng.toFixed(6)},${coord.lat.toFixed(6)})`);
  });

  return overlays;
};

const buildMapboxStaticPreviewUrl = async ({
  coords,
  style,
  routeMode,
  legColors,
  legModes,
  pathColor,
  startMarkerColor,
  endMarkerColor,
  waypointColor,
  width,
  height,
  scale,
  zoom,
  mapboxToken,
  googleApiKey,
}: {
  coords: Array<{ lat: number; lng: number }>;
  style: MapPreviewStyle;
  routeMode: RoutePreviewMode;
  legColors: string[];
  legModes: TransportMode[];
  pathColor: string;
  startMarkerColor: string;
  endMarkerColor: string;
  waypointColor: string;
  width: number;
  height: number;
  scale: number;
  zoom: number | null;
  mapboxToken: string;
  googleApiKey: string;
}): Promise<string> => {
  const styleDescriptor = MAPBOX_STYLE_IDS[style] || MAPBOX_STYLE_IDS.standard;
  const simpleOverlays = buildMapboxSimpleSegmentOverlays(coords, legColors, pathColor, legModes);
  const straightOverlays = buildMapboxStraightSegmentOverlays(coords, legColors, pathColor);
  const pathOverlays = routeMode === "realistic" && (mapboxToken || googleApiKey)
    ? await buildMapboxRealisticOverlays(coords, legColors, pathColor, mapboxToken, googleApiKey, legModes)
    : simpleOverlays;
  const markerOverlays = buildMapboxMarkerOverlays(
    coords,
    legColors,
    pathColor,
    startMarkerColor,
    endMarkerColor,
    waypointColor,
  );
  const encodeOverlays = (entries: string[]): string =>
    entries.map((overlay) => encodeURIComponent(overlay)).join(",");
  // Mapbox rejects requests past its URL limit, and realistic geometry is what
  // pushes a long itinerary over it. Degrade that request to the straight-line
  // overlays rather than serving a broken image.
  let overlaySegment = encodeOverlays([...pathOverlays, ...markerOverlays]);
  if (overlaySegment.length > MAPBOX_MAX_OVERLAY_SEGMENT_LENGTH) {
    // Drop routed geometry first, flight arcs only if the request is still too long.
    overlaySegment = encodeOverlays([...simpleOverlays, ...markerOverlays]);
  }
  if (overlaySegment.length > MAPBOX_MAX_OVERLAY_SEGMENT_LENGTH) {
    overlaySegment = encodeOverlays([...straightOverlays, ...markerOverlays]);
  }
  const scaleSuffix = scale === 2 ? "@2x" : "";
  // WebP is ~35% smaller than the PNG Mapbox returns by default, at the same
  // pixel density: ~146 KB in place of ~256 KB for a 640x360@2x card. Mapbox
  // static renders come in PNG or WebP only; the .jpg variants 404.
  const formatSuffix = ".webp";
  // `auto` fits the overlays, which for a single pin means the tightest frame
  // Mapbox can draw — a rooftop with no surroundings. An explicit camera is
  // what lets one place be shown in its neighbourhood.
  const camera = zoom !== null && coords.length === 1
    ? `${coords[0].lng.toFixed(6)},${coords[0].lat.toFixed(6)},${zoom},0`
    : "auto";
  const url = new URL(`https://api.mapbox.com/styles/v1/${styleDescriptor.owner}/${styleDescriptor.styleId}/static/${overlaySegment}/${camera}/${width}x${height}${scaleSuffix}${formatSuffix}`);
  if (camera === "auto") url.searchParams.set("padding", "32,32,32,32");
  url.searchParams.set("access_token", mapboxToken);
  return url.toString();
};

// One request costs 1 token; a "realistic" route request costs more because it
// can fan out to up to MAX_REALISTIC_DIRECTION_LEGS paid Directions API calls.
// The bucket has to absorb a whole card grid at once: trip cards now request
// realistic routes, and a profile or manager page renders a dozen of them in a
// single paint, so a capacity that only covered a handful returned 429s as
// broken card images.
const RATE_LIMIT_BUCKET_CAPACITY = 90;
const RATE_LIMIT_REFILL_PER_SECOND = 0.5; // ≈30 simple previews per minute per IP
const REALISTIC_ROUTE_REQUEST_COST = 3;

const previewRateLimiter = createTokenBucketLimiter({
  capacity: RATE_LIMIT_BUCKET_CAPACITY,
  refillPerSecond: RATE_LIMIT_REFILL_PER_SECOND,
});

/**
 * A preview URL describes one picture and nothing else, so a hit stays fresh
 * for a month at the CDN and is then served stale while it re-renders in the
 * background. A trip edit produces a different URL rather than invalidating
 * this one, so nothing here has to be purged.
 */
const SUCCESS_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  "Netlify-CDN-Cache-Control": "public, durable, s-maxage=2592000, stale-while-revalidate=31536000",
  "Netlify-Vary": buildPreviewNetlifyVaryValue(),
};

/**
 * The redirect the proxy replaced, kept as the degraded path. When the render
 * cannot be fetched here the browser can still load it from the provider, so a
 * slow upstream costs the card its cache entry rather than its image. It is
 * deliberately uncacheable: the next request should try the proxy again.
 */
const UNCACHED_REDIRECT_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
};

const badRequest = (message: string): Response =>
  new Response(message, {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });

export type PreviewUpstreamResolution =
  | { ok: true; url: string }
  | { ok: false; status: number; message: string };

/**
 * Resolves the provider URL for a preview request: everything the picture
 * depends on, and nothing about how the response is delivered. Exported so the
 * geometry can be asserted without going through the image fetch.
 */
export const resolvePreviewUpstreamUrl = async (
  request: Request,
): Promise<PreviewUpstreamResolution> => {
  const url = new URL(request.url);
  const mapRuntime = await resolveEdgeMapRuntimeAsync(request);
  const coordsParam = url.searchParams.get("coords");

  if (!coordsParam) {
    return { ok: false, status: 400, message: "Missing 'coords' query parameter" };
  }

  const parsedCoords = parsePreviewCoords(coordsParam);
  if (!parsedCoords.ok) {
    return { ok: false, status: 400, message: parsedCoords.error };
  }
  const coords = parsedCoords.coords;

  const routeMode = parseRouteMode(url.searchParams.get("routeMode"));
  const legModes = parseMapPreviewLegModes(url.searchParams.get("legModes"));

  const w = clampInt(Number.parseInt(url.searchParams.get("w") || "680", 10), 240, 1280);
  const h = clampInt(Number.parseInt(url.searchParams.get("h") || "288", 10), 160, 960);
  const scale = clampInt(Number.parseInt(url.searchParams.get("scale") || "2", 10), 1, 2);
  const zoomParam = url.searchParams.get("zoom");
  const zoom = zoomParam === null || zoomParam.trim() === ""
    ? null
    : clampInt(Number.parseInt(zoomParam, 10), 1, 20);
  const requestedStyle = parseStyle(url.searchParams.get("style"));
  const style = getEffectiveStaticMapStyle(requestedStyle);
  const colorMode = parseColorMode(url.searchParams.get("colorMode"));
  const googleApiKey = getMapsApiKeyFromEnv();
  const mapboxToken = getMapboxAccessTokenFromEnv();

  const requestedPathColor = normalizeColor(url.searchParams.get("pathColor"));
  const pathColor = colorMode === "trip" ? (requestedPathColor || BRAND_ROUTE_COLOR) : BRAND_ROUTE_COLOR;
  const requestedLegColors = parseLegColors(url.searchParams.get("legColors"));
  const legColors = coords.slice(0, -1).map((_, index) =>
    colorMode === "trip"
      ? resolveLegColor(requestedLegColors, index, pathColor)
      : BRAND_ROUTE_COLOR
  );
  const requestedStartMarkerColor = normalizeColor(url.searchParams.get("startMarkerColor"));
  const requestedEndMarkerColor = normalizeColor(url.searchParams.get("endMarkerColor"));
  const requestedWaypointColor = normalizeColor(url.searchParams.get("waypointColor"));
  const startMarkerColor = requestedStartMarkerColor || shiftColor(legColors[0] || pathColor, -24);
  const endMarkerColor = requestedEndMarkerColor || shiftColor(legColors[legColors.length - 1] || pathColor, 38);
  const waypointColor = requestedWaypointColor || pathColor;
  const mapLanguage = parseMapLanguage(url.searchParams.get("language"));

  if (mapRuntime.effectiveSelection.staticMaps === "mapbox" && mapboxToken) {
    const mapUrl = await buildMapboxStaticPreviewUrl({
      coords,
      style: requestedStyle,
      routeMode,
      legColors,
      legModes,
      pathColor,
      startMarkerColor,
      endMarkerColor,
      waypointColor,
      width: w,
      height: h,
      scale,
      zoom,
      mapboxToken,
      googleApiKey,
    });

    return { ok: true, url: mapUrl };
  }

  if (!googleApiKey) {
    return { ok: false, status: 500, message: "Maps API key not configured" };
  }

  const params = new URLSearchParams();
  params.set("size", `${w}x${h}`);
  params.set("scale", String(scale));
  params.set("maptype", getMapType(style));
  if (zoom !== null && coords.length === 1) {
    params.set("zoom", String(zoom));
    params.set("center", formatCoord(coords[0]));
  }
  if (mapLanguage) {
    params.set("language", mapLanguage);
  }

  getStyleTokens(style).forEach((token) => {
    params.append("style", token);
  });

  const simplePathParams = buildSimpleSegmentPaths(coords, legColors, pathColor, legModes);
  const pathParams = routeMode === "realistic"
    ? await buildRealisticPaths(coords, legColors, pathColor, googleApiKey, legModes)
    : simplePathParams;

  if (pathParams.length === 0) {
    pathParams.push(...simplePathParams);
  }

  if (pathParams.length === 0) {
    const simplePath = buildSimplePath(coords, legColors[0] || pathColor);
    if (simplePath) pathParams.push(simplePath);
  }

  pathParams.forEach((path) => params.append("path", path));

  const start = coords[0];
  const end = coords[coords.length - 1];

  params.append("markers", `size:mid|color:0x${startMarkerColor}|label:S|${formatCoord(start)}`);
  if (coords.length > 1) {
    params.append("markers", `size:mid|color:0x${endMarkerColor}|label:E|${formatCoord(end)}`);
  }

  coords.slice(1, -1).forEach((coord, index) => {
    const legWaypointColor = legColors[Math.min(index + 1, legColors.length - 1)] || waypointColor;
    params.append("markers", `size:tiny|color:0x${legWaypointColor}|${formatCoord(coord)}`);
  });

  params.set("key", googleApiKey);

  return { ok: true, url: `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}` };
};

/**
 * Streams the rendered image back under our own origin. The bytes become a CDN
 * object instead of a per-visitor call to the provider, the browser saves a
 * redirect round trip, and the provider token stays server-side — except on the
 * degraded path, where handing the browser the URL is the only way to show the
 * card at all.
 */
const proxyPreviewImage = async (upstreamUrl: string): Promise<Response> => {
  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(upstreamUrl, UPSTREAM_IMAGE_TIMEOUT_MS);
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: upstreamUrl, ...UNCACHED_REDIRECT_HEADERS },
    });
  }

  if (!upstream.ok || !upstream.body) {
    // A provider error must not be cached as if it were the trip's picture.
    return new Response(null, {
      status: 302,
      headers: { Location: upstreamUrl, ...UNCACHED_REDIRECT_HEADERS },
    });
  }

  const headers = new Headers(SUCCESS_CACHE_HEADERS);
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "image/png");
  const etag = upstream.headers.get("ETag");
  if (etag) headers.set("ETag", etag);

  return new Response(upstream.body, { status: 200, headers });
};

export default async (request: Request, context?: { ip?: string }) => {
  const url = new URL(request.url);
  const coordsParam = url.searchParams.get("coords");

  if (!coordsParam) {
    return badRequest("Missing 'coords' query parameter");
  }

  const parsedCoords = parsePreviewCoords(coordsParam);
  if (!parsedCoords.ok) {
    return badRequest(parsedCoords.error);
  }

  const routeMode = parseRouteMode(url.searchParams.get("routeMode"));

  const clientIp = resolvePreviewClientIp(request, context);
  const requestCost = routeMode === "realistic" ? REALISTIC_ROUTE_REQUEST_COST : 1;
  const rateDecision = previewRateLimiter.consume(clientIp, requestCost);
  if (!rateDecision.allowed) {
    return new Response("Too many map preview requests, slow down", {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(rateDecision.retryAfterSeconds),
      },
    });
  }

  const upstream = await resolvePreviewUpstreamUrl(request);
  if (!upstream.ok) {
    return new Response(upstream.message, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return proxyPreviewImage(upstream.url);
};
