/**
 * Store and read external trip drafts (docs/EXTERNAL_TRIP_DRAFTS.md).
 *
 * Shared by the HTTP API (`trip-drafts`) and the MCP server (`mcp`) so both
 * validate, build and rate-limit identically. Nothing here calls a model.
 */
import { buildTripFromModelData } from "../edge-functions/ai-generate-worker.ts";
import {
  buildTripDraftUrl,
  generateTripDraftId,
  isTripDraftId,
  TRIP_DRAFT_SOURCES,
  validateTripDraftBody,
  type PreparedTripDraft,
  type TripDraftSource,
} from "../../shared/tripDrafts.ts";

export type TripDraftErrorCode =
  | "invalid_json"
  | "payload_too_large"
  | "validation_failed"
  | "rate_limited"
  | "draft_not_found"
  | "drafts_unavailable";

export interface TripDraftFailure {
  ok: false;
  status: number;
  code: TripDraftErrorCode;
  message: string;
  errors?: string[];
}

export interface TripDraftCreated {
  ok: true;
  draftId: string;
  url: string;
  expiresAt: string | null;
  title: string;
  startDate: string;
  cityCount: number;
  activityCount: number;
}

export interface TripDraftValidated {
  ok: true;
  title: string;
  startDate: string;
  roundTrip: boolean;
  cityCount: number;
  activityCount: number;
  countryCodes: string[];
}

export interface TripDraftRecord {
  ok: true;
  draftId: string;
  url: string;
  title: string;
  startDate: string | null;
  roundTrip: boolean;
  status: "draft" | "claimed" | "expired";
  source: string;
  clientName: string | null;
  clientModel: string | null;
  viewCount: number;
  claimCount: number;
  expiresAt: string | null;
  createdAt: string;
  trip: Record<string, unknown>;
}

export interface TripDraftRequestContext {
  origin: string;
  source: TripDraftSource;
  ip: string | null;
  userAgent: string | null;
}

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) ||
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] || "";
  } catch {
    return "";
  }
};

const unavailable = (): TripDraftFailure => ({
  ok: false,
  status: 503,
  code: "drafts_unavailable",
  message: "Trip drafts are not available right now. Try again later.",
});

export const resolveTripDraftSource = (value: string | null | undefined, fallback: TripDraftSource): TripDraftSource => (
  TRIP_DRAFT_SOURCES.includes(value as TripDraftSource) ? value as TripDraftSource : fallback
);

/** Reads and size-checks a JSON body without trusting Content-Length. */
export const readTripDraftJsonBody = async (request: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | TripDraftFailure> => {
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > maxBytes) {
    return { ok: false, status: 413, code: "payload_too_large", message: `The request body is larger than ${Math.round(maxBytes / 1024)} KB.` };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, status: 413, code: "payload_too_large", message: `The request body is larger than ${Math.round(maxBytes / 1024)} KB.` };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, code: "invalid_json", message: "The request body is not valid JSON." };
  }
};

const validationFailure = (errors: string[]): TripDraftFailure => ({
  ok: false,
  status: 422,
  code: "validation_failed",
  message: "The trip does not match the TravelFlow schema. Fix the listed errors and send it again.",
  errors: errors.slice(0, 50),
});

const summarize = (draft: PreparedTripDraft) => ({
  title: String(draft.prepared.data.tripTitle || "Untitled trip"),
  startDate: draft.request.startDate,
  roundTrip: draft.request.roundTrip,
  cityCount: draft.cityCount,
  activityCount: draft.activityCount,
  countryCodes: draft.countryCodes,
});

export const validateTripDraftPayload = (body: unknown, now: Date = new Date()): TripDraftValidated | TripDraftFailure => {
  const result = validateTripDraftBody(body, now);
  if (!result.ok) return validationFailure(result.errors);
  return { ok: true, ...summarize(result.value) };
};

/** The trip the viewer renders: the generator's own builder, marked as an external draft. */
export const buildTripDraftTrip = (draftId: string, draft: PreparedTripDraft, now: Date = new Date()): Record<string, unknown> => {
  const trip = buildTripFromModelData(draft.prepared.data, {
    tripId: draftId,
    startDate: draft.request.startDate,
    roundTrip: draft.request.roundTrip,
    provider: "external",
    model: draft.request.client.model || draft.request.client.name || "unknown",
  });
  return {
    ...trip,
    sourceKind: "external_draft",
    sourceTemplateId: draftId,
    aiMeta: {
      provider: "external",
      model: draft.request.client.model || draft.request.client.name || "unknown",
      generatedAt: now.toISOString(),
    },
  };
};

