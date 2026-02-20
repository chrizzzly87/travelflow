import React from "https://esm.sh/react@18.3.1";
import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";
import {
  buildDisplayPath,
  buildTripOgSummary,
  fallbackSummary,
  fetchSharedTrip,
  fetchSharedTripByTripId,
  getMapsApiKeyFromEnv,
  isMapColorMode,
  isOgMapStyle,
  isOgRouteMode,
  type MapColorMode,
  type OgMapStyle,
  type TripOgMapLabel,
  type OgRouteMode,
} from "../edge-lib/trip-og-data.ts";
import { APP_NAME } from "../../config/appGlobals.ts";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const SITE_NAME = APP_NAME;
const HEADLINE_FONT_FAMILY = "Bricolage Grotesque";
const LOCAL_HEADLINE_FONT_400_LATIN_EXT_WOFF_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext-400-normal.woff";
const LOCAL_HEADLINE_FONT_400_WOFF_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin-400-normal.woff";
const LOCAL_HEADLINE_FONT_700_LATIN_EXT_WOFF_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext-700-normal.woff";
const LOCAL_HEADLINE_FONT_700_WOFF_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin-700-normal.woff";
const CDN_HEADLINE_FONT_400_LATIN_EXT_WOFF_URL =
  "https://unpkg.com/@fontsource/bricolage-grotesque@5.2.10/files/bricolage-grotesque-latin-ext-400-normal.woff";
const CDN_HEADLINE_FONT_400_WOFF_URL =
  "https://unpkg.com/@fontsource/bricolage-grotesque@5.2.10/files/bricolage-grotesque-latin-400-normal.woff";
const GOOGLE_HEADLINE_FONT_400_WOFF_URL =
  "https://fonts.gstatic.com/l/font?kit=3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJWiaaD30YfKfjZZoLvRviyM4&skey=7f69194495102d00&v=v9";
const CDN_HEADLINE_FONT_700_LATIN_EXT_WOFF_URL =
  "https://unpkg.com/@fontsource/bricolage-grotesque@5.2.10/files/bricolage-grotesque-latin-ext-700-normal.woff";
const CDN_HEADLINE_FONT_700_WOFF_URL =
  "https://unpkg.com/@fontsource/bricolage-grotesque@5.2.10/files/bricolage-grotesque-latin-700-normal.woff";
const GOOGLE_HEADLINE_FONT_700_WOFF_URL =
  "https://fonts.gstatic.com/l/font?kit=3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJWiaaD30YfKfjZZoLvfzlyM4&skey=7f69194495102d00&v=v9";
const LOCAL_HEADLINE_FONT_800_LATIN_EXT_WOFF_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext-800-normal.woff";
const LOCAL_HEADLINE_FONT_800_WOFF_PATH =
  "/fonts/bricolage-grotesque/bricolage-grotesque-latin-800-normal.woff";
const CDN_HEADLINE_FONT_800_LATIN_EXT_WOFF_URL =
  "https://unpkg.com/@fontsource/bricolage-grotesque@5.2.10/files/bricolage-grotesque-latin-ext-800-normal.woff";
const CDN_HEADLINE_FONT_800_WOFF_URL =
  "https://unpkg.com/@fontsource/bricolage-grotesque@5.2.10/files/bricolage-grotesque-latin-800-normal.woff";
const GOOGLE_HEADLINE_FONT_800_WOFF_URL =
  "https://fonts.gstatic.com/l/font?kit=3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJWiaaD30YfKfjZZoLvZvlyM4&skey=7f69194495102d00&v=v9";

const VERSION_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LoadedHeadingFont = {
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
};

type BaseHeadingFontWeight = 400 | 700 | 800;
type OgHeadingFontWeight = LoadedHeadingFont["weight"];
const BASE_HEADING_FONT_WEIGHTS: readonly BaseHeadingFontWeight[] = [400, 700, 800];
const OG_HEADING_FONT_WEIGHTS: readonly OgHeadingFontWeight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

const headingFontPromiseByOrigin = new Map<string, Promise<LoadedHeadingFont[]>>();
const WOFF_SIGNATURE = "wOFF";
const WOFF2_SIGNATURE = "wOF2";
const OTF_SIGNATURE = "OTTO";
const TTC_SIGNATURE = "ttcf";

const fetchFontArrayBuffer = async (fontUrl: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
};

