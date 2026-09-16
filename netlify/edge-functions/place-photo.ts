/**
 * Redirects to a Google Places photo.
 *
 * The photo is never copied onto our own storage — the Places terms forbid
 * rehosting — so this resolves the caller's photo reference against Google and
 * redirects. Going through an edge function rather than linking Google directly
 * keeps the API key out of the client bundle.
 *
 * Query params:
 *   ref — Places photo resource name, "places/<placeId>/photos/<photoId>"
 *   w   — max width in pixels (default 800, clamped 160-1600)
 */

import { getMapsApiKeyFromEnv } from "../edge-lib/trip-og-data.ts";

/** `places/<placeId>/photos/<photoId>` and nothing else. */
const PHOTO_REFERENCE_PATTERN = /^places\/[A-Za-z0-9_-]{1,256}\/photos\/[A-Za-z0-9_-]{1,512}$/;

const CACHE_HEADERS: Record<string, string> = {
  // Places photo URLs are stable for a place; a day at the edge is well inside
  // what the terms allow for caching a reference rather than the bytes.
  "Cache-Control": "public, max-age=86400",
  "Netlify-CDN-Cache-Control": "public, durable, s-maxage=86400",
};

const badRequest = (message: string): Response =>
  new Response(message, { status: 400, headers: { "Cache-Control": "no-store" } });

export default async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const reference = url.searchParams.get("ref");

  if (!reference) return badRequest("Missing 'ref' query parameter");
  if (!PHOTO_REFERENCE_PATTERN.test(reference)) {
    // Without this the parameter is an open redirect into any Google path.
    return badRequest("Malformed photo reference");
  }

  const requestedWidth = Number.parseInt(url.searchParams.get("w") || "800", 10);
  const width = Number.isFinite(requestedWidth)
    ? Math.max(160, Math.min(1600, requestedWidth))
    : 800;

  const apiKey = getMapsApiKeyFromEnv();
  if (!apiKey) return new Response("Maps API key not configured", { status: 500 });

  const target = new URL(`https://places.googleapis.com/v1/${reference}/media`);
  target.searchParams.set("maxWidthPx", String(width));
  target.searchParams.set("key", apiKey);
  target.searchParams.set("skipHttpRedirect", "true");

  try {
    const response = await fetch(target.toString());
    if (!response.ok) {
      return new Response("Photo unavailable", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const body = await response.json() as { photoUri?: string };
    if (!body.photoUri) {
      return new Response("Photo unavailable", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: body.photoUri, ...CACHE_HEADERS },
    });
  } catch {
    return new Response("Photo lookup failed", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
};
