import {
  buildAdminForensicsReplayBundle,
  type AdminForensicsEventInput,
  type AdminForensicsReplayBundle,
} from "../../services/adminForensicsService.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const AUTH_HEADER = "authorization";
const MAX_FILTER_VALUES = 200;
const MAX_SEARCH_LENGTH = 160;
const DEFAULT_SOURCE_LIMIT = 500;
const MAX_SOURCE_LIMIT = 2000;

type AdminDateRange = "7d" | "30d" | "90d" | "all";
type AuditActorFilter = "admin" | "user";

interface AdminAuditReplayExportRequestBody {
  search?: string | null;
  dateRange?: AdminDateRange | null;
  actionFilters?: string[] | null;
  targetFilters?: string[] | null;
  actorFilters?: AuditActorFilter[] | null;
  sourceLimit?: number | null;
}

interface AdminAuditRecordRow {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AdminUserChangeRecordRow {
  id: string;
  owner_user_id: string;
  owner_email: string | null;
  action: string;
  source: string | null;
  target_type: string;
  target_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface TimelineEntry {
  source: AuditActorFilter;
  id: string;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown> | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

interface NormalizedExportRequest {
  searchToken: string;
  dateRange: AdminDateRange;
  actionFilters: string[];
  targetFilters: string[];
  actorFilters: AuditActorFilter[];
  sourceLimit: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || "";
  } catch {
    return "";
  }
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const safeJsonParse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Unknown runtime error.";
};

const extractServiceError = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object") {
    const typed = payload as Record<string, unknown>;
    if (typeof typed.message === "string" && typed.message.trim()) return typed.message.trim();
    if (typeof typed.error_description === "string" && typed.error_description.trim()) return typed.error_description.trim();
    if (typeof typed.error === "string" && typed.error.trim()) return typed.error.trim();
  }
  return fallback;
};

const extractBooleanRpcResult = (payload: unknown): boolean | null => {
  if (typeof payload === "boolean") return payload;
  if (Array.isArray(payload) && payload.length > 0) {
    if (typeof payload[0] === "boolean") return payload[0];
    if (payload[0] && typeof payload[0] === "object") {
      const firstValue = Object.values(payload[0] as Record<string, unknown>)[0];
      return typeof firstValue === "boolean" ? firstValue : null;
    }
  }
  if (payload && typeof payload === "object") {
    const firstValue = Object.values(payload as Record<string, unknown>)[0];
    return typeof firstValue === "boolean" ? firstValue : null;
  }
  return null;
};

const extractStringRpcResult = (payload: unknown): string | null => {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (Array.isArray(payload) && payload.length > 0) {
    const first = payload[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object") {
      const firstValue = Object.values(first as Record<string, unknown>)[0];
      if (typeof firstValue === "string" && firstValue.trim()) return firstValue.trim();
    }
  }
  if (payload && typeof payload === "object") {
    const firstValue = Object.values(payload as Record<string, unknown>)[0];
    if (typeof firstValue === "string" && firstValue.trim()) return firstValue.trim();
  }
  return null;
};

const getAuthToken = (request: Request): string | null => {
  const raw = request.headers.get(AUTH_HEADER) || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = () => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

const buildAnonHeaders = (authToken: string, anonKey: string) => ({
  "Content-Type": "application/json",
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
});

const supabaseFetch = async (
  config: { url: string; anonKey: string },
  authToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildAnonHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const hasAdminPermission = async (
  config: { url: string; anonKey: string },
  authToken: string,
  permission: string,
): Promise<{ allowed: boolean; uncertain: boolean; errorMessage?: string }> => {
  const response = await supabaseFetch(config, authToken, "/rest/v1/rpc/has_admin_permission", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_permission: permission,
    }),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return {
      allowed: false,
      uncertain: true,
      errorMessage: extractServiceError(payload, `Permission check failed (${response.status}).`),
    };
  }

  const payload = await safeJsonParse(response);
  const result = extractBooleanRpcResult(payload);
  return {
    allowed: result !== false,
    uncertain: result === null,
  };
};