// og_edge picks the first matching font per weight and does not merge unicode-range subsets.
// Keep full latin files first so ASCII headlines do not fall back to system fonts.
const buildHeadingFontUrls = (requestUrl: URL, weight: BaseHeadingFontWeight): string[] => {
  const local400LatinExt = new URL(LOCAL_HEADLINE_FONT_400_LATIN_EXT_WOFF_PATH, requestUrl.origin).toString();
  const local400 = new URL(LOCAL_HEADLINE_FONT_400_WOFF_PATH, requestUrl.origin).toString();
  const local700LatinExt = new URL(LOCAL_HEADLINE_FONT_700_LATIN_EXT_WOFF_PATH, requestUrl.origin).toString();
  const local700 = new URL(LOCAL_HEADLINE_FONT_700_WOFF_PATH, requestUrl.origin).toString();
  const cdn400LatinExt = CDN_HEADLINE_FONT_400_LATIN_EXT_WOFF_URL;
  const cdn400 = CDN_HEADLINE_FONT_400_WOFF_URL;
  const cdn700LatinExt = CDN_HEADLINE_FONT_700_LATIN_EXT_WOFF_URL;
  const local800 = new URL(LOCAL_HEADLINE_FONT_800_WOFF_PATH, requestUrl.origin).toString();
  const local800LatinExt = new URL(LOCAL_HEADLINE_FONT_800_LATIN_EXT_WOFF_PATH, requestUrl.origin).toString();
  const cdn700 = CDN_HEADLINE_FONT_700_WOFF_URL;
  const cdn800LatinExt = CDN_HEADLINE_FONT_800_LATIN_EXT_WOFF_URL;
  const cdn800 = CDN_HEADLINE_FONT_800_WOFF_URL;

  if (weight === 800) {
    return [
      local800,
      local800LatinExt,
      GOOGLE_HEADLINE_FONT_800_WOFF_URL,
      cdn800,
      cdn800LatinExt,
    ];
  }

  if (weight === 700) {
    return [
      local700,
      local700LatinExt,
      GOOGLE_HEADLINE_FONT_700_WOFF_URL,
      cdn700,
      cdn700LatinExt,
    ];
  }

  return [
    local400,
    local400LatinExt,
    GOOGLE_HEADLINE_FONT_400_WOFF_URL,
    cdn400,
    cdn400LatinExt,
  ];
};

const isSupportedOgFont = (fontData: ArrayBuffer): boolean => {
  if (fontData.byteLength < 4) return false;
  const bytes = new Uint8Array(fontData, 0, 4);
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (signature === WOFF2_SIGNATURE) return false;
  if (signature === WOFF_SIGNATURE || signature === OTF_SIGNATURE || signature === TTC_SIGNATURE) {
    return true;
  }
  return bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00;
};

const loadHeadingFontByWeight = async (
  requestUrl: URL,
  weight: BaseHeadingFontWeight,
): Promise<ArrayBuffer | null> => {
  for (const fontUrl of buildHeadingFontUrls(requestUrl, weight)) {
    const fontData = await fetchFontArrayBuffer(fontUrl);
    if (fontData && isSupportedOgFont(fontData)) return fontData;
  }
  return null;
};

const toExpandedOgHeadingFonts = (
  loadedByWeight: Map<BaseHeadingFontWeight, ArrayBuffer>,
): LoadedHeadingFont[] => {
  const availableEntries = BASE_HEADING_FONT_WEIGHTS
    .map((weight) => {
      const data = loadedByWeight.get(weight);
      return data ? ({ weight, data }) : null;
    })
    .filter((entry): entry is { weight: BaseHeadingFontWeight; data: ArrayBuffer } => Boolean(entry));

  if (availableEntries.length === 0) return [];

  return OG_HEADING_FONT_WEIGHTS.map((targetWeight) => {
    const exact = targetWeight === 400 || targetWeight === 700 || targetWeight === 800
      ? loadedByWeight.get(targetWeight)
      : null;
    if (exact) {
      return { weight: targetWeight, data: exact };
    }

    let closest = availableEntries[0];
    for (const candidate of availableEntries.slice(1)) {
      const currentDistance = Math.abs(candidate.weight - targetWeight);
      const closestDistance = Math.abs(closest.weight - targetWeight);
      if (currentDistance < closestDistance) {
        closest = candidate;
      }
    }

    return {
      weight: targetWeight,
      data: closest.data,
    };
  });
};

