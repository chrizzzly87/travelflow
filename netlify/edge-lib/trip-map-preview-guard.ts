/**
 * Abuse guards for the public `/api/trip-map-preview` edge function.
 *
 * The endpoint is unauthenticated by design (preview images are loaded from
 * plain `<img>` tags), but every request can fan out to paid Google
 * Directions / Static Maps / Mapbox Static API calls. These helpers provide:
 *
 * 1. Strict coordinate validation (count cap aligned with the client's
 *    30-stop limit in `components/profile/tripPreviewUtils.ts`).
 * 2. A deterministic cache key over the allowlisted preview params so the
 *    CDN can collapse repeated identical requests.
 * 3. A small in-memory token-bucket rate limiter (per isolate) keyed by
 *    client IP.
 */

export type PreviewLatLng = { lat: number; lng: number };

export type PreviewCoordsParseResult =
  | { ok: true; coords: PreviewLatLng[] }
  | { ok: false; error: string };

/** Matches the client-side cap in `buildMiniMapUrl` (`slice(0, 30)`). */
export const MAX_PREVIEW_COORDS = 30;

/** 30 pairs of "-90.123456,-180.123456|" ≈ 660 chars; generous headroom. */
export const MAX_PREVIEW_COORDS_PARAM_LENGTH = 1024;

const COORD_PAIR_PATTERN = /^-?\d{1,3}(?:\.\d{1,10})?,-?\d{1,3}(?:\.\d{1,10})?$/;

export const parsePreviewCoords = (value: string): PreviewCoordsParseResult => {
  if (value.length > MAX_PREVIEW_COORDS_PARAM_LENGTH) {
    return { ok: false, error: `'coords' exceeds ${MAX_PREVIEW_COORDS_PARAM_LENGTH} characters` };
  }

  const pairs = value.split("|");
  if (pairs.length > MAX_PREVIEW_COORDS) {
    return { ok: false, error: `'coords' supports at most ${MAX_PREVIEW_COORDS} coordinates` };
  }

  const coords: PreviewLatLng[] = [];
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!COORD_PAIR_PATTERN.test(trimmed)) {
      return { ok: false, error: "'coords' must be pipe-separated lat,lng pairs" };
    }
    const [lat, lng] = trimmed.split(",").map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, error: "'coords' contains an out-of-range latitude/longitude" };
    }
    coords.push({ lat, lng });
  }

  if (coords.length < 1) {
    return { ok: false, error: "At least one valid coordinate is required" };
  }

  return { ok: true, coords };
};

/**
 * Query params that affect the generated preview image. Everything else is
 * noise and must not fragment (or bust) the CDN cache.
 */
export const PREVIEW_CACHE_QUERY_PARAMS = [
  "coords",
  "style",
  "routeMode",
  "colorMode",
  "pathColor",
  "legColors",
  "startMarkerColor",
  "endMarkerColor",
  "waypointColor",
  "language",
  "w",
  "h",
  "scale",
  "mr",
] as const;

/** Value for the `Netlify-Vary` response header: cache key = allowlisted query params only. */
export const buildPreviewNetlifyVaryValue = (): string =>
  `query=${PREVIEW_CACHE_QUERY_PARAMS.join("|")}`;

/**
 * Deterministic cache key from normalized params: allowlisted params only,
 * sorted by name, empty values dropped. Two semantically identical requests
 * (regardless of param order or junk params) produce the same key.
 */
export const buildPreviewCacheKey = (searchParams: URLSearchParams): string => {
  const normalized = new URLSearchParams();
  for (const name of [...PREVIEW_CACHE_QUERY_PARAMS].sort()) {
    const value = searchParams.get(name);
    if (value !== null && value !== "") {
      normalized.set(name, value.trim());
    }
  }
  return normalized.toString();
};

export type TokenBucketLimiterOptions = {
  /** Maximum burst size (bucket capacity). */
  capacity: number;
  /** Tokens restored per second. */
  refillPerSecond: number;
  /** Bound on tracked keys before stale entries are pruned. */
  maxKeys?: number;
};

export type TokenBucketDecision = {
  allowed: boolean;
  /** Seconds until the request would be allowed again (0 when allowed). */
  retryAfterSeconds: number;
};

export type TokenBucketLimiter = {
  consume: (key: string, cost?: number, nowMs?: number) => TokenBucketDecision;
};

type BucketState = { tokens: number; updatedAtMs: number };

export const createTokenBucketLimiter = (
  options: TokenBucketLimiterOptions,
): TokenBucketLimiter => {
  const { capacity, refillPerSecond, maxKeys = 5000 } = options;
  const buckets = new Map<string, BucketState>();

  const prune = (nowMs: number): void => {
    if (buckets.size <= maxKeys) return;
    const staleBeforeMs = nowMs - (capacity / refillPerSecond) * 1000;
    for (const [key, state] of buckets) {
      if (state.updatedAtMs <= staleBeforeMs) buckets.delete(key);
    }
    // Hard fallback: drop oldest entries if pruning stale ones was not enough.
    if (buckets.size > maxKeys) {
      const overflow = buckets.size - maxKeys;
      let dropped = 0;
      for (const key of buckets.keys()) {
        if (dropped >= overflow) break;
        buckets.delete(key);
        dropped += 1;
      }
    }
  };

  return {
    consume: (key: string, cost = 1, nowMs = Date.now()): TokenBucketDecision => {
      prune(nowMs);
      const state = buckets.get(key) ?? { tokens: capacity, updatedAtMs: nowMs };
      const elapsedSeconds = Math.max(0, (nowMs - state.updatedAtMs) / 1000);
      const tokens = Math.min(capacity, state.tokens + elapsedSeconds * refillPerSecond);

      if (tokens >= cost) {
        buckets.set(key, { tokens: tokens - cost, updatedAtMs: nowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      buckets.set(key, { tokens, updatedAtMs: nowMs });
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((cost - tokens) / refillPerSecond)),
      };
    },
  };
};

/** Resolves the client IP for rate limiting, preferring Netlify's trusted header. */
export const resolvePreviewClientIp = (
  request: Request,
  context?: { ip?: string },
): string => {
  if (context?.ip) return context.ip;
  const netlifyIp = request.headers.get("x-nf-client-connection-ip");
  if (netlifyIp) return netlifyIp.trim();
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
};
