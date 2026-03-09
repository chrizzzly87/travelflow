import {
  SITE_CACHE_CONTROL,
  TOOL_APP_CACHE_CONTROL,
  buildSiteOgMetadata,
  injectMetaTags,
  shouldUseStrictToolHtmlCache,
  type SiteOgMetadata,
} from "../edge-lib/site-og-metadata.ts";
import {
  isSiteOgStaticManifest,
  type SiteOgStaticManifest,
} from "../edge-lib/site-og-static-manifest.ts";

const SITE_OG_STATIC_MANIFEST_PATH = "/images/og/site/generated/manifest.json";
const SITE_OG_STATIC_MANIFEST_TTL_MS = 60_000;
const SITE_OG_STATIC_MANIFEST_TIMEOUT_MS = 1_200;

interface ManifestCacheState {
  fetchedAt: number;
  manifest: SiteOgStaticManifest | null;
}

let manifestCache: ManifestCacheState | null = null;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error("site-og-manifest-timeout"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};

const loadStaticManifest = async (origin: string): Promise<SiteOgStaticManifest | null> => {
  const now = Date.now();
  if (manifestCache && now - manifestCache.fetchedAt < SITE_OG_STATIC_MANIFEST_TTL_MS) {
    return manifestCache.manifest;
  }

  const manifestUrl = new URL(SITE_OG_STATIC_MANIFEST_PATH, origin).toString();

  try {
    const response = await withTimeout(fetch(manifestUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    }), SITE_OG_STATIC_MANIFEST_TIMEOUT_MS);

    if (!response.ok) {
      manifestCache = { fetchedAt: now, manifest: null };
      return null;
    }

    const parsed = await response.json();
    if (!isSiteOgStaticManifest(parsed)) {
      manifestCache = { fetchedAt: now, manifest: null };
      return null;
    }

    manifestCache = { fetchedAt: now, manifest: parsed };
    return parsed;
  } catch {
    manifestCache = { fetchedAt: now, manifest: null };
    return null;
  }
};

const toStaticOgImageUrl = (origin: string, path: string): string | null => {
  if (!path.startsWith("/images/og/site/generated/")) return null;
  if (!path.endsWith(".png")) return null;
  return new URL(path, origin).toString();
};

const resolveOgImageUrl = async (
  origin: string,
  metadata: SiteOgMetadata,
): Promise<{ ogImageUrl: string; source: "static" | "dynamic" }> => {
  const prefersDynamicTripCard = metadata.canonicalPath.startsWith("/example/");
  const prefersDynamicRtlCard = metadata.htmlDir === "rtl";
  if (prefersDynamicTripCard || prefersDynamicRtlCard) {
    return {
      ogImageUrl: metadata.ogImageUrl,
      source: "dynamic",
    };
  }

  const manifest = await loadStaticManifest(origin);
  const manifestEntry = manifest?.entries?.[metadata.routeKey];

  if (manifestEntry) {
    const staticUrl = toStaticOgImageUrl(origin, manifestEntry.path);
    if (staticUrl) {
      return {
        ogImageUrl: staticUrl,
        source: "static",
      };
    }
  }

  return {
    ogImageUrl: metadata.ogImageUrl,
    source: "dynamic",
  };
};

const fetchSpaHtmlFallback = async (origin: string): Promise<Response | null> => {
  try {
    const response = await fetch(new URL("/index.html", origin).toString(), {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    return response;
  } catch {
    return null;
  }
};

export default async (request: Request, context: { next: () => Promise<Response> }): Promise<Response> => {
  const url = new URL(request.url);
  let baseResponse: Response | null = null;
  let fallbackResponse: Response | null = null;
  let usedSpaFallback = false;

  try {
    baseResponse = await context.next();
    fallbackResponse = baseResponse.clone();
  } catch {
    // Availability first: if routed lookup fails in middleware, serve the SPA
    // shell directly so users do not see the edge crash page.
    baseResponse = await fetchSpaHtmlFallback(url.origin);
    if (baseResponse) {
      fallbackResponse = baseResponse.clone();
      usedSpaFallback = true;
    }
  }

  if (!baseResponse) {
    return new Response("Edge upstream timeout", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const contentType = baseResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return baseResponse;

  try {
    const metadata = buildSiteOgMetadata(url);
    const { ogImageUrl, source } = await resolveOgImageUrl(url.origin, metadata);
    const html = await baseResponse.text();
    const rewrittenHtml = injectMetaTags(html, {
      ...metadata,
      ogImageUrl,
    });

    const headers = new Headers(baseResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set(
      "cache-control",
      shouldUseStrictToolHtmlCache(url.pathname) ? TOOL_APP_CACHE_CONTROL : SITE_CACHE_CONTROL,
    );
    headers.set("x-travelflow-og-source", source);
    if (usedSpaFallback) {
      headers.set("x-travelflow-edge-fallback", "spa-index");
    }
    headers.delete("content-length");
    headers.delete("etag");

    return new Response(rewrittenHtml, {
      status: baseResponse.status,
      statusText: baseResponse.statusText,
      headers,
    });
  } catch {
    return fallbackResponse ?? baseResponse;
  }
};