const loadHeadingFonts = async (requestUrl: URL): Promise<LoadedHeadingFont[]> => {
  const cacheKey = requestUrl.origin;
  let fontPromise = headingFontPromiseByOrigin.get(cacheKey);

  if (!fontPromise) {
    fontPromise = (async () => {
      const fontResults = await Promise.all(
        BASE_HEADING_FONT_WEIGHTS.map(async (weight) => ({
          weight,
          data: await loadHeadingFontByWeight(requestUrl, weight),
        })),
      );

      const loadedByWeight = new Map<BaseHeadingFontWeight, ArrayBuffer>();
      for (const result of fontResults) {
        if (result.data) loadedByWeight.set(result.weight, result.data);
      }

      return toExpandedOgHeadingFonts(loadedByWeight);
    })();
    headingFontPromiseByOrigin.set(cacheKey, fontPromise);
  }

  return fontPromise;
};

const isValidVersionId = (value?: string | null): value is string =>
  Boolean(value && VERSION_REGEX.test(value));

const sanitizeText = (value: string | null, max: number): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
};

const sanitizeMapUrl = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
};

const parseBooleanOverride = (value: string | null): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
};

const truncateText = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const splitWord = (word: string, maxChars: number): string[] => {
  if (word.length <= maxChars) return [word];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < word.length) {
    const remaining = word.length - cursor;
    const chunkSize = Math.min(remaining, remaining > maxChars ? maxChars - 1 : maxChars);
    const chunk = word.slice(cursor, cursor + chunkSize);
    cursor += chunkSize;
    chunks.push(cursor < word.length ? `${chunk}-` : chunk);
  }

  return chunks;
};

const wrapTitle = (value: string, maxChars: number, maxLines: number): string[] => {
  const words = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((word) => splitWord(word, maxChars));

  if (words.length === 0) return [value];

  const lines: string[] = [];
  let current = "";
  let index = 0;

  while (index < words.length) {
    const token = words[index];
    const candidate = current ? `${current} ${token}` : token;

    if (candidate.length <= maxChars) {
      current = candidate;
      index += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
      continue;
    }

    lines.push(token);
    index += 1;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  const hasOverflow = index < words.length;
  if (hasOverflow && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const raw = lines[lastIndex].replace(/…+$/g, "");
    const clipped = raw.length >= maxChars ? raw.slice(0, Math.max(1, maxChars - 1)) : raw;
    lines[lastIndex] = `${clipped}…`;
  }

  return lines;
};

const getTitleSpec = (title: string): { lines: string[]; fontSize: number } => {
  const normalized = title.trim() || "Shared Trip";
  const length = normalized.length;

  let fontSize = 66;
  let maxCharsPerLine = 21;

  if (length > 34) {
    fontSize = 58;
    maxCharsPerLine = 23;
  }
  if (length > 52) {
    fontSize = 52;
    maxCharsPerLine = 25;
  }
  if (length > 74) {
    fontSize = 46;
    maxCharsPerLine = 27;
  }
  if (length > 96) {
    fontSize = 40;
    maxCharsPerLine = 30;
  }
  if (length > 124) {
    fontSize = 36;
    maxCharsPerLine = 33;
  }

  return {
    lines: wrapTitle(normalized, maxCharsPerLine, 3),
    fontSize,
  };
};

const iconCircleStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9999,
  background: "rgba(79, 70, 229, 0.16)",
  color: "#312e81",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconImageStyle: React.CSSProperties = {
  width: 19,
  height: 19,
  display: "flex",
};

const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const METRIC_CALENDAR_ICON_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#312e81' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M8 2v4'/><path d='M16 2v4'/><rect width='18' height='18' x='3' y='4' rx='2'/><path d='M3 10h18'/></svg>`,
);

const METRIC_ROUTE_ICON_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#312e81' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='19' r='3'/><path d='M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15'/><circle cx='18' cy='5' r='3'/></svg>`,
);

const FOOTER_PLANE_ICON_URI = svgToDataUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#ffffff' stroke='none'><path d='M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'/></svg>`,
);

const iconImage = (src: string, alt: string) => <img src={src} alt={alt} style={iconImageStyle} />;

const metricRow = (icon: React.ReactNode, value: string) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
    }}
  >
    <div style={iconCircleStyle}>{icon}</div>
    <div
      style={{
        fontSize: 29,
        color: "#1f2937",
        display: "flex",
        lineHeight: 1.2,
      }}
    >
      {value}
    </div>
  </div>
);

