import {
  ensureModelAllowed,
  GEMINI_DEFAULT_MODEL,
  readEnv,
} from "./ai-provider-runtime.ts";

/**
 * Request guards for the public /api/ai/generate edge endpoint.
 *
 * Every accepted request triggers a paid provider call, so requests are
 * validated (prompt length cap, provider/model allowlist) and rate limited
 * before any provider work happens.
 */

export interface GenerateGuardFailure {
  status: number;
  code: string;
  error: string;
}

export interface GenerateGuardInput {
  prompt: string;
  provider: string;
  model: string;
}

export type GenerateGuardResult =
  | { ok: true; value: GenerateGuardInput }
  | { ok: false; failure: GenerateGuardFailure };

// Real classic/wizard prompts built by services/aiService.ts top out around
// ~8k characters even for long multi-week requests. 24k leaves 3x headroom
// while still blocking megabyte-sized quota-burn payloads.
export const DEFAULT_MAX_PROMPT_CHARS = 24_000;

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Math.round(value)));

export const resolveMaxPromptChars = (): number => {
  const raw = Number(readEnv("AI_GENERATE_MAX_PROMPT_CHARS").trim());
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_PROMPT_CHARS;
  return clampInt(raw, 4_000, 120_000);
};

export const validateGenerateInput = (
  body: {
    prompt?: unknown;
    target?: { provider?: unknown; model?: unknown } | null;
  } | null | undefined,
  maxPromptChars = resolveMaxPromptChars(),
): GenerateGuardResult => {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: "PROMPT_REQUIRED",
        error: "Missing required field: prompt",
      },
    };
  }

  if (prompt.length > maxPromptChars) {
    return {
      ok: false,
      failure: {
        status: 413,
        code: "PROMPT_TOO_LONG",
        error: `Prompt exceeds the maximum allowed length of ${maxPromptChars} characters.`,
      },
    };
  }

  const provider = typeof body?.target?.provider === "string" && body.target.provider.trim()
    ? body.target.provider.trim().toLowerCase()
    : "gemini";
  const model = typeof body?.target?.model === "string" && body.target.model.trim()
    ? body.target.model.trim()
    : GEMINI_DEFAULT_MODEL;

  const allowlistError = ensureModelAllowed(provider, model);
  if (allowlistError) {
    return {
      ok: false,
      failure: {
        status: 400,
        code: allowlistError.code,
        error: allowlistError.error,
      },
    };
  }

  return { ok: true, value: { prompt, provider, model } };
};

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface TokenBucketRateLimiter {
  take: (key: string, nowMs?: number) => RateLimitDecision;
}

interface BucketState {
  tokens: number;
  updatedAtMs: number;
}

/**
 * Best-effort in-memory token bucket, keyed per caller (user id or IP).
 *
 * NOTE: state lives inside a single edge isolate. Netlify runs many isolates
 * across regions and recycles them, so this is NOT a durable global limit —
 * it caps the request rate an attacker can push through any one isolate and
 * stops naive scripted abuse. A durable (table-backed) limiter can be layered
 * on later without changing callers.
 */
export const createTokenBucketRateLimiter = (options: {
  capacity: number;
  refillPerMinute: number;
  maxKeys?: number;
}): TokenBucketRateLimiter => {
  const capacity = Math.max(1, options.capacity);
  const refillPerMs = Math.max(0.000001, options.refillPerMinute / 60_000);
  const maxKeys = Math.max(100, options.maxKeys ?? 10_000);
  const buckets = new Map<string, BucketState>();

  const take = (key: string, nowMs = Date.now()): RateLimitDecision => {
    const existing = buckets.get(key);
    let tokens = capacity;
    if (existing) {
      const elapsedMs = Math.max(0, nowMs - existing.updatedAtMs);
      tokens = Math.min(capacity, existing.tokens + elapsedMs * refillPerMs);
      // Move to the end of the Map so eviction removes the stalest key first.
      buckets.delete(key);
    }

    if (tokens < 1) {
      const missingTokens = 1 - tokens;
      buckets.set(key, { tokens, updatedAtMs: nowMs });
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(missingTokens / refillPerMs / 1_000)),
      };
    }

    buckets.set(key, { tokens: tokens - 1, updatedAtMs: nowMs });

    if (buckets.size > maxKeys) {
      const oldestKey = buckets.keys().next().value;
      if (typeof oldestKey === "string") {
        buckets.delete(oldestKey);
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  };

  return { take };
};

export const resolveClientIp = (
  request: Request,
  context?: { ip?: string } | null,
): string => {
  const contextIp = typeof context?.ip === "string" ? context.ip.trim() : "";
  if (contextIp) return contextIp;

  const netlifyHeader = (request.headers.get("x-nf-client-connection-ip") || "").trim();
  if (netlifyHeader) return netlifyHeader;

  const forwardedFor = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "";
  if (forwardedFor) return forwardedFor;

  return "unknown";
};

export const getBearerToken = (request: Request): string | null => {
  const raw = request.headers.get("authorization") || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

export type SupabaseUserVerification =
  | { ok: true; userId: string; isAnonymous: boolean }
  | { ok: false; reason: "invalid" | "unavailable" };

/**
 * Verifies a Supabase access token server-side via the auth REST endpoint.
 * Returns `unavailable` when Supabase env config is missing or the auth
 * service cannot be reached, so callers can degrade to per-IP limiting
 * instead of hard-failing legitimate traffic.
 */
export const verifySupabaseUser = async (
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SupabaseUserVerification> => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return { ok: false, reason: "unavailable" };
  }

  let response: Response;
  try {
    response = await fetchImpl(`${url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!response.ok) {
    return { ok: false, reason: "invalid" };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const userId = typeof record?.id === "string" ? record.id.trim() : "";
  if (!userId) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    userId,
    isAnonymous: record?.is_anonymous === true,
  };
};