const authorizeAdminRequest = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<{ ok: true; actorUserId: string } | { ok: false; response: Response }> => {
  const accessResponse = await supabaseFetch(config, authToken, "/rest/v1/rpc/get_current_user_access", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: "{}",
  });

  if (!accessResponse.ok) {
    const payload = await safeJsonParse(accessResponse);
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: extractServiceError(payload, "Admin role verification failed."),
      }),
    };
  }

  const accessPayload = await safeJsonParse(accessResponse);
  const accessRow = Array.isArray(accessPayload) ? accessPayload[0] : accessPayload;
  if (!accessRow || typeof accessRow !== "object" || (accessRow as Record<string, unknown>).system_role !== "admin") {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: "Admin role required.",
      }),
    };
  }

  const actorUserId = String((accessRow as Record<string, unknown>).user_id || "").trim();
  if (!actorUserId) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: "Admin actor id is missing.",
      }),
    };
  }

  const readPermission = await hasAdminPermission(config, authToken, "audit.read");
  if (!readPermission.allowed) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: readPermission.errorMessage || "Missing audit read permission.",
      }),
    };
  }

  const writePermission = await hasAdminPermission(config, authToken, "audit.write");
  if (!writePermission.allowed) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: writePermission.errorMessage || "Missing audit write permission.",
      }),
    };
  }

  return {
    ok: true,
    actorUserId,
  };
};

const parseBody = async (request: Request): Promise<AdminAuditReplayExportRequestBody | null> => {
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object") return null;
    return payload as AdminAuditReplayExportRequestBody;
  } catch {
    return null;
  }
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, MAX_FILTER_VALUES)
    .forEach((entry) => unique.add(entry));
  return Array.from(unique);
};

const normalizeActorFilters = (value: unknown): AuditActorFilter[] => {
  const values = normalizeStringArray(value);
  const actorFilters: AuditActorFilter[] = [];
  values.forEach((entry) => {
    if (entry === "admin" || entry === "user") {
      actorFilters.push(entry);
    }
  });
  return actorFilters;
};

const clampSourceLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SOURCE_LIMIT;
  const rounded = Math.floor(parsed);
  if (rounded <= 0) return DEFAULT_SOURCE_LIMIT;
  return Math.min(rounded, MAX_SOURCE_LIMIT);
};

const normalizeDateRange = (value: unknown): AdminDateRange => {
  if (value === "7d" || value === "30d" || value === "90d" || value === "all") return value;
  return "30d";
};

const normalizeExportRequest = (body: AdminAuditReplayExportRequestBody | null): NormalizedExportRequest => {
  const search = typeof body?.search === "string" ? body.search.trim().toLowerCase().slice(0, MAX_SEARCH_LENGTH) : "";
  return {
    searchToken: search,
    dateRange: normalizeDateRange(body?.dateRange),
    actionFilters: normalizeStringArray(body?.actionFilters),
    targetFilters: normalizeStringArray(body?.targetFilters),
    actorFilters: normalizeActorFilters(body?.actorFilters),
    sourceLimit: clampSourceLimit(body?.sourceLimit),
  };
};

const getDateRangeStart = (dateRange: AdminDateRange): number | null => {
  if (dateRange === "all") return null;
  const now = Date.now();
  if (dateRange === "7d") return now - (7 * DAY_MS);
  if (dateRange === "30d") return now - (30 * DAY_MS);
  return now - (90 * DAY_MS);
};

