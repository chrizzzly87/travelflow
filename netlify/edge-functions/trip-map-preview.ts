/**
 * Edge function that proxies Google Static Maps API requests.
 * Returns a 302 redirect to a styled map image.
 *
 * Query params:
 *   coords     — pipe-separated lat,lng pairs (e.g. "35.68,139.65|34.69,135.50")
 *   style      — "clean" (default) | "minimal" | "standard" | "dark" | "satellite"
 *   routeMode  — "simple" (default) | "realistic"
 *   colorMode  — "brand" (default) | "trip"
 *   pathColor  — optional hex/rgb color (used when colorMode=trip)
 *   legColors  — optional pipe/comma-separated hex/rgb colors (used per route leg when colorMode=trip)
 *   w          — width in pixels (default 680)
 *   h          — height in pixels (default 288)
 *   scale      — 1 or 2 (default 2)
 */

import { getMapsApiKeyFromEnv } from "../edge-lib/trip-og-data.ts";

type MapPreviewStyle = "clean" | "minimal" | "standard" | "dark" | "satellite";
type RoutePreviewMode = "simple" | "realistic";
type MapPreviewColorMode = "brand" | "trip";

const BRAND_ROUTE_COLOR = "4f46e5";
const MAX_REALISTIC_DIRECTION_LEGS = 8;
const STATIC_MAP_SATELLITE_FALLBACK: MapPreviewStyle = "clean";

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

const parseCoords = (value: string): Array<{ lat: number; lng: number }> => {
  return value
    .split("|")
    .map((pair) => {
      const [lat, lng] = pair.split(",").map(Number);
      return { lat, lng };
    })
    .filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng));
};

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
    const response = await fetch(directionsUrl.toString());
    if (!response.ok) return null;
    const data = await response.json();
    const encoded = data?.routes?.[0]?.overview_polyline?.points;
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

const resolveLegColor = (legColors: string[], index: number, fallback: string): string => {
  if (legColors.length === 0) return fallback;
  return legColors[index] || legColors[legColors.length - 1] || fallback;
};

const buildSimpleSegmentPaths = (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
): string[] => {
  if (coords.length < 2) return [];
  const paths: string[] = [];

  for (let index = 0; index < coords.length - 1; index += 1) {
    const color = resolveLegColor(legColors, index, fallbackColor);
    const segment = buildSimplePath([coords[index], coords[index + 1]], color);
    if (segment) paths.push(segment);
  }

  return paths;
};

const buildRealisticPaths = async (
  coords: Array<{ lat: number; lng: number }>,
  legColors: string[],
  fallbackColor: string,
  apiKey: string,
): Promise<string[]> => {
  if (coords.length < 2) return [];
  const paths: string[] = [];
  let calls = 0;

  for (let index = 0; index < coords.length - 1; index += 1) {
    const from = coords[index];
    const to = coords[index + 1];
    const color = resolveLegColor(legColors, index, fallbackColor);

    let encodedPolyline: string | null = null;
    if (calls < MAX_REALISTIC_DIRECTION_LEGS) {
      encodedPolyline = await fetchDirectionsPolyline(from, to, apiKey);
      calls += 1;
    }

    if (encodedPolyline) {
      paths.push(`color:0x${color}|weight:4|enc:${encodedPolyline}`);
      continue;
    }

    const fallbackSegment = buildSimplePath([from, to], color);
    if (fallbackSegment) paths.push(fallbackSegment);
  }

  return paths;
};

export default async (request: Request) => {
  const url = new URL(request.url);
  const coordsParam = url.searchParams.get("coords");

  if (!coordsParam) {
    return new Response("Missing 'coords' query parameter", { status: 400 });
  }

  const coords = parseCoords(coordsParam);
  if (coords.length < 2) {
    return new Response("At least two valid coordinates are required", { status: 400 });
  }

  const w = clampInt(Number.parseInt(url.searchParams.get("w") || "680", 10), 240, 1280);
  const h = clampInt(Number.parseInt(url.searchParams.get("h") || "288", 10), 160, 960);
  const scale = clampInt(Number.parseInt(url.searchParams.get("scale") || "2", 10), 1, 2);
  const requestedStyle = parseStyle(url.searchParams.get("style"));
  const style = getEffectiveStaticMapStyle(requestedStyle);
  const routeMode = parseRouteMode(url.searchParams.get("routeMode"));
  const colorMode = parseColorMode(url.searchParams.get("colorMode"));

  const apiKey = getMapsApiKeyFromEnv();
  if (!apiKey) {
    return new Response("Maps API key not configured", { status: 500 });
  }

  const requestedPathColor = normalizeColor(url.searchParams.get("pathColor"));
  const pathColor = colorMode === "trip" ? (requestedPathColor || BRAND_ROUTE_COLOR) : BRAND_ROUTE_COLOR;
  const requestedLegColors = parseLegColors(url.searchParams.get("legColors"));
  const legColors = coords.slice(0, -1).map((_, index) =>
    colorMode === "trip"
      ? resolveLegColor(requestedLegColors, index, pathColor)
      : BRAND_ROUTE_COLOR
  );
  const startMarkerColor = shiftColor(legColors[0] || pathColor, -24);
  const endMarkerColor = shiftColor(legColors[legColors.length - 1] || pathColor, 38);

  const params = new URLSearchParams();
  params.set("size", `${w}x${h}`);
  params.set("scale", String(scale));
  params.set("maptype", getMapType(style));

  getStyleTokens(style).forEach((token) => {
    params.append("style", token);
  });

  const simplePathParams = buildSimpleSegmentPaths(coords, legColors, pathColor);
  const pathParams = routeMode === "realistic"
    ? await buildRealisticPaths(coords, legColors, pathColor, apiKey)
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
  params.append("markers", `size:mid|color:0x${endMarkerColor}|label:E|${formatCoord(end)}`);

  coords.slice(1, -1).forEach((coord, index) => {
    const waypointColor = legColors[Math.min(index + 1, legColors.length - 1)] || pathColor;
    params.append("markers", `size:tiny|color:0x${waypointColor}|${formatCoord(coord)}`);
  });

  params.set("key", apiKey);

  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: mapUrl,
      "Cache-Control": "public, max-age=86400",
    },
  });
};