const hmacHex = async (secret: string, value: string): Promise<string> => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const callRpc = async (rpcName: string, payload: Record<string, unknown>): Promise<{ ok: true; rows: Array<Record<string, unknown>> } | { ok: false; status: number }> => {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return { ok: false, status: 503 };
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const raw = await response.json();
    return { ok: true, rows: Array.isArray(raw) ? raw : raw ? [raw] : [] };
  } catch {
    return { ok: false, status: 503 };
  }
};

export const createTripDraft = async (
  body: unknown,
  context: TripDraftRequestContext,
  now: Date = new Date(),
): Promise<TripDraftCreated | TripDraftFailure> => {
  const result = validateTripDraftBody(body, now);
  if (!result.ok) return validationFailure(result.errors);
  const draft = result.value;
  const draftId = generateTripDraftId();
  const trip = buildTripDraftTrip(draftId, draft, now);
  const summary = summarize(draft);
  const secret = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  // Callers without a resolvable IP share one bucket, so they are rate-limited too.
  const ipHash = secret ? await hmacHex(secret, `trip-drafts|${context.ip || "unknown"}`) : null;

  const rpc = await callRpc("create_trip_draft", {
    p_id: draftId,
    p_title: summary.title,
    p_start_date: summary.startDate,
    p_round_trip: summary.roundTrip,
    p_data: trip,
    p_source_payload: draft.request.trip,
    p_source: context.source,
    p_client_name: draft.request.client.name,
    p_client_model: draft.request.client.model,
    p_user_agent: context.userAgent,
    p_ip_hash: ipHash,
    p_city_count: summary.cityCount,
    p_activity_count: summary.activityCount,
    p_country_codes: summary.countryCodes,
  });
  if (!rpc.ok) return unavailable();
  const row = rpc.rows[0];
  if (!row || row.ok !== true) {
    const code = typeof row?.code === "string" ? row.code : "";
    if (code.startsWith("rate_limited")) {
      return {
        ok: false,
        status: 429,
        code: "rate_limited",
        message: code === "rate_limited_ip"
          ? "Too many drafts from this network in the last hour. Try again later."
          : "TravelFlow has received too many drafts today. Try again tomorrow.",
      };
    }
    return unavailable();
  }
  return {
    ok: true,
    draftId,
    url: buildTripDraftUrl(context.origin, draftId),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    title: summary.title,
    startDate: summary.startDate,
    cityCount: summary.cityCount,
    activityCount: summary.activityCount,
  };
};

export const readTripDraft = async (
  draftId: string,
  origin: string,
  options: { trackView?: boolean } = {},
): Promise<TripDraftRecord | TripDraftFailure> => {
  const notFound: TripDraftFailure = { ok: false, status: 404, code: "draft_not_found", message: "This draft does not exist or has expired." };
  if (!isTripDraftId(draftId)) return notFound;
  const rpc = await callRpc("get_trip_draft", { p_draft_id: draftId, p_track_view: options.trackView ?? false });
  if (!rpc.ok) return unavailable();
  const row = rpc.rows[0];
  if (!row || typeof row.data !== "object" || !row.data) return notFound;
  const status = row.status === "claimed" ? "claimed" : row.status === "expired" ? "expired" : "draft";
  return {
    ok: true,
    draftId,
    url: buildTripDraftUrl(origin, draftId),
    title: String(row.title || "Untitled trip"),
    startDate: typeof row.start_date === "string" ? row.start_date : null,
    roundTrip: row.round_trip === true,
    status,
    source: String(row.source || "api"),
    clientName: typeof row.client_name === "string" ? row.client_name : null,
    clientModel: typeof row.client_model === "string" ? row.client_model : null,
    viewCount: Number(row.view_count) || 0,
    claimCount: Number(row.claim_count) || 0,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    createdAt: String(row.created_at || ""),
    trip: row.data as Record<string, unknown>,
  };
};

export const readClientIp = (request: Request, contextIp?: string | null): string | null => (
  contextIp
  || request.headers.get("x-nf-client-connection-ip")
  || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || null
);
