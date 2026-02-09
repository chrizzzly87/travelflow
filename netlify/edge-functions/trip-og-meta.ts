import {
  buildCanonicalUrl,
  buildOgImageUrl,
  buildTripOgSummary,
  escapeHtml,
  fallbackSummary,
  fetchSharedTrip,
  getMapsApiKeyFromEnv,
  isOgMapStyle,
  isOgRouteMode,
  type OgMapStyle,
  type OgRouteMode,
  parseRouteTarget,
} from "../edge-lib/trip-og-data.ts";

const SITE_NAME = "TravelFlow";
const DEFAULT_DESCRIPTION = "Plan and share travel routes with TravelFlow.";
const SHARE_CACHE_CONTROL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
const TRIP_CACHE_CONTROL = "public, max-age=0, s-maxage=120, stale-while-revalidate=3600";

interface Metadata {
  pageTitle: string;
  description: string;
  canonicalUrl: string;
  ogImageUrl: string;
  robots: string;
}

interface OgPreferenceOverrides {
  mapStyle: OgMapStyle | null;
  routeMode: OgRouteMode | null;
  showStops: boolean | null;
  showCities: boolean | null;
}

const parseBooleanOverride = (value: string | null): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
};

const stripSeoTags = (html: string): string => {
  const patterns = [
    /<title>[\s\S]*?<\/title>/gi,
    /<meta[^>]+name=["']description["'][^>]*>/gi,
    /<meta[^>]+name=["']robots["'][^>]*>/gi,
    /<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi,
    /<link[^>]+rel=["']canonical["'][^>]*>/gi,
  ];

  return patterns.reduce((acc, regex) => acc.replace(regex, ""), html);
};

const buildMetaTags = (meta: Metadata): string => {
  const title = escapeHtml(meta.pageTitle);
  const description = escapeHtml(meta.description);
  const canonicalUrl = escapeHtml(meta.canonicalUrl);
  const ogImageUrl = escapeHtml(meta.ogImageUrl);
  const robots = escapeHtml(meta.robots);

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<meta property="og:image" content="${ogImageUrl}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${title}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${ogImageUrl}" />`,
  ].join("\n");
};

const injectMetaTags = (html: string, meta: Metadata): string => {
  if (!/<head[^>]*>/i.test(html) || !/<\/head>/i.test(html)) {
    return html;
  }

  const cleaned = stripSeoTags(html);
  const metaTags = buildMetaTags(meta);
  return cleaned.replace(/<\/head>/i, `${metaTags}\n</head>`);
};

const buildFallbackMetadata = (
  origin: string,
  routeTarget: NonNullable<ReturnType<typeof parseRouteTarget>>,
  pathname: string,
  overrides: OgPreferenceOverrides,
): Metadata => {
  const pageTitle = `${SITE_NAME} Trip Planner`;
  const description = DEFAULT_DESCRIPTION;
  const canonicalUrl = buildCanonicalUrl(origin, routeTarget) || new URL(pathname, origin).toString();
  const ogImageUrl = buildOgImageUrl(origin, {
    tripId: routeTarget.tripId,
    versionId: routeTarget.versionId,
    mapStyle: overrides.mapStyle,
    routeMode: overrides.routeMode,
    showStops: overrides.showStops,
    showCities: overrides.showCities,
  });

  return {
    pageTitle,
    description,
    canonicalUrl,
    ogImageUrl,
    robots: "noindex,nofollow,max-image-preview:large",
  };
};

const buildShareMetadata = async (
  origin: string,
  routeTarget: NonNullable<ReturnType<typeof parseRouteTarget>>,
  overrides: OgPreferenceOverrides,
): Promise<Metadata> => {
  if (!routeTarget.token) {
    return buildFallbackMetadata(origin, routeTarget, "/", overrides);
  }

  const mapsApiKey = getMapsApiKeyFromEnv();
  const sharedTrip = await fetchSharedTrip(routeTarget.token, routeTarget.versionId);
  const summary = sharedTrip
    ? await buildTripOgSummary(sharedTrip.trip, {
      mapsApiKey,
      mapStyle: overrides.mapStyle ?? sharedTrip.viewSettings?.mapStyle,
      routeMode: overrides.routeMode ?? sharedTrip.viewSettings?.routeMode,
      showStops: overrides.showStops ?? sharedTrip.viewSettings?.showStops,
      showCities: overrides.showCities ??
        sharedTrip.viewSettings?.showCities ??
        sharedTrip.viewSettings?.showCityNames,
      showCityNames: sharedTrip.viewSettings?.showCityNames,
      includeMapImage: false,
    })
    : fallbackSummary();

  const title = `${summary.title} | ${SITE_NAME}`;
  const canonicalUrl = buildCanonicalUrl(origin, routeTarget);
  const ogImageUrl = buildOgImageUrl(origin, {
    token: routeTarget.token,
    versionId: routeTarget.versionId ?? sharedTrip?.resolvedVersionId ?? null,
    updatedAt: summary.updatedAt,
    mapStyle: overrides.mapStyle ?? sharedTrip?.viewSettings?.mapStyle ?? null,
    routeMode: overrides.routeMode ?? sharedTrip?.viewSettings?.routeMode ?? null,
    showStops: overrides.showStops ?? sharedTrip?.viewSettings?.showStops ?? null,
    showCities: overrides.showCities ??
      sharedTrip?.viewSettings?.showCities ??
      sharedTrip?.viewSettings?.showCityNames ??
      null,
  });

  return {
    pageTitle: title,
    description: summary.description,
    canonicalUrl,
    ogImageUrl,
    robots: "noindex,nofollow,max-image-preview:large",
  };
};

export default async (request: Request, context: { next: () => Promise<Response> }): Promise<Response> => {
  const url = new URL(request.url);
  const routeTarget = parseRouteTarget(url);
  const mapStyleQuery = url.searchParams.get("mapStyle")?.trim() || "";
  const routeModeQuery = url.searchParams.get("routeMode")?.trim() || "";
  const showStopsOverride = parseBooleanOverride(url.searchParams.get("showStops"));
  const overrides: OgPreferenceOverrides = {
    mapStyle: isOgMapStyle(mapStyleQuery) ? mapStyleQuery : null,
    routeMode: isOgRouteMode(routeModeQuery) ? routeModeQuery : null,
    showStops: showStopsOverride,
    showCities: parseBooleanOverride(url.searchParams.get("showCities")) ??
      parseBooleanOverride(url.searchParams.get("cityNames")),
  };
  const baseResponse = await context.next();
  const fallbackResponse = baseResponse.clone();
  const contentType = baseResponse.headers.get("content-type") || "";

  if (!routeTarget) {
    return baseResponse;
  }

  if (!contentType.includes("text/html")) {
    return baseResponse;
  }

  try {
    const metadata = routeTarget.token
      ? await buildShareMetadata(url.origin, routeTarget, overrides)
      : buildFallbackMetadata(url.origin, routeTarget, url.pathname, overrides);

    const html = await baseResponse.text();
    const rewrittenHtml = injectMetaTags(html, metadata);
    const headers = new Headers(baseResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set(
      "cache-control",
      routeTarget.token ? SHARE_CACHE_CONTROL : TRIP_CACHE_CONTROL,
    );
    headers.delete("content-length");
    headers.delete("etag");

    return new Response(rewrittenHtml, {
      status: baseResponse.status,
      statusText: baseResponse.statusText,
      headers,
    });
  } catch {
    // If OG/meta generation fails, never block the shared-trip page.
    return fallbackResponse;
  }
};