const isDateInRange = (isoDate: string | null | undefined, dateRange: AdminDateRange): boolean => {
  const rangeStart = getDateRangeStart(dateRange);
  if (rangeStart === null) return true;
  if (!isoDate) return false;
  const timestamp = Date.parse(isoDate);
  if (!Number.isFinite(timestamp)) return false;
  return timestamp >= rangeStart;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const mapAdminRows = (rows: AdminAuditRecordRow[]): TimelineEntry[] => rows.map((row) => ({
  source: "admin",
  id: row.id,
  created_at: row.created_at,
  action: row.action,
  target_type: row.target_type,
  target_id: row.target_id,
  actor_user_id: row.actor_user_id,
  actor_email: row.actor_email,
  metadata: asRecord(row.metadata),
  before_data: asRecord(row.before_data),
  after_data: asRecord(row.after_data),
}));

const mapUserRows = (rows: AdminUserChangeRecordRow[]): TimelineEntry[] => rows.map((row) => ({
  source: "user",
  id: row.id,
  created_at: row.created_at,
  action: row.action,
  target_type: row.target_type,
  target_id: row.target_id,
  actor_user_id: row.owner_user_id,
  actor_email: row.owner_email,
  metadata: asRecord(row.metadata),
  before_data: asRecord(row.before_data),
  after_data: asRecord(row.after_data),
}));

export const filterTimelineEntriesForExport = (
  entries: TimelineEntry[],
  filters: NormalizedExportRequest,
): TimelineEntry[] => {
  return entries
    .filter((entry) => {
      if (!isDateInRange(entry.created_at, filters.dateRange)) return false;
      if (filters.actionFilters.length > 0 && !filters.actionFilters.includes(entry.action)) return false;
      if (filters.targetFilters.length > 0 && !filters.targetFilters.includes(entry.target_type)) return false;
      if (filters.actorFilters.length > 0 && !filters.actorFilters.includes(entry.source)) return false;

      if (!filters.searchToken) return true;
      const haystack = [
        entry.action,
        entry.target_type,
        entry.target_id || "",
        entry.actor_email || "",
        entry.actor_user_id || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(filters.searchToken);
    })
    .sort((left, right) => {
      const leftTs = Date.parse(left.created_at) || 0;
      const rightTs = Date.parse(right.created_at) || 0;
      return rightTs - leftTs;
    });
};

const toForensicsEvent = (entry: TimelineEntry): AdminForensicsEventInput => ({
  source: entry.source,
  id: entry.id,
  created_at: entry.created_at,
  action: entry.action,
  target_type: entry.target_type,
  target_id: entry.target_id,
  actor_user_id: entry.actor_user_id,
  actor_email: entry.actor_email,
  metadata: entry.metadata,
  before_data: entry.before_data,
  after_data: entry.after_data,
});

const loadAdminAuditRows = async (
  config: { url: string; anonKey: string },
  authToken: string,
  sourceLimit: number,
): Promise<{ ok: true; rows: AdminAuditRecordRow[] } | { ok: false; response: Response }> => {
  const response = await supabaseFetch(config, authToken, "/rest/v1/rpc/admin_list_audit_logs", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_limit: sourceLimit,
      p_offset: 0,
      p_action: null,
      p_target_type: null,
      p_actor_user_id: null,
    }),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return {
      ok: false,
      response: json(500, {
        ok: false,
        error: extractServiceError(payload, "Could not load admin audit rows."),
      }),
    };
  }

  const payload = await safeJsonParse(response);
  return {
    ok: true,
    rows: Array.isArray(payload) ? payload as AdminAuditRecordRow[] : [],
  };
};

const loadUserAuditRows = async (
  config: { url: string; anonKey: string },
  authToken: string,
  sourceLimit: number,
): Promise<{ ok: true; rows: AdminUserChangeRecordRow[] } | { ok: false; response: Response }> => {
  const response = await supabaseFetch(config, authToken, "/rest/v1/rpc/admin_list_user_change_logs", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_limit: sourceLimit,
      p_offset: 0,
      p_action: null,
      p_owner_user_id: null,
    }),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return {
      ok: false,
      response: json(500, {
        ok: false,
        error: extractServiceError(payload, "Could not load user change rows."),
      }),
    };
  }

  const payload = await safeJsonParse(response);
  return {
    ok: true,
    rows: Array.isArray(payload) ? payload as AdminUserChangeRecordRow[] : [],
  };
};