const mapPanel = (mapUrl: string | null, mapLabels: TripOgMapLabel[]) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      position: "relative",
      borderRadius: 28,
      overflow: "hidden",
      border: "1px solid rgba(148, 163, 184, 0.35)",
      background: "#e2e8f0",
    }}
  >
    {mapUrl ? (
      <>
        <img
          src={mapUrl}
          alt="Trip map preview"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "flex",
          }}
        />
        {mapLabels.map((label, index) => (
          <div
            key={`map-label-${index}`}
            style={{
              position: "absolute",
              left: `${Math.round(label.x * 1000) / 10}%`,
              top: `${Math.round(label.y * 1000) / 10}%`,
              transform: "translate(2px, -50%)",
              display: "flex",
              flexDirection: "column",
              gap: 1,
              maxWidth: "56%",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.1,
                textShadow: "0 1px 2px rgba(255,255,255,0.92)",
                background: "rgba(255,255,255,0.56)",
                borderRadius: 8,
                padding: "2px 6px",
                whiteSpace: "nowrap",
              }}
            >
              {label.text}
            </div>
            {label.subLabel ? (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#4f46e5",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  textShadow: "0 1px 2px rgba(255,255,255,0.92)",
                  paddingLeft: 6,
                  lineHeight: 1.1,
                }}
              >
                {label.subLabel}
              </div>
            ) : null}
          </div>
        ))}
      </>
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          color: "#475569",
          padding: "0 24px",
          textAlign: "center",
          background:
            "linear-gradient(135deg, rgba(148, 163, 184, 0.24), rgba(71, 85, 105, 0.14))",
        }}
      >
        Map preview unavailable
      </div>
    )}
  </div>
);

const getCacheControl = (versionId: string | null, updateStamp: string | null): string => {
  if (isValidVersionId(versionId)) {
    return "public, max-age=0, s-maxage=31536000, stale-while-revalidate=31536000";
  }
  if (updateStamp && Number.isFinite(Number(updateStamp))) {
    return "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";
  }
  return "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400";
};

