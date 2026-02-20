import { fetchActiveTripShareToken } from "../edge-lib/trip-og-data.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const isSafeParam = (value: string): boolean =>
  value.length > 0 && value.length <= 180;

export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const url = new URL(request.url);
  const tripId = (url.searchParams.get("trip") || "").trim();
  const versionId = (url.searchParams.get("v") || "").trim();

  if (!isSafeParam(tripId)) {
    return new Response(JSON.stringify({ error: "Missing or invalid trip id" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const shareToken = await fetchActiveTripShareToken(tripId);
  if (!shareToken) {
    return new Response(JSON.stringify({ error: "No active share token for this trip" }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  const shareUrl = new URL(`/s/${encodeURIComponent(shareToken)}`, url.origin);
  if (isSafeParam(versionId)) {
    shareUrl.searchParams.set("v", versionId);
  }

  return new Response(JSON.stringify({
    token: shareToken,
    path: shareUrl.pathname + shareUrl.search,
    url: shareUrl.toString(),
  }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};