const persistExportAuditEntry = async (
  config: { url: string; anonKey: string },
  authToken: string,
  payload: {
    actorUserId: string;
    filters: NormalizedExportRequest;
    adminSourceCount: number;
    userSourceCount: number;
    bundle: AdminForensicsReplayBundle;
  },
): Promise<{ ok: true; auditId: string | null } | { ok: false; response: Response }> => {
  const response = await supabaseFetch(config, authToken, "/rest/v1/rpc/admin_write_audit", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_action: "admin.audit.export",
      p_target_type: "audit",
      p_target_id: null,
      p_before_data: {},
      p_after_data: {
        event_count: payload.bundle.totals.event_count,
        correlation_count: payload.bundle.totals.correlation_count,
      },
      p_metadata: {
        via: "admin-audit-export-edge",
        actor_user_id: payload.actorUserId,
        source_limit: payload.filters.sourceLimit,
        search: payload.filters.searchToken || null,
        date_range: payload.filters.dateRange,
        action_filters: payload.filters.actionFilters,
        target_filters: payload.filters.targetFilters,
        actor_filters: payload.filters.actorFilters,
        source_counts: {
          admin: payload.adminSourceCount,
          user: payload.userSourceCount,
        },
        exported_event_count: payload.bundle.totals.event_count,
        exported_correlation_count: payload.bundle.totals.correlation_count,
        replay_schema: payload.bundle.schema,
      },
    }),
  });

  if (!response.ok) {
    const responsePayload = await safeJsonParse(response);
    return {
      ok: false,
      response: json(500, {
        ok: false,
        error: extractServiceError(responsePayload, "Could not persist export audit entry."),
      }),
    };
  }

  const responsePayload = await safeJsonParse(response);
  return {
    ok: true,
    auditId: extractStringRpcResult(responsePayload),
  };
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return json(500, {
      ok: false,
      error: "Supabase config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, { ok: false, error: "Missing bearer token." });
  }

  const authResult = await authorizeAdminRequest(config, authToken);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const normalizedRequest = normalizeExportRequest(await parseBody(request));

    const [adminRowsResult, userRowsResult] = await Promise.all([
      loadAdminAuditRows(config, authToken, normalizedRequest.sourceLimit),
      loadUserAuditRows(config, authToken, normalizedRequest.sourceLimit),
    ]);

    if (!adminRowsResult.ok) return adminRowsResult.response;
    if (!userRowsResult.ok) return userRowsResult.response;

    const timelineEntries: TimelineEntry[] = [
      ...mapAdminRows(adminRowsResult.rows),
      ...mapUserRows(userRowsResult.rows),
    ];

    const filteredEntries = filterTimelineEntriesForExport(timelineEntries, normalizedRequest);
    const generatedAtIso = new Date().toISOString();
    const bundle = buildAdminForensicsReplayBundle(
      filteredEntries.map(toForensicsEvent),
      {
        generatedAtIso,
        filters: {
          search: normalizedRequest.searchToken || null,
          date_range: normalizedRequest.dateRange,
          action_filters: normalizedRequest.actionFilters,
          target_filters: normalizedRequest.targetFilters,
          actor_filters: normalizedRequest.actorFilters,
          source_limit: normalizedRequest.sourceLimit,
        },
      },
    );

    const persistedResult = await persistExportAuditEntry(config, authToken, {
      actorUserId: authResult.actorUserId,
      filters: normalizedRequest,
      adminSourceCount: adminRowsResult.rows.length,
      userSourceCount: userRowsResult.rows.length,
      bundle,
    });

    if (!persistedResult.ok) return persistedResult.response;

    return json(200, {
      ok: true,
      data: {
        exportAuditId: persistedResult.auditId,
        bundle,
      },
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: `Admin audit replay export runtime failure: ${toErrorMessage(error)}`,
    });
  }
};