export default async (request: Request): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const shareToken = url.searchParams.get("s")?.trim() || "";
    const tripId = url.searchParams.get("trip")?.trim() || "";
    const requestedVersionId = url.searchParams.get("v");
    const versionId = isValidVersionId(requestedVersionId) ? requestedVersionId : null;
    const updateStamp = url.searchParams.get("u");
    const mapsApiKey = getMapsApiKeyFromEnv();
    const headingFonts = await loadHeadingFonts(url);

    const titleOverride = sanitizeText(url.searchParams.get("title"), 120);
    const weeksOverride = sanitizeText(url.searchParams.get("weeks"), 40);
    const monthsOverride = sanitizeText(url.searchParams.get("months"), 60);
    const distanceOverride = sanitizeText(url.searchParams.get("distance"), 40);
    const pathOverride = sanitizeText(url.searchParams.get("path"), 120);
    const mapOverride = sanitizeMapUrl(url.searchParams.get("map"));
    const mapStyleOverrideRaw = url.searchParams.get("mapStyle")?.trim() || "";
    const routeModeOverrideRaw = url.searchParams.get("routeMode")?.trim() || "";
    const mapColorModeOverrideRaw = url.searchParams.get("mapColorMode")?.trim() || "";
    const showStopsOverride = parseBooleanOverride(url.searchParams.get("showStops"));
    const showCitiesOverride = parseBooleanOverride(url.searchParams.get("showCities")) ??
      parseBooleanOverride(url.searchParams.get("cityNames"));
    const mapStyleOverride: OgMapStyle | null = isOgMapStyle(mapStyleOverrideRaw)
      ? mapStyleOverrideRaw
      : null;
    const routeModeOverride: OgRouteMode | null = isOgRouteMode(routeModeOverrideRaw)
      ? routeModeOverrideRaw
      : null;
    const mapColorModeOverride: MapColorMode | null = isMapColorMode(mapColorModeOverrideRaw)
      ? mapColorModeOverrideRaw
      : null;

    let summary = fallbackSummary();
    let routePath = "/";

    if (shareToken) {
      const sharedTrip = await fetchSharedTrip(shareToken, versionId);
      if (sharedTrip) {
        summary = await buildTripOgSummary(sharedTrip.trip, {
          mapsApiKey,
          mapStyle: mapStyleOverride ?? sharedTrip.viewSettings?.mapStyle,
          routeMode: routeModeOverride ?? sharedTrip.viewSettings?.routeMode,
          mapColorMode: mapColorModeOverride ?? sharedTrip.viewSettings?.mapColorMode ?? sharedTrip.trip.mapColorMode,
          showStops: showStopsOverride ?? sharedTrip.viewSettings?.showStops,
          showCities: showCitiesOverride ??
            sharedTrip.viewSettings?.showCities ??
            sharedTrip.viewSettings?.showCityNames,
          showCityNames: sharedTrip.viewSettings?.showCityNames,
        });
        routePath = buildDisplayPath({
          token: shareToken,
          versionId: versionId ?? sharedTrip.resolvedVersionId,
        });
      } else {
        routePath = `/s/${shareToken}`;
      }
    } else if (tripId) {
      routePath = buildDisplayPath({ tripId, versionId });
      const sharedByTripId = await fetchSharedTripByTripId(tripId, versionId);
      if (sharedByTripId) {
        const sharedTrip = sharedByTripId.sharedTrip;
        summary = await buildTripOgSummary(sharedTrip.trip, {
          mapsApiKey,
          mapStyle: mapStyleOverride ?? sharedTrip.viewSettings?.mapStyle,
          routeMode: routeModeOverride ?? sharedTrip.viewSettings?.routeMode,
          mapColorMode: mapColorModeOverride ?? sharedTrip.viewSettings?.mapColorMode ?? sharedTrip.trip.mapColorMode,
          showStops: showStopsOverride ?? sharedTrip.viewSettings?.showStops,
          showCities: showCitiesOverride ??
            sharedTrip.viewSettings?.showCities ??
            sharedTrip.viewSettings?.showCityNames,
          showCityNames: sharedTrip.viewSettings?.showCityNames,
        });
      }
    }

    if (titleOverride) summary.title = titleOverride;
    if (weeksOverride) summary.weeksLabel = weeksOverride;
    if (monthsOverride) summary.monthsLabel = monthsOverride;
    if (distanceOverride) summary.distanceLabel = distanceOverride;
    if (mapOverride) {
      summary.mapImageUrl = mapOverride;
      summary.mapLabels = [];
    }
    if (pathOverride) routePath = pathOverride;

    const durationAndMonths = summary.monthsLabel
      ? `${summary.weeksLabel} (${summary.monthsLabel})`
      : summary.weeksLabel;
    const distanceLabel = summary.distanceLabel || "Distance not available";

    const { lines: titleLines, fontSize: headlineFontSize } = getTitleSpec(
      summary.title || "Shared Trip",
    );
    const displayUrl = truncateText(`${url.host}${routePath}`, 56);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: "linear-gradient(165deg, #f8fafc 0%, #eef2ff 62%, #e0e7ff 100%)",
            color: "#0f172a",
            padding: 28,
            fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
            fontWeight: 400,
          }}
        >
          <div
            style={{
              width: "61%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              borderRadius: 28,
              padding: "36px 42px 34px",
              background: "rgba(255, 255, 255, 0.82)",
              border: "1px solid rgba(148, 163, 184, 0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "10px 18px",
                borderRadius: 9999,
                background: "#4f46e5",
                color: "#ffffff",
                fontSize: 21,
                fontWeight: 700,
                lineHeight: 1.2,
                fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
              }}
            >
              View my trip
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 18,
                fontSize: headlineFontSize,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -1.4,
                color: "#0f172a",
                textWrap: "pretty",
                fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
              }}
            >
              {titleLines.map((line, index) => (
                <div key={`title-line-${index}`} style={{ display: "flex" }}>
                  {line}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginTop: 26,
              }}
            >
              {metricRow(iconImage(METRIC_CALENDAR_ICON_URI, "Calendar"), durationAndMonths)}
              {metricRow(iconImage(METRIC_ROUTE_ICON_URI, "Route"), distanceLabel)}
            </div>

            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid rgba(148, 163, 184, 0.36)",
                paddingTop: 20,
                gap: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minWidth: 0,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#4f46e5",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ display: "flex", transform: "rotate(-3deg)" }}>
                    {iconImage(FOOTER_PLANE_ICON_URI, `${SITE_NAME} plane logo`)}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#111827",
                    display: "flex",
                    fontFamily: `"${HEADLINE_FONT_FAMILY}", "Avenir Next", "Segoe UI", sans-serif`,
                  }}
                >
                  {SITE_NAME}
                </div>
              </div>

              <div
                style={{
                  fontSize: 20,
                  color: "#475569",
                  display: "flex",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayUrl}
              </div>
            </div>
          </div>

          <div
            style={{
              width: "39%",
              height: "100%",
              display: "flex",
              paddingLeft: 20,
            }}
          >
            {mapPanel(summary.mapImageUrl, summary.mapLabels || [])}
          </div>
        </div>
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        headers: {
          "Cache-Control": getCacheControl(versionId, updateStamp),
        },
              ...(headingFonts.length
                ? {
                    fonts: headingFonts.map((font) => ({
                        name: HEADLINE_FONT_FAMILY,
                        data: font.data,
                        style: "normal",
                        weight: font.weight,
                      })),
                  }
                : {}),
            },
    );
  } catch (error) {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack || ""}`
      : String(error);
    return new Response(`OG render error\n${message}`, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
};
