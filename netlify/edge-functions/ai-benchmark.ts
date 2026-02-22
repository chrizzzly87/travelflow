import { parseFlexibleDurationDays, parseFlexibleDurationHours } from "../../shared/durationParsing.ts";
import { MODEL_TRANSPORT_MODE_VALUES, normalizeTransportMode, parseTransportMode } from "../../shared/transportModes.ts";
import {
  buildAiTelemetrySeries,
  summarizeAiTelemetry,
  summarizeAiTelemetryByProvider,
  type AiTelemetryRow,
} from "../edge-lib/ai-telemetry-aggregation.ts";
import { persistAiGenerationTelemetry } from "../edge-lib/ai-generation-telemetry.ts";
import { generateProviderItinerary, resolveTimeoutMs } from "../edge-lib/ai-provider-runtime.ts";
import {
  BENCHMARK_DEFAULT_MODEL_IDS,
  createSystemBenchmarkPresets,
  normalizeBenchmarkPreferencesPayload,
  type BenchmarkPreferencesPayload,
} from "../../services/aiBenchmarkPreferencesService.ts";
import { AI_MODEL_CATALOG } from "../../config/aiModelCatalog.ts";

interface BenchmarkTarget {
  provider: string;
  model: string;
  label?: string;
}

interface BenchmarkScenario {
  prompt: string;
  startDate?: string;
  roundTrip?: boolean;
  input?: Record<string, unknown>;
}

interface BenchmarkRequestBody {
  sessionId?: string;
  sessionName?: string;
  flow?: "classic" | "wizard" | "surprise";
  scenario?: BenchmarkScenario;
  targets?: BenchmarkTarget[];
  runCount?: number;
  concurrency?: number;
}

interface EdgeContextLike {
  waitUntil?: (promise: Promise<unknown>) => void;
}

interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

interface BenchmarkSessionRow {
  id: string;
  owner_id: string;
  share_token: string;
  name: string | null;
  flow: string;
  scenario: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BenchmarkRunRow {
  id: string;
  session_id: string;
  provider: string;
  model: string;
  label: string | null;
  run_index: number;
  status: "queued" | "running" | "completed" | "failed";
  latency_ms: number | null;
  schema_valid: boolean | null;
  validation_checks: Record<string, unknown> | null;
  validation_errors: string[] | null;
  usage: Record<string, unknown> | null;
  cost_usd: number | null;
  request_payload: Record<string, unknown> | null;
  raw_output: Record<string, unknown> | null;
  normalized_trip: Record<string, unknown> | null;
  trip_id: string | null;
  trip_ai_meta: Record<string, unknown> | null;
  error_message: string | null;
  satisfaction_rating: "good" | "medium" | "bad" | null;
  satisfaction_updated_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface BenchmarkPreferencesRow {
  owner_id: string;
  model_targets: unknown;
  presets: unknown;
  selected_preset_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ValidationResult {
  schemaValid: boolean;
  checks: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const ZIP_HEADERS = {
  "Cache-Control": "no-store",
};

const ADMIN_HEADER = "x-tf-admin-key";
const AUTH_HEADER = "authorization";
const MAX_RUN_COUNT = 3;
const MAX_CONCURRENCY = 5;
const CANCELLED_BY_USER_MESSAGE = "Cancelled by user.";
const BENCHMARK_PROVIDER_TIMEOUT_MS = Math.max(
  90_000,
  resolveTimeoutMs("AI_BENCHMARK_PROVIDER_TIMEOUT_MS", 90_000, 10_000, 180_000),
);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SATISFACTION_RATINGS = new Set(["good", "medium", "bad"]);
const ALLOWED_MODEL_TRANSPORT_MODE_SET = new Set<string>(MODEL_TRANSPORT_MODE_VALUES);
const TELEMETRY_SOURCE_VALUES = new Set(["all", "create_trip", "benchmark"]);
const TELEMETRY_WINDOW_MIN_HOURS = 1;
const TELEMETRY_WINDOW_MAX_HOURS = 24 * 90;
const TELEMETRY_WINDOW_DEFAULT_HOURS = 24 * 7;
const BENCHMARK_PREFERENCES_DEFAULT_DURATION_DAYS = 14;

const CITY_COLORS = [
  "#f43f5e",
  "#f97316",
  "#d97706",
  "#059669",
  "#0d9488",
  "#0891b2",
  "#0284c7",
  "#4f46e5",
  "#7c3aed",
  "#c026d3",
  "#475569",
  "#65a30d",
];

const ACTIVITY_TYPES = [
  "general",
  "sightseeing",
  "food",
  "culture",
  "relaxation",
  "nightlife",
  "sports",
  "hiking",
  "wildlife",
  "nature",
  "shopping",
  "adventure",
  "beach",
] as const;

const ACTIVITY_TYPE_COLOR: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  general: "bg-slate-100 border-slate-300 text-slate-800",
  sightseeing: "bg-sky-100 border-sky-300 text-sky-800",
  food: "bg-amber-100 border-amber-300 text-amber-800",
  culture: "bg-violet-100 border-violet-300 text-violet-800",
  relaxation: "bg-teal-100 border-teal-300 text-teal-800",
  nightlife: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800",
  sports: "bg-red-100 border-red-300 text-red-800",
  hiking: "bg-emerald-100 border-emerald-300 text-emerald-800",
  wildlife: "bg-lime-100 border-lime-300 text-lime-800",
  nature: "bg-green-100 border-green-300 text-green-800",
  shopping: "bg-pink-100 border-pink-300 text-pink-800",
  adventure: "bg-orange-100 border-orange-300 text-orange-800",
  beach: "bg-cyan-100 border-cyan-300 text-cyan-800",
};

const TRAVEL_COLOR = "bg-stone-800 border-stone-600 text-stone-100";
const ACTIVE_BENCHMARK_MODEL_ID_SET = new Set(
  AI_MODEL_CATALOG
    .filter((model) => model.availability === "active")
    .map((model) => model.id),
);

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

const textResponse = (status: number, body: Uint8Array | string, headers: Record<string, string>): Response =>
  new Response(body, {
    status,
    headers,
  });

const isEnabledFlag = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const getAuthToken = (request: Request): string | null => {
  const headerValue = request.headers.get(AUTH_HEADER) || "";
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = () => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const anonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
};

const getSupabaseServiceConfig = () => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    return null;
  }
  return { url, serviceRoleKey };
};

const buildSupabaseHeaders = (authToken: string, anonKey: string, extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
  ...extra,
});

const safeJsonParse = async (source: { text: () => Promise<string> }): Promise<any> => {
  const text = await source.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const supabaseFetch = async (
  config: { url: string; anonKey: string },
  authToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildSupabaseHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const supabaseServiceFetch = async (
  config: { url: string; serviceRoleKey: string },
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      ...(init.headers || {}),
    },
  });
};

const authorizeInternalRequest = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response | null> => {
  const emergencyFallbackEnabled = isEnabledFlag(readEnv("TF_ENABLE_ADMIN_KEY_FALLBACK"));
  if (emergencyFallbackEnabled) {
    const expected = readEnv("TF_ADMIN_API_KEY").trim();
    const provided = request.headers.get(ADMIN_HEADER)?.trim() || "";
    if (expected && provided && expected === provided) {
      return null;
    }
  }

  const response = await supabaseFetch(
    config,
    authToken,
    "/rest/v1/rpc/get_current_user_access",
    {
      method: "POST",
      headers: {
        Prefer: "params=single-object",
      },
      body: "{}",
    },
  );

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return json(403, {
      error: payload?.message || payload?.error || "Admin role verification failed.",
      code: "ADMIN_ROLE_CHECK_FAILED",
    });
  }

  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || row.system_role !== "admin") {
    return json(403, {
      error: "Admin role required for benchmark endpoints.",
      code: "ADMIN_ROLE_REQUIRED",
    });
  }

  return null;
};

const isUuid = (value?: string | null): boolean => Boolean(value && UUID_REGEX.test(value));

const toIsoDate = (value?: string): string => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
};

const addIsoDateDays = (isoDate: string, days: number): string => {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return isoDate;
  return new Date(parsed + (days * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
};

const getBenchmarkPreferenceDefaultDates = (): { startDate: string; endDate: string } => {
  const startDate = toIsoDate();
  const endDate = addIsoDateDays(startDate, BENCHMARK_PREFERENCES_DEFAULT_DURATION_DAYS);
  return { startDate, endDate };
};

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const normalizeTarget = (value: unknown): BenchmarkTarget | null => {
  if (!value || typeof value !== "object") return null;
  const typed = value as { provider?: unknown; model?: unknown; label?: unknown };
  const provider = typeof typed.provider === "string" ? typed.provider.trim().toLowerCase() : "";
  const model = typeof typed.model === "string" ? typed.model.trim() : "";
  const label = typeof typed.label === "string" ? typed.label.trim() : "";
  if (!provider || !model) return null;
  return {
    provider,
    model,
    label: label || undefined,
  };
};

const normalizeScenario = (value: unknown): BenchmarkScenario | null => {
  if (!value || typeof value !== "object") return null;
  const typed = value as {
    prompt?: unknown;
    startDate?: unknown;
    roundTrip?: unknown;
    input?: unknown;
  };

  const prompt = typeof typed.prompt === "string" ? typed.prompt.trim() : "";
  if (!prompt) return null;

  return {
    prompt,
    startDate: typeof typed.startDate === "string" ? toIsoDate(typed.startDate) : undefined,
    roundTrip: typeof typed.roundTrip === "boolean" ? typed.roundTrip : undefined,
    input: typed.input && typeof typed.input === "object" ? (typed.input as Record<string, unknown>) : undefined,
  };
};

const normalizeSatisfactionRating = (value: unknown): "good" | "medium" | "bad" | null => {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!SATISFACTION_RATINGS.has(normalized)) return null;
  return normalized as "good" | "medium" | "bad";
};

const formatErrorDetailsForMessage = (
  rawDetails: string,
  options: { maxLength?: number } = {},
): string => {
  const maxLength = Math.max(200, Math.floor(options.maxLength ?? 5000));
  const details = rawDetails || "";
  if (!details.trim()) return "No provider details returned";

  try {
    const parsed = JSON.parse(details);
    const serialized = JSON.stringify(parsed);
    if (serialized.length <= maxLength) return serialized;
    return `${serialized.slice(0, maxLength)}... [truncated]`;
  } catch {
    if (details.length <= maxLength) return details;
    return `${details.slice(0, maxLength)}... [truncated]`;
  }
};

const createShareToken = (): string => {
  const seed = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  return `abm_${seed}`;
};

const normalizeCityName = (value: string): string => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

const getCityColor = (index: number): string => CITY_COLORS[index % CITY_COLORS.length];

const tokenizeActivity = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(tokenizeActivity);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/[\s,|/;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
};

const normalizeActivityTypes = (value: unknown): string[] => {
  const tokens = tokenizeActivity(value);
  const accepted = new Set<string>();
  tokens.forEach((token) => {
    if (ACTIVITY_TYPES.includes(token as (typeof ACTIVITY_TYPES)[number])) {
      accepted.add(token);
      return;
    }
    if (token.includes("food") || token.includes("dining")) accepted.add("food");
    if (token.includes("culture") || token.includes("museum") || token.includes("history")) accepted.add("culture");
    if (token.includes("sight") || token.includes("landmark")) accepted.add("sightseeing");
    if (token.includes("beach") || token.includes("coast")) accepted.add("beach");
    if (token.includes("hike") || token.includes("trek")) accepted.add("hiking");
    if (token.includes("night") || token.includes("party") || token.includes("bar")) accepted.add("nightlife");
    if (token.includes("nature") || token.includes("park")) accepted.add("nature");
    if (token.includes("wildlife") || token.includes("safari")) accepted.add("wildlife");
    if (token.includes("shop") || token.includes("market")) accepted.add("shopping");
    if (token.includes("adventure")) accepted.add("adventure");
    if (token.includes("sport")) accepted.add("sports");
    if (token.includes("relax") || token.includes("spa")) accepted.add("relaxation");
  });

  if (accepted.size === 0) return ["general"];
  return ACTIVITY_TYPES.filter((type) => accepted.has(type));
};

const getActivityColor = (activityTypes: string[]): string => {
  const first = activityTypes.find((value) => ACTIVITY_TYPES.includes(value as (typeof ACTIVITY_TYPES)[number]));
  return first ? ACTIVITY_TYPE_COLOR[first as (typeof ACTIVITY_TYPES)[number]] : ACTIVITY_TYPE_COLOR.general;
};

const normalizeCityColors = (items: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
  const colorByCity = new Map<string, string>();
  let nextColorIndex = 0;

  return items.map((item) => {
    if (item.type !== "city") return item;
    const cityKey = normalizeCityName(String(item.title || item.location || ""));
    const fallbackColor = typeof item.color === "string" && item.color ? item.color : getCityColor(nextColorIndex++);

    if (!cityKey) {
      return {
        ...item,
        color: fallbackColor,
      };
    }

    if (!colorByCity.has(cityKey)) {
      colorByCity.set(cityKey, fallbackColor);
    }

    return {
      ...item,
      color: colorByCity.get(cityKey) || fallbackColor,
    };
  });
};

const validateModelData = (data: Record<string, unknown>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cities = Array.isArray(data.cities) ? data.cities : [];
  const activities = Array.isArray(data.activities) ? data.activities : [];
  const travelSegments = Array.isArray(data.travelSegments) ? data.travelSegments : [];

  const requiredTopLevelKeys = ["tripTitle", "cities", "travelSegments", "activities"];
  const topLevelContractValid = requiredTopLevelKeys.every((key) => hasOwn(data, key));
  if (!topLevelContractValid) {
    errors.push("Top-level contract missing one or more required keys");
  }

  const cityCountValid = cities.length > 0;
  if (!cityCountValid) {
    errors.push("No cities returned");
  }

  const cityRequiredFieldsValid = cities.every((city) => {
    if (!isRecord(city)) return false;
    return (
      hasText(city.name) &&
      hasText(city.description) &&
      Number.isFinite(Number(city.days)) &&
      Number(city.days) > 0 &&
      Number.isFinite(Number(city.lat)) &&
      Number.isFinite(Number(city.lng))
    );
  });

  const travelRequiredFieldsValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    return (
      hasOwn(segment, "fromCityIndex") &&
      hasOwn(segment, "toCityIndex") &&
      hasOwn(segment, "transportMode") &&
      hasOwn(segment, "description") &&
      hasOwn(segment, "duration") &&
      hasText(segment.description)
    );
  });

  const activityRequiredFieldsValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    return (
      hasText(activity.title) &&
      hasOwn(activity, "cityIndex") &&
      hasOwn(activity, "dayOffsetInCity") &&
      hasOwn(activity, "duration") &&
      hasText(activity.description) &&
      Array.isArray(activity.activityTypes) &&
      activity.activityTypes.length > 0
    );
  });

  const requiredFieldsValid = cityRequiredFieldsValid && travelRequiredFieldsValid && activityRequiredFieldsValid;
  if (!requiredFieldsValid) {
    errors.push("One or more entries are missing mandatory fields or have wrong field types");
  }

  const cityCoordinatesValid = cities.every((city) => {
    if (!isRecord(city)) return false;
    return Number.isFinite(Number(city.lat)) && Number.isFinite(Number(city.lng));
  });
  if (!cityCoordinatesValid) {
    errors.push("One or more cities have invalid coordinates");
  }

  const countryInfo = isRecord(data.countryInfo) ? data.countryInfo : null;
  const countryInfoPresent = !!countryInfo;
  const countryInfoValid = !!countryInfo && (
    (hasText(countryInfo.currency) || (hasText(countryInfo.currencyCode) && hasText(countryInfo.currencyName))) &&
    (Number.isFinite(Number(countryInfo.exchangeRate)) || Number.isFinite(Number(countryInfo.exchangeRateToEUR))) &&
    Array.isArray(countryInfo.languages) &&
    (countryInfo.languages as unknown[]).some((entry) => hasText(entry)) &&
    (hasText(countryInfo.electricSockets) || hasText(countryInfo.sockets)) &&
    (hasText(countryInfo.visaInfoUrl) || hasText(countryInfo.visaLink)) &&
    (hasText(countryInfo.auswaertigesAmtUrl) || hasText(countryInfo.auswaertigesAmtLink))
  );
  if (!countryInfoPresent) {
    warnings.push("countryInfo is missing (non-blocking)");
  } else if (!countryInfoValid) {
    warnings.push("countryInfo is missing required fields or has invalid formatting (non-blocking)");
  }

  const markdownSectionsValid = cities.every((city) => {
    if (!isRecord(city)) return false;
    const description = String(city.description || "");
    return (
      /###\s*Must\s*See/i.test(description) &&
      /###\s*Must\s*Try/i.test(description) &&
      /###\s*Must\s*Do/i.test(description)
    );
  });
  if (!markdownSectionsValid) {
    errors.push("One or more city descriptions are missing required markdown sections");
  }

  const cityIndexValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    const cityIndex = Number(activity.cityIndex);
    return Number.isFinite(cityIndex) && cityIndex >= 0 && cityIndex < cities.length;
  });
  if (!cityIndexValid) {
    errors.push("One or more activities have invalid cityIndex values");
  }

  const activityTypesValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    const normalized = normalizeActivityTypes(activity.activityTypes ?? activity.type);
    return normalized.length > 0;
  });
  if (!activityTypesValid) {
    errors.push("One or more activities have invalid activityTypes values");
  }

  const activityTypesCanonicalValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    if (!Array.isArray(activity.activityTypes)) return false;
    const values = activity.activityTypes;
    if (values.length < 1 || values.length > 3) return false;
    return values.every((entry) => {
      if (typeof entry !== "string") return false;
      const token = entry.trim();
      const lowerToken = token.toLocaleLowerCase();
      return token === lowerToken && ACTIVITY_TYPES.includes(lowerToken as (typeof ACTIVITY_TYPES)[number]);
    });
  });
  if (activityTypesValid && !activityTypesCanonicalValid) {
    warnings.push("One or more activities use non-canonical activityTypes values (auto-normalized)");
  }

  const activityDurationFormatValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    const parsedDays = parseFlexibleDurationDays(activity.duration);
    return Number.isFinite(parsedDays) && (parsedDays as number) > 0;
  });
  if (!activityDurationFormatValid) {
    errors.push("One or more activities have invalid duration format (expected numeric days)");
  }

  const activityDurationCanonicalTypeValid = activities.every((activity) => {
    if (!isRecord(activity)) return false;
    return typeof activity.duration === "number" && Number.isFinite(activity.duration) && activity.duration > 0;
  });
  if (activityDurationFormatValid && !activityDurationCanonicalTypeValid) {
    warnings.push("One or more activities use non-canonical duration values (expected numeric days, parser normalized strings)");
  }

  const transportModesValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const parsed = parseTransportMode(segment.transportMode);
    return (
      parsed.recognized &&
      parsed.mode !== "na" &&
      ALLOWED_MODEL_TRANSPORT_MODE_SET.has(parsed.mode)
    );
  });
  if (!transportModesValid && travelSegments.length > 0) {
    errors.push("One or more travel segments have invalid transportMode values (must map to a supported enum value)");
  }

  const transportModesCanonicalValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const parsed = parseTransportMode(segment.transportMode);
    const raw = typeof segment.transportMode === "string" ? segment.transportMode.trim() : "";
    return (
      parsed.recognized &&
      parsed.mode !== "na" &&
      ALLOWED_MODEL_TRANSPORT_MODE_SET.has(parsed.mode) &&
      raw === parsed.mode
    );
  });
  if (travelSegments.length > 0 && transportModesValid && !transportModesCanonicalValid) {
    warnings.push("One or more travel segments use non-canonical transportMode values (expected lowercase enum, aliases/casing were normalized)");
  }

  const travelDurationFormatValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const parsedHours = parseFlexibleDurationHours(segment.duration);
    return Number.isFinite(parsedHours) && (parsedHours as number) > 0;
  });
  if (!travelDurationFormatValid && travelSegments.length > 0) {
    errors.push("One or more travel segments have invalid duration format (expected numeric hours)");
  }

  const travelDurationCanonicalTypeValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    return typeof segment.duration === "number" && Number.isFinite(segment.duration) && segment.duration > 0;
  });
  if (travelSegments.length > 0 && travelDurationFormatValid && !travelDurationCanonicalTypeValid) {
    warnings.push("One or more travel segments use non-canonical duration values (expected numeric hours, parser normalized strings)");
  }

  const travelSegmentIndicesValid = travelSegments.every((segment) => {
    if (!isRecord(segment)) return false;
    const fromCityIndex = Number(segment.fromCityIndex);
    const toCityIndex = Number(segment.toCityIndex);
    return (
      Number.isFinite(fromCityIndex) &&
      Number.isFinite(toCityIndex) &&
      fromCityIndex >= 0 &&
      toCityIndex >= 0 &&
      fromCityIndex < cities.length &&
      toCityIndex < cities.length &&
      fromCityIndex !== toCityIndex
    );
  });
  if (!travelSegmentIndicesValid && travelSegments.length > 0) {
    errors.push("One or more travel segments have invalid city index values");
  }

  const checks = {
    topLevelContractValid,
    cityCountValid,
    requiredFieldsValid,
    cityCoordinatesValid,
    countryInfoPresent,
    countryInfoValid,
    activityTypesValid,
    activityTypesCanonicalValid,
    activityDurationFormatValid,
    activityDurationCanonicalTypeValid,
    cityIndexValid,
    markdownSectionsValid,
    transportModesValid: travelSegments.length === 0 ? true : transportModesValid,
    transportModesCanonicalValid: travelSegments.length === 0 ? true : transportModesCanonicalValid,
    travelDurationFormatValid: travelSegments.length === 0 ? true : travelDurationFormatValid,
    travelDurationCanonicalTypeValid: travelSegments.length === 0 ? true : travelDurationCanonicalTypeValid,
    travelSegmentIndicesValid: travelSegments.length === 0 ? true : travelSegmentIndicesValid,
    warningCount: warnings.length,
    validationWarnings: warnings,
  };

  const blockingChecks = [
    topLevelContractValid,
    cityCountValid,
    requiredFieldsValid,
    cityCoordinatesValid,
    activityTypesValid,
    activityDurationFormatValid,
    cityIndexValid,
    markdownSectionsValid,
    travelSegments.length === 0 ? true : transportModesValid,
    travelSegments.length === 0 ? true : travelDurationFormatValid,
    travelSegments.length === 0 ? true : travelSegmentIndicesValid,
  ];
  const schemaValid = blockingChecks.every(Boolean);

  return {
    schemaValid,
    checks,
    errors,
    warnings,
  };
};

const buildTripFromModelData = (
  data: Record<string, unknown>,
  startDate: string,
  options: {
    roundTrip?: boolean;
    provider: string;
    model: string;
    benchmarkSessionId: string;
    benchmarkRunId: string;
  },
): Record<string, unknown> => {
  const items: Array<Record<string, unknown>> = [];
  const cityOffsets: number[] = [];
  const cityDurations: number[] = [];
  const parsedCities: Array<{
    name: string;
    days: number;
    description: string;
    coordinates?: { lat: number; lng: number };
    sourceIndex: number;
  }> = [];

  const rawCities = Array.isArray(data.cities) ? data.cities : [];

  rawCities.forEach((city, index) => {
    if (!city || typeof city !== "object") return;
    const typed = city as Record<string, unknown>;
    const name = String(typed.name || `Stop ${index + 1}`);
    const daysRaw = Number(typed.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.round(daysRaw) : 1;
    const lat = Number(typed.lat);
    const lng = Number(typed.lng);

    parsedCities.push({
      name,
      days,
      description: String(typed.description || ""),
      coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined,
      sourceIndex: index,
    });
  });

  if (options.roundTrip && parsedCities.length > 0) {
    const first = parsedCities[0];
    const last = parsedCities[parsedCities.length - 1];
    if (normalizeCityName(first.name) !== normalizeCityName(last.name)) {
      parsedCities.push({
        ...first,
        days: 1,
        sourceIndex: -1,
      });
    }
  }

  let currentDayOffset = 0;
  parsedCities.forEach((city, index) => {
    cityOffsets[index] = currentDayOffset;
    cityDurations[index] = city.days;

    items.push({
      id: `city-${index}-${Date.now()}`,
      type: "city",
      title: city.name,
      startDateOffset: currentDayOffset,
      duration: city.days,
      color: getCityColor(index),
      description: city.description,
      location: city.name,
      coordinates: city.coordinates,
    });

    const rawActivities = Array.isArray(data.activities) ? data.activities : [];
    if (city.sourceIndex >= 0) {
      rawActivities.forEach((activity, activityIndex) => {
        if (!activity || typeof activity !== "object") return;
        const typed = activity as Record<string, unknown>;
        const cityIndex = Number(typed.cityIndex);
        if (!Number.isFinite(cityIndex) || cityIndex !== city.sourceIndex) return;

        const dayOffsetInCityRaw = Number(typed.dayOffsetInCity);
        const dayOffsetInCity = Number.isFinite(dayOffsetInCityRaw) ? dayOffsetInCityRaw : 0;
        const activityDurationRaw = Number(typed.duration);
        const parsedActivityDurationDays = parseFlexibleDurationDays(typed.duration);
        const activityDuration = Number.isFinite(parsedActivityDurationDays) && (parsedActivityDurationDays as number) > 0
          ? (parsedActivityDurationDays as number)
          : (Number.isFinite(activityDurationRaw) && activityDurationRaw > 0 ? activityDurationRaw : 1);
        const activityTypes = normalizeActivityTypes(typed.activityTypes ?? typed.type);

        items.push({
          id: `act-${index}-${activityIndex}-${Date.now()}`,
          type: "activity",
          title: String(typed.title || "Planned Activity"),
          startDateOffset: currentDayOffset + dayOffsetInCity,
          duration: activityDuration,
          color: getActivityColor(activityTypes),
          description: String(typed.description || ""),
          location: city.name,
          activityType: activityTypes,
        });
      });
    }

    currentDayOffset += city.days;
  });

  const rawTravelSegments = Array.isArray(data.travelSegments) ? data.travelSegments : [];
  rawTravelSegments.forEach((travel, index) => {
    if (!travel || typeof travel !== "object") return;
    const typed = travel as Record<string, unknown>;
    const fromCityIndex = Number(typed.fromCityIndex);
    const toCityIndex = Number(typed.toCityIndex);

    if (!Number.isFinite(fromCityIndex) || fromCityIndex < 0 || fromCityIndex >= cityOffsets.length) return;

    const startOffset = cityOffsets[fromCityIndex] + (cityDurations[fromCityIndex] || 1) - 0.5;
    const durationHours = parseFlexibleDurationHours(typed.duration);
    const durationDays = Number.isFinite(durationHours) && (durationHours as number) > 0 ? (durationHours as number) / 24 : 0.1;

    const fromCityName = parsedCities[fromCityIndex]?.name || "previous stop";
    const toCityName = Number.isFinite(toCityIndex) && toCityIndex >= 0 && toCityIndex < parsedCities.length
      ? parsedCities[toCityIndex]?.name
      : "next stop";

    items.push({
      id: `travel-${index}-${Date.now()}`,
      type: "travel",
      title: String(typed.description || "Travel"),
      startDateOffset: startOffset,
      duration: durationDays,
      color: TRAVEL_COLOR,
      description: `Travel from ${fromCityName} to ${toCityName}`,
      transportMode: normalizeTransportMode(typed.transportMode),
    });
  });

  const now = Date.now();
  const tripId = crypto.randomUUID();

  return {
    id: tripId,
    title: String(data.tripTitle || "My Trip"),
    startDate,
    items: normalizeCityColors(items),
    countryInfo: data.countryInfo ?? undefined,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    roundTrip: options.roundTrip ? true : undefined,
    cityColorPaletteId: "classic",
    mapColorMode: "trip",
    sourceKind: "ai_benchmark",
    sourceTemplateId: options.benchmarkSessionId,
    aiMeta: {
      provider: options.provider,
      model: options.model,
      generatedAt: new Date(now).toISOString(),
      benchmarkSessionId: options.benchmarkSessionId,
      benchmarkRunId: options.benchmarkRunId,
    },
  };
};

const persistTrip = async (
  config: { url: string; anonKey: string },
  authToken: string,
  trip: Record<string, unknown>,
  sessionId: string,
): Promise<{ tripId: string | null; error?: string }> => {
  const tripId = String(trip.id || "").trim();
  if (!tripId) {
    return { tripId: null, error: "Trip ID missing after normalization" };
  }

  const startDateRaw = String(trip.startDate || "");
  const payload = {
    id: tripId,
    title: String(trip.title || "Untitled trip"),
    start_date: toIsoDate(startDateRaw),
    data: trip,
    view_settings: null,
    is_favorite: false,
    status: "active",
    trip_expires_at: null,
    source_kind: "ai_benchmark",
    source_template_id: sessionId,
  };

  const response = await supabaseFetch(config, authToken, "/rest/v1/trips?select=id", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      tripId: null,
      error: `Failed to persist benchmark trip (${response.status}): ${details.slice(0, 600)}`,
    };
  }

  const raw = await safeJsonParse(response);
  const row = Array.isArray(raw) ? raw[0] : raw;
  const persistedTripId = typeof row?.id === "string" ? row.id : tripId;
  return { tripId: persistedTripId };
};

const fetchSessionById = async (
  config: { url: string; anonKey: string },
  authToken: string,
  sessionId: string,
): Promise<BenchmarkSessionRow | null> => {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("id", `eq.${sessionId}`);
  params.set("limit", "1");

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_sessions?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) return null;
  const raw = await safeJsonParse(response);
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw[0] as BenchmarkSessionRow;
};

const fetchSessionByShareToken = async (
  config: { url: string; anonKey: string },
  authToken: string,
  shareToken: string,
): Promise<BenchmarkSessionRow | null> => {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("share_token", `eq.${shareToken}`);
  params.set("limit", "1");

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_sessions?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) return null;
  const raw = await safeJsonParse(response);
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw[0] as BenchmarkSessionRow;
};

const createSession = async (
  config: { url: string; anonKey: string },
  authToken: string,
  payload: { name?: string; flow: "classic" | "wizard" | "surprise"; scenario: BenchmarkScenario },
): Promise<{ session: BenchmarkSessionRow | null; error?: string }> => {
  const response = await supabaseFetch(
    config,
    authToken,
    "/rest/v1/ai_benchmark_sessions?select=*",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        share_token: createShareToken(),
        name: payload.name || null,
        flow: payload.flow,
        scenario: payload.scenario,
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    return {
      session: null,
      error: `Failed to create benchmark session (${response.status}): ${details.slice(0, 600)}`,
    };
  }

  const raw = await safeJsonParse(response);
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") {
    return {
      session: null,
      error: "Supabase did not return benchmark session row",
    };
  }

  return { session: row as BenchmarkSessionRow };
};

const fetchRunsForSession = async (
  config: { url: string; anonKey: string },
  authToken: string,
  sessionId: string,
): Promise<BenchmarkRunRow[]> => {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("session_id", `eq.${sessionId}`);
  params.set("order", "created_at.asc");

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_runs?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) return [];
  const raw = await safeJsonParse(response);
  return Array.isArray(raw) ? (raw as BenchmarkRunRow[]) : [];
};

const fetchRunById = async (
  config: { url: string; anonKey: string },
  authToken: string,
  runId: string,
): Promise<BenchmarkRunRow | null> => {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("id", `eq.${runId}`);
  params.set("limit", "1");

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_runs?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) return null;
  const raw = await safeJsonParse(response);
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw[0] as BenchmarkRunRow;
};

const isRunCancelled = (run: BenchmarkRunRow | null): boolean => {
  if (!run) return false;
  if (run.status !== "failed") return false;
  const message = typeof run.error_message === "string" ? run.error_message : "";
  return message.startsWith(CANCELLED_BY_USER_MESSAGE);
};

const isRunActive = (run: BenchmarkRunRow | null): boolean => {
  if (!run) return false;
  return run.status === "queued" || run.status === "running";
};

const hasRunBeenCancelled = async (
  config: { url: string; anonKey: string },
  authToken: string,
  runId: string,
): Promise<boolean> => {
  const latest = await fetchRunById(config, authToken, runId);
  return isRunCancelled(latest);
};

const createRunRows = async (
  config: { url: string; anonKey: string },
  authToken: string,
  rows: Array<Record<string, unknown>>,
): Promise<{ rows: BenchmarkRunRow[]; error?: string }> => {
  if (rows.length === 0) {
    return { rows: [] };
  }

  const response = await supabaseFetch(
    config,
    authToken,
    "/rest/v1/ai_benchmark_runs?select=*",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    return {
      rows: [],
      error: `Failed to create benchmark runs (${response.status}): ${details.slice(0, 600)}`,
    };
  }

  const raw = await safeJsonParse(response);
  return { rows: Array.isArray(raw) ? (raw as BenchmarkRunRow[]) : [] };
};

const updateRunRow = async (
  config: { url: string; anonKey: string },
  authToken: string,
  runId: string,
  patch: Record<string, unknown>,
): Promise<boolean> => {
  const params = new URLSearchParams();
  params.set("id", `eq.${runId}`);

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_runs?${params.toString()}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );

  return response.ok;
};

const summarizeRuns = (runs: BenchmarkRunRow[]) => {
  const total = runs.length;
  const completed = runs.filter((run) => run.status === "completed").length;
  const failed = runs.filter((run) => run.status === "failed").length;
  const running = runs.filter((run) => run.status === "running").length;
  const queued = runs.filter((run) => run.status === "queued").length;

  const completedWithLatency = runs
    .filter((run) => run.status === "completed" && typeof run.latency_ms === "number")
    .map((run) => Number(run.latency_ms));

  const averageLatencyMs = completedWithLatency.length > 0
    ? Math.round(completedWithLatency.reduce((sum, value) => sum + value, 0) / completedWithLatency.length)
    : null;

  const totalCostUsd = runs.reduce((sum, run) => {
    return sum + (typeof run.cost_usd === "number" ? run.cost_usd : 0);
  }, 0);

  return {
    total,
    completed,
    failed,
    running,
    queued,
    averageLatencyMs,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
  };
};

const runGeneration = async (
  _request: Request,
  run: BenchmarkRunRow,
  scenario: BenchmarkScenario,
  config: { url: string; anonKey: string },
  authToken: string,
  sessionId: string,
): Promise<void> => {
  if (await hasRunBeenCancelled(config, authToken, run.id)) {
    return;
  }

  const startedAt = new Date().toISOString();
  await updateRunRow(config, authToken, run.id, {
    status: "running",
    started_at: startedAt,
    error_message: null,
  });

  if (await hasRunBeenCancelled(config, authToken, run.id)) {
    return;
  }

  const startedMs = Date.now();
  const persistRunTelemetry = async (
    input: {
      status: "success" | "failed";
      latencyMs: number;
      httpStatus: number;
      provider?: string;
      model?: string;
      providerModel?: string;
      errorCode?: string;
      errorMessage?: string;
      usage?: ProviderUsage;
      estimatedCostUsd?: number | null;
      metadata?: Record<string, unknown>;
    },
  ) => {
    try {
      await persistAiGenerationTelemetry({
        source: "benchmark",
        requestId: run.id,
        provider: input.provider || run.provider,
        model: input.model || run.model,
        providerModel: input.providerModel,
        status: input.status,
        latencyMs: input.latencyMs,
        httpStatus: input.httpStatus,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        estimatedCostUsd: input.estimatedCostUsd ?? input.usage?.estimatedCostUsd,
        promptTokens: input.usage?.promptTokens,
        completionTokens: input.usage?.completionTokens,
        totalTokens: input.usage?.totalTokens,
        benchmarkSessionId: sessionId,
        benchmarkRunId: run.id,
        metadata: input.metadata,
      });
    } catch {
      // Best-effort only: benchmark execution should not fail on telemetry persistence errors.
    }
  };

  try {
    const result = await generateProviderItinerary({
      prompt: scenario.prompt,
      provider: run.provider,
      model: run.model,
      timeoutMs: BENCHMARK_PROVIDER_TIMEOUT_MS,
    });
    const latencyMs = Date.now() - startedMs;

    if (!result.ok) {
      const details = JSON.stringify(result.value);
      const formattedDetails = formatErrorDetailsForMessage(details, { maxLength: 5000 });
      await persistRunTelemetry({
        status: "failed",
        latencyMs,
        httpStatus: result.status,
        providerModel: result.value.providerModel,
        errorCode: result.value.code,
        errorMessage: result.value.error,
        metadata: {
          reason: "provider_request_failed",
        },
      });
      if (await hasRunBeenCancelled(config, authToken, run.id)) {
        return;
      }
      await updateRunRow(config, authToken, run.id, {
        status: "failed",
        finished_at: new Date().toISOString(),
        latency_ms: latencyMs,
        error_message: `Generation failed (${result.status}): ${formattedDetails}`,
      });
      return;
    }

    const modelData = result.value.data;
    const usage: ProviderUsage = result.value.meta?.usage || {};

    if (!modelData || typeof modelData !== "object") {
      await persistRunTelemetry({
        status: "failed",
        latencyMs,
        httpStatus: 200,
        provider: result.value.meta.provider,
        model: result.value.meta.model,
        providerModel: result.value.meta.providerModel,
        usage,
        errorCode: "BENCHMARK_OUTPUT_INVALID",
        errorMessage: "Provider response did not include a valid data object",
        metadata: {
          reason: "invalid_data_object",
        },
      });
      if (await hasRunBeenCancelled(config, authToken, run.id)) {
        return;
      }
      await updateRunRow(config, authToken, run.id, {
        status: "failed",
        finished_at: new Date().toISOString(),
        latency_ms: latencyMs,
        error_message: "Provider response did not include a valid data object",
      });
      return;
    }

    const validation = validateModelData(modelData as Record<string, unknown>);
    if (!validation.schemaValid) {
      await persistRunTelemetry({
        status: "failed",
        latencyMs,
        httpStatus: 200,
        provider: result.value.meta.provider,
        model: result.value.meta.model,
        providerModel: result.value.meta.providerModel,
        usage,
        errorCode: "BENCHMARK_OUTPUT_VALIDATION_FAILED",
        errorMessage: validation.errors.join("; ") || "Model output failed validation",
        metadata: {
          reason: "validation_failed",
          validationErrorCount: validation.errors.length,
        },
      });
      if (await hasRunBeenCancelled(config, authToken, run.id)) {
        return;
      }
      await updateRunRow(config, authToken, run.id, {
        status: "failed",
        finished_at: new Date().toISOString(),
        latency_ms: latencyMs,
        schema_valid: false,
        validation_checks: validation.checks,
        validation_errors: validation.errors,
        raw_output: modelData,
        error_message: `Model output failed validation: ${validation.errors.join("; ")}`,
      });
      return;
    }

    const trip = buildTripFromModelData(
      modelData as Record<string, unknown>,
      toIsoDate(scenario.startDate),
      {
        roundTrip: scenario.roundTrip,
        provider: run.provider,
        model: run.model,
        benchmarkSessionId: sessionId,
        benchmarkRunId: run.id,
      },
    );

    const persistedTrip = await persistTrip(config, authToken, trip, sessionId);
    if (!persistedTrip.tripId) {
      await persistRunTelemetry({
        status: "failed",
        latencyMs,
        httpStatus: 502,
        provider: result.value.meta.provider,
        model: result.value.meta.model,
        providerModel: result.value.meta.providerModel,
        usage,
        errorCode: "BENCHMARK_TRIP_PERSIST_FAILED",
        errorMessage: persistedTrip.error || "Failed to persist generated trip",
        metadata: {
          reason: "trip_persist_failed",
        },
      });
      if (await hasRunBeenCancelled(config, authToken, run.id)) {
        return;
      }
      await updateRunRow(config, authToken, run.id, {
        status: "failed",
        finished_at: new Date().toISOString(),
        latency_ms: latencyMs,
        error_message: persistedTrip.error || "Failed to persist generated trip",
      });
      return;
    }

    const finishedAt = new Date().toISOString();
    const estimatedCostUsd = typeof usage.estimatedCostUsd === "number" ? usage.estimatedCostUsd : null;

    if (await hasRunBeenCancelled(config, authToken, run.id)) {
      return;
    }

    await updateRunRow(config, authToken, run.id, {
      status: "completed",
      finished_at: finishedAt,
      latency_ms: latencyMs,
      schema_valid: validation.schemaValid,
      validation_checks: validation.checks,
      validation_errors: validation.errors,
      usage,
      cost_usd: estimatedCostUsd,
      raw_output: modelData,
      normalized_trip: trip,
      trip_id: persistedTrip.tripId,
      trip_ai_meta: (trip.aiMeta as Record<string, unknown>) || null,
      error_message: null,
    });

    await persistRunTelemetry({
      status: "success",
      latencyMs,
      httpStatus: 200,
      provider: result.value.meta.provider,
      model: result.value.meta.model,
      providerModel: result.value.meta.providerModel,
      usage,
      estimatedCostUsd,
      metadata: {
        reason: "completed",
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startedMs;
    await persistRunTelemetry({
      status: "failed",
      latencyMs,
      httpStatus: 500,
      errorCode: "BENCHMARK_RUN_UNEXPECTED_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unexpected benchmark run error",
      metadata: {
        reason: "unexpected_exception",
      },
    });
    if (await hasRunBeenCancelled(config, authToken, run.id)) {
      return;
    }
    await updateRunRow(config, authToken, run.id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      latency_ms: latencyMs,
      error_message: error instanceof Error ? error.message : "Unexpected benchmark run error",
    });
  }
};

const runWithConcurrency = async (
  request: Request,
  runs: BenchmarkRunRow[],
  scenario: BenchmarkScenario,
  config: { url: string; anonKey: string },
  authToken: string,
  sessionId: string,
  concurrency: number,
) => {
  let cursor = 0;
  const workers: Array<Promise<void>> = [];

  const worker = async () => {
    while (cursor < runs.length) {
      const currentIndex = cursor;
      cursor += 1;
      const run = runs[currentIndex];
      await runGeneration(request, run, scenario, config, authToken, sessionId);
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, runs.length));
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
};

const findExistingRunIndex = (existingRuns: BenchmarkRunRow[], target: BenchmarkTarget): number => {
  return existingRuns
    .filter((run) => run.provider === target.provider && run.model === target.model)
    .reduce((max, run) => Math.max(max, Number(run.run_index) || 0), 0);
};

const toDosDateTime = (date: Date): { date: number; time: number } => {
  const year = date.getFullYear();
  const dosYear = Math.max(1980, Math.min(2107, year));
  const dosDate = ((dosYear - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { date: dosDate, time: dosTime };
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (view: DataView, offset: number, value: number) => {
  view.setUint16(offset, value & 0xffff, true);
};

const writeUint32 = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value >>> 0, true);
};

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
};

const buildZipArchive = (files: Array<{ name: string; content: string }>): Uint8Array => {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dos = toDosDateTime(now);

  files.forEach((file) => {
    const fileNameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const checksum = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const localView = new DataView(localHeader.buffer);

    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dos.time);
    writeUint16(localView, 12, dos.date);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, dataBytes.length);
    writeUint32(localView, 22, dataBytes.length);
    writeUint16(localView, 26, fileNameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(fileNameBytes, 30);

    const centralHeader = new Uint8Array(46 + fileNameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, dos.time);
    writeUint16(centralView, 14, dos.date);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, dataBytes.length);
    writeUint32(centralView, 24, dataBytes.length);
    writeUint16(centralView, 28, fileNameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralHeader.set(fileNameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + dataBytes.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const localData = concatBytes(localParts);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeUint32(eocdView, 0, 0x06054b50);
  writeUint16(eocdView, 4, 0);
  writeUint16(eocdView, 6, 0);
  writeUint16(eocdView, 8, files.length);
  writeUint16(eocdView, 10, files.length);
  writeUint32(eocdView, 12, centralDirectory.length);
  writeUint32(eocdView, 16, localData.length);
  writeUint16(eocdView, 20, 0);

  return concatBytes([localData, centralDirectory, eocd]);
};

const sanitizeFilenameSegment = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "run";
};

const formatRunFileName = (run: BenchmarkRunRow): string => {
  const provider = sanitizeFilenameSegment(run.provider || "provider");
  const model = sanitizeFilenameSegment(run.model || "model");
  const index = Number.isFinite(run.run_index) ? run.run_index : 1;
  return `${provider}__${model}__run-${index}.json`;
};

const formatRunLogFileName = (run: BenchmarkRunRow): string => {
  return formatRunFileName(run).replace(/\.json$/i, ".log.json");
};

const normalizeTelemetrySource = (value: string | null): "all" | "create_trip" | "benchmark" => {
  const normalized = (value || "").trim().toLowerCase();
  if (!TELEMETRY_SOURCE_VALUES.has(normalized)) return "all";
  if (normalized === "create_trip" || normalized === "benchmark") return normalized;
  return "all";
};

const normalizeTelemetryWindowHours = (value: string | null): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return TELEMETRY_WINDOW_DEFAULT_HOURS;
  return clampNumber(
    Math.round(parsed),
    TELEMETRY_WINDOW_MIN_HOURS,
    TELEMETRY_WINDOW_MAX_HOURS,
  );
};

const normalizeTelemetryProvider = (value: string | null): string | null => {
  const normalized = (value || "").trim().toLowerCase();
  return normalized ? normalized : null;
};

const toTelemetryRows = (value: unknown): AiTelemetryRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const typed = row as Record<string, unknown>;
      const id = typeof typed.id === "string" ? typed.id : "";
      const createdAt = typeof typed.created_at === "string" ? typed.created_at : "";
      const source = typed.source === "benchmark" ? "benchmark" : typed.source === "create_trip" ? "create_trip" : null;
      const provider = typeof typed.provider === "string" ? typed.provider : "";
      const model = typeof typed.model === "string" ? typed.model : "";
      const status = typed.status === "failed" ? "failed" : typed.status === "success" ? "success" : null;
      if (!id || !createdAt || !source || !provider || !model || !status) return null;

      return {
        id,
        created_at: createdAt,
        source,
        provider,
        model,
        status,
        latency_ms: Number.isFinite(Number(typed.latency_ms)) ? Number(typed.latency_ms) : null,
        estimated_cost_usd: Number.isFinite(Number(typed.estimated_cost_usd)) ? Number(typed.estimated_cost_usd) : null,
        error_code: typeof typed.error_code === "string" ? typed.error_code : null,
      } satisfies AiTelemetryRow;
    })
    .filter((row): row is AiTelemetryRow => Boolean(row));
};

const handleTelemetry = async (
  request: Request,
  _config: { url: string; anonKey: string },
): Promise<Response> => {
  const url = new URL(request.url);
  const source = normalizeTelemetrySource(url.searchParams.get("source"));
  const providerFilter = normalizeTelemetryProvider(url.searchParams.get("provider"));
  const windowHours = normalizeTelemetryWindowHours(url.searchParams.get("windowHours"));
  const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams();
  params.set("select", "id,created_at,source,provider,model,status,latency_ms,estimated_cost_usd,error_code");
  params.set("created_at", `gte.${sinceIso}`);
  params.set("order", "created_at.desc");
  params.set("limit", "2000");
  if (source !== "all") {
    params.set("source", `eq.${source}`);
  }
  if (providerFilter) {
    params.set("provider", `eq.${providerFilter}`);
  }

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return json(503, {
      error: "Supabase service config missing. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      code: "SUPABASE_SERVICE_CONFIG_MISSING",
    });
  }

  const response = await supabaseServiceFetch(
    serviceConfig,
    `/rest/v1/ai_generation_events?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) {
    const details = await response.text();
    return json(502, {
      error: "Failed to load AI telemetry rows.",
      code: "AI_TELEMETRY_FETCH_FAILED",
      details: details.slice(0, 600),
    });
  }

  const rows = toTelemetryRows(await safeJsonParse(response));
  const providerOptions = Array.from(new Set(rows.map((row) => row.provider).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
  const summary = summarizeAiTelemetry(rows);
  const series = buildAiTelemetrySeries(rows, 60);
  const providerSummary = summarizeAiTelemetryByProvider(rows);

  return json(200, {
    ok: true,
    filters: {
      source,
      provider: providerFilter || "all",
      windowHours,
    },
    summary,
    series,
    providers: providerSummary,
    recent: rows.slice(0, 120),
    availableProviders: providerOptions,
  });
};

const normalizeBenchmarkPreferencesForStorage = (
  value: unknown,
  options: { defaultStartDate: string; defaultEndDate: string },
): BenchmarkPreferencesPayload => {
  const fallbackPresets = createSystemBenchmarkPresets(options.defaultStartDate, options.defaultEndDate);
  return normalizeBenchmarkPreferencesPayload(value, {
    fallbackModelIds: BENCHMARK_DEFAULT_MODEL_IDS,
    fallbackPresets,
    defaultStartDate: options.defaultStartDate,
    defaultEndDate: options.defaultEndDate,
    allowedModelIds: ACTIVE_BENCHMARK_MODEL_ID_SET,
  });
};

const toBenchmarkPreferencesRow = (value: unknown): BenchmarkPreferencesRow | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.owner_id !== "string") return null;
  return {
    owner_id: row.owner_id,
    model_targets: row.model_targets,
    presets: row.presets,
    selected_preset_id: typeof row.selected_preset_id === "string" ? row.selected_preset_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
};

const fetchBenchmarkPreferencesRow = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<{ row: BenchmarkPreferencesRow | null; error?: string; details?: string; status?: number }> => {
  const params = new URLSearchParams();
  params.set("select", "owner_id,model_targets,presets,selected_preset_id,created_at,updated_at");
  params.set("order", "updated_at.desc");
  params.set("limit", "1");

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_preferences?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) {
    const details = await response.text();
    return {
      row: null,
      error: "Failed to load benchmark preferences",
      details: details.slice(0, 600),
      status: response.status,
    };
  }

  const payload = await safeJsonParse(response);
  const rows = Array.isArray(payload) ? payload : [];
  return {
    row: toBenchmarkPreferencesRow(rows[0]) || null,
  };
};

const saveBenchmarkPreferencesRow = async (
  config: { url: string; anonKey: string },
  authToken: string,
  payload: BenchmarkPreferencesPayload,
  existingRow: BenchmarkPreferencesRow | null,
): Promise<{ row: BenchmarkPreferencesRow | null; error?: string; details?: string; status?: number }> => {
  const body = JSON.stringify([
    {
      model_targets: payload.modelTargets,
      presets: payload.presets,
      selected_preset_id: payload.selectedPresetId,
    },
  ]);

  if (existingRow?.owner_id) {
    const params = new URLSearchParams();
    params.set("owner_id", `eq.${existingRow.owner_id}`);
    params.set("select", "owner_id,model_targets,presets,selected_preset_id,created_at,updated_at");

    const response = await supabaseFetch(
      config,
      authToken,
      `/rest/v1/ai_benchmark_preferences?${params.toString()}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body,
      },
    );

    if (!response.ok) {
      const details = await response.text();
      return {
        row: null,
        error: "Failed to update benchmark preferences",
        details: details.slice(0, 600),
        status: response.status,
      };
    }

    const rows = await safeJsonParse(response);
    return {
      row: toBenchmarkPreferencesRow(Array.isArray(rows) ? rows[0] : rows),
    };
  }

  const params = new URLSearchParams();
  params.set("select", "owner_id,model_targets,presets,selected_preset_id,created_at,updated_at");

  const response = await supabaseFetch(
    config,
    authToken,
    `/rest/v1/ai_benchmark_preferences?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body,
    },
  );

  if (!response.ok) {
    const details = await response.text();
    return {
      row: null,
      error: "Failed to create benchmark preferences",
      details: details.slice(0, 600),
      status: response.status,
    };
  }

  const rows = await safeJsonParse(response);
  return {
    row: toBenchmarkPreferencesRow(Array.isArray(rows) ? rows[0] : rows),
  };
};

const handlePreferences = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use GET or POST." });
  }

  const { startDate, endDate } = getBenchmarkPreferenceDefaultDates();

  const existing = await fetchBenchmarkPreferencesRow(config, authToken);
  if (existing.error) {
    return json(existing.status === 403 ? 403 : 502, {
      error: existing.error,
      code: "BENCHMARK_PREFERENCES_FETCH_FAILED",
      details: existing.details,
    });
  }

  if (request.method === "GET") {
    const normalized = normalizeBenchmarkPreferencesForStorage({
      modelTargets: existing.row?.model_targets,
      presets: existing.row?.presets,
      selectedPresetId: existing.row?.selected_preset_id,
    }, {
      defaultStartDate: startDate,
      defaultEndDate: endDate,
    });

    // Ensure first access has a persisted row in DB instead of local storage only.
    if (!existing.row) {
      const saved = await saveBenchmarkPreferencesRow(config, authToken, normalized, null);
      if (saved.error) {
        return json(502, {
          error: saved.error,
          code: "BENCHMARK_PREFERENCES_SAVE_FAILED",
          details: saved.details,
        });
      }
      return json(200, {
        ok: true,
        preferences: normalized,
        updatedAt: saved.row?.updated_at || null,
      });
    }

    return json(200, {
      ok: true,
      preferences: normalized,
      updatedAt: existing.row.updated_at || null,
    });
  }

  const body = (await safeJsonParse(request)) || {};
  const normalized = normalizeBenchmarkPreferencesForStorage(body, {
    defaultStartDate: startDate,
    defaultEndDate: endDate,
  });

  const saved = await saveBenchmarkPreferencesRow(config, authToken, normalized, existing.row);
  if (saved.error) {
    return json(502, {
      error: saved.error,
      code: "BENCHMARK_PREFERENCES_SAVE_FAILED",
      details: saved.details,
    });
  }

  const persisted = normalizeBenchmarkPreferencesForStorage({
    modelTargets: saved.row?.model_targets ?? normalized.modelTargets,
    presets: saved.row?.presets ?? normalized.presets,
    selectedPresetId: saved.row?.selected_preset_id ?? normalized.selectedPresetId,
  }, {
    defaultStartDate: startDate,
    defaultEndDate: endDate,
  });

  return json(200, {
    ok: true,
    preferences: persisted,
    updatedAt: saved.row?.updated_at || null,
  });
};

const handleGetSession = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response> => {
  const url = new URL(request.url);
  const sessionIdentifier = (url.searchParams.get("session") || "").trim();

  if (!sessionIdentifier) {
    const params = new URLSearchParams();
    params.set("select", "id,share_token,name,flow,created_at,updated_at,deleted_at");
    params.set("order", "created_at.desc");
    params.set("limit", "25");

    const sessionsResponse = await supabaseFetch(
      config,
      authToken,
      `/rest/v1/ai_benchmark_sessions?${params.toString()}`,
      { method: "GET" },
    );

    if (!sessionsResponse.ok) {
      const details = await sessionsResponse.text();
      return json(502, {
        error: "Failed to load benchmark sessions",
        code: "BENCHMARK_LIST_FAILED",
        details: details.slice(0, 600),
      });
    }

    const sessions = await safeJsonParse(sessionsResponse);
    return json(200, {
      ok: true,
      sessions: Array.isArray(sessions) ? sessions : [],
    });
  }

  const session = isUuid(sessionIdentifier)
    ? await fetchSessionById(config, authToken, sessionIdentifier)
    : await fetchSessionByShareToken(config, authToken, sessionIdentifier);

  if (!session) {
    return json(404, {
      error: "Benchmark session not found",
      code: "BENCHMARK_SESSION_NOT_FOUND",
    });
  }

  const runs = await fetchRunsForSession(config, authToken, session.id);

  return json(200, {
    ok: true,
    session,
    runs,
    summary: summarizeRuns(runs),
  });
};

const handleExport = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response> => {
  const url = new URL(request.url);
  const runId = (url.searchParams.get("run") || "").trim();
  const sessionIdentifier = (url.searchParams.get("session") || "").trim();
  const includeLogsRaw = (url.searchParams.get("includeLogs") || "").trim().toLowerCase();
  const includeLogs = includeLogsRaw === "1" || includeLogsRaw === "true" || includeLogsRaw === "yes";

  if (runId) {
    const run = await fetchRunById(config, authToken, runId);
    if (!run) {
      return json(404, {
        error: "Benchmark run not found",
        code: "BENCHMARK_RUN_NOT_FOUND",
      });
    }

    const payload = {
      run,
      exportedAt: new Date().toISOString(),
    };

    return textResponse(
      200,
      JSON.stringify(payload, null, 2),
      {
        ...ZIP_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="benchmark-run-${run.id}.json"`,
      },
    );
  }

  if (!sessionIdentifier) {
    return json(400, {
      error: "Missing required query param: run or session",
      code: "BENCHMARK_EXPORT_INVALID",
    });
  }

  const session = isUuid(sessionIdentifier)
    ? await fetchSessionById(config, authToken, sessionIdentifier)
    : await fetchSessionByShareToken(config, authToken, sessionIdentifier);

  if (!session) {
    return json(404, {
      error: "Benchmark session not found",
      code: "BENCHMARK_SESSION_NOT_FOUND",
    });
  }

  const runs = await fetchRunsForSession(config, authToken, session.id);
  const files = runs.map((run) => {
    const payload = {
      session: {
        id: session.id,
        shareToken: session.share_token,
        name: session.name,
      },
      run,
      exportedAt: new Date().toISOString(),
    };

    return {
      name: formatRunFileName(run),
      content: JSON.stringify(payload, null, 2),
    };
  });

  if (includeLogs) {
    const scenarioPrompt = typeof (session.scenario as { prompt?: unknown })?.prompt === "string"
      ? String((session.scenario as { prompt?: unknown }).prompt || "")
      : "";

    files.push({
      name: "scenario.json",
      content: JSON.stringify(session.scenario || {}, null, 2),
    });

    if (scenarioPrompt.trim()) {
      files.push({
        name: "prompt.txt",
        content: scenarioPrompt,
      });
    }

    const logRows = runs.map((run) => ({
      runId: run.id,
      provider: run.provider,
      model: run.model,
      runIndex: run.run_index,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      latencyMs: run.latency_ms,
      schemaValid: run.schema_valid,
      validationErrors: run.validation_errors,
      usage: run.usage,
      costUsd: run.cost_usd,
      errorMessage: run.error_message,
      requestPayload: run.request_payload,
      rawOutput: run.raw_output,
      normalizedTrip: run.normalized_trip,
    }));

    const ndjson = logRows.map((entry) => JSON.stringify(entry)).join("\n");
    files.push({
      name: "logs/runs.ndjson",
      content: ndjson.length > 0 ? `${ndjson}\n` : "",
    });

    runs.forEach((run) => {
      files.push({
        name: `logs/${formatRunLogFileName(run)}`,
        content: JSON.stringify({
          runId: run.id,
          provider: run.provider,
          model: run.model,
          runIndex: run.run_index,
          status: run.status,
          startedAt: run.started_at,
          finishedAt: run.finished_at,
          latencyMs: run.latency_ms,
          schemaValid: run.schema_valid,
          validationChecks: run.validation_checks,
          validationErrors: run.validation_errors,
          usage: run.usage,
          costUsd: run.cost_usd,
          errorMessage: run.error_message,
          requestPayload: run.request_payload,
          rawOutput: run.raw_output,
          normalizedTrip: run.normalized_trip,
          tripId: run.trip_id,
          tripAiMeta: run.trip_ai_meta,
          exportedAt: new Date().toISOString(),
        }, null, 2),
      });
    });
  }

  const manifest = {
    session: {
      id: session.id,
      shareToken: session.share_token,
      name: session.name,
      flow: session.flow,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    },
    summary: summarizeRuns(runs),
    includeLogs,
    exportedAt: new Date().toISOString(),
    fileCount: files.length,
  };

  files.unshift({
    name: "manifest.json",
    content: JSON.stringify(manifest, null, 2),
  });

  const zipBytes = buildZipArchive(files);
  const fileBase = sanitizeFilenameSegment(session.name || session.id || "benchmark-session");

  return textResponse(
    200,
    zipBytes,
    {
      ...ZIP_HEADERS,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileBase}-exports.zip"`,
    },
  );
};

const handleCleanup = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const body = (await safeJsonParse(request)) || {};
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const mode = typeof body.mode === "string" ? body.mode.trim() : "both";

  if (!isUuid(sessionId)) {
    return json(400, {
      error: "Missing or invalid sessionId",
      code: "BENCHMARK_CLEANUP_INVALID_SESSION",
    });
  }

  const allowedModes = new Set(["delete-linked-trips", "delete-session-data", "both"]);
  if (!allowedModes.has(mode)) {
    return json(400, {
      error: "Invalid cleanup mode",
      code: "BENCHMARK_CLEANUP_INVALID_MODE",
    });
  }

  const deleted = {
    trips: 0,
    runs: 0,
    sessions: 0,
  };

  if (mode === "delete-linked-trips" || mode === "both") {
    const params = new URLSearchParams();
    params.set("source_kind", "eq.ai_benchmark");
    params.set("source_template_id", `eq.${sessionId}`);
    params.set("select", "id");

    const deleteTripsResponse = await supabaseFetch(
      config,
      authToken,
      `/rest/v1/trips?${params.toString()}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=representation",
        },
      },
    );

    if (!deleteTripsResponse.ok) {
      const details = await deleteTripsResponse.text();
      return json(502, {
        error: "Failed to delete benchmark-linked trips",
        code: "BENCHMARK_CLEANUP_TRIPS_FAILED",
        details: details.slice(0, 600),
      });
    }

    const deletedRows = await safeJsonParse(deleteTripsResponse);
    deleted.trips = Array.isArray(deletedRows) ? deletedRows.length : 0;
  }

  if (mode === "delete-session-data" || mode === "both") {
    const runParams = new URLSearchParams();
    runParams.set("session_id", `eq.${sessionId}`);
    runParams.set("select", "id");

    const deleteRunsResponse = await supabaseFetch(
      config,
      authToken,
      `/rest/v1/ai_benchmark_runs?${runParams.toString()}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=representation",
        },
      },
    );

    if (!deleteRunsResponse.ok) {
      const details = await deleteRunsResponse.text();
      return json(502, {
        error: "Failed to delete benchmark runs",
        code: "BENCHMARK_CLEANUP_RUNS_FAILED",
        details: details.slice(0, 600),
      });
    }

    const deletedRuns = await safeJsonParse(deleteRunsResponse);
    deleted.runs = Array.isArray(deletedRuns) ? deletedRuns.length : 0;

    const sessionParams = new URLSearchParams();
    sessionParams.set("id", `eq.${sessionId}`);
    sessionParams.set("select", "id");

    const deleteSessionResponse = await supabaseFetch(
      config,
      authToken,
      `/rest/v1/ai_benchmark_sessions?${sessionParams.toString()}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=representation",
        },
      },
    );

    if (!deleteSessionResponse.ok) {
      const details = await deleteSessionResponse.text();
      return json(502, {
        error: "Failed to delete benchmark session",
        code: "BENCHMARK_CLEANUP_SESSION_FAILED",
        details: details.slice(0, 600),
      });
    }

    const deletedSessions = await safeJsonParse(deleteSessionResponse);
    deleted.sessions = Array.isArray(deletedSessions) ? deletedSessions.length : 0;
  }

  return json(200, {
    ok: true,
    deleted,
    mode,
    sessionId,
  });
};

const handleRate = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const body = (await safeJsonParse(request)) || {};
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!isUuid(runId)) {
    return json(400, {
      error: "Missing or invalid runId",
      code: "BENCHMARK_RATE_INVALID_RUN_ID",
    });
  }

  const hasRatingField = Object.prototype.hasOwnProperty.call(body, "rating");
  if (!hasRatingField) {
    return json(400, {
      error: "Missing required field: rating",
      code: "BENCHMARK_RATE_INVALID_RATING",
    });
  }

  const rating = normalizeSatisfactionRating(body.rating);
  if (body.rating !== null && rating === null) {
    return json(400, {
      error: "Invalid rating. Allowed values: good, medium, bad, or null.",
      code: "BENCHMARK_RATE_INVALID_RATING",
    });
  }

  const existingRun = await fetchRunById(config, authToken, runId);
  if (!existingRun) {
    return json(404, {
      error: "Benchmark run not found",
      code: "BENCHMARK_RUN_NOT_FOUND",
    });
  }

  const updatedAt = new Date().toISOString();
  const updated = await updateRunRow(config, authToken, runId, {
    satisfaction_rating: rating,
    satisfaction_updated_at: rating ? updatedAt : null,
  });

  if (!updated) {
    return json(502, {
      error: "Failed to save benchmark run rating",
      code: "BENCHMARK_RATE_UPDATE_FAILED",
    });
  }

  const run = await fetchRunById(config, authToken, runId);
  if (!run) {
    return json(404, {
      error: "Benchmark run not found after update",
      code: "BENCHMARK_RUN_NOT_FOUND",
    });
  }

  return json(200, {
    ok: true,
    run,
  });
};

const buildCancelledRunPatch = (run: BenchmarkRunRow): Record<string, unknown> => {
  const nowIso = new Date().toISOString();
  const startedMs = run.started_at ? Date.parse(run.started_at) : NaN;
  const computedLatency = Number.isFinite(startedMs) ? Math.max(0, Date.now() - startedMs) : null;
  const existingLatency = typeof run.latency_ms === "number" ? run.latency_ms : null;

  return {
    status: "failed",
    finished_at: nowIso,
    latency_ms: existingLatency ?? computedLatency,
    error_message: CANCELLED_BY_USER_MESSAGE,
  };
};

const handleCancel = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  const body = (await safeJsonParse(request)) || {};
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  if (!runId && !sessionId) {
    return json(400, {
      error: "Missing runId or sessionId for cancellation",
      code: "BENCHMARK_CANCEL_INVALID_TARGET",
    });
  }

  let targetSessionId = sessionId;
  const runsToCancel: BenchmarkRunRow[] = [];

  if (runId) {
    if (!isUuid(runId)) {
      return json(400, {
        error: "Invalid runId",
        code: "BENCHMARK_CANCEL_INVALID_RUN_ID",
      });
    }
    const run = await fetchRunById(config, authToken, runId);
    if (!run) {
      return json(404, {
        error: "Benchmark run not found",
        code: "BENCHMARK_RUN_NOT_FOUND",
      });
    }
    targetSessionId = run.session_id;
    if (isRunActive(run) && !isRunCancelled(run)) {
      runsToCancel.push(run);
    }
  } else {
    if (!isUuid(sessionId)) {
      return json(400, {
        error: "Invalid sessionId",
        code: "BENCHMARK_CANCEL_INVALID_SESSION_ID",
      });
    }
    const runs = await fetchRunsForSession(config, authToken, sessionId);
    runs.forEach((run) => {
      if (isRunActive(run) && !isRunCancelled(run)) {
        runsToCancel.push(run);
      }
    });
  }

  const cancelResults = await Promise.all(
    runsToCancel.map((run) => updateRunRow(config, authToken, run.id, buildCancelledRunPatch(run))),
  );

  const cancelledCount = cancelResults.filter(Boolean).length;

  if (!targetSessionId || !isUuid(targetSessionId)) {
    return json(200, {
      ok: true,
      cancelled: cancelledCount,
      runs: [],
      summary: summarizeRuns([]),
    });
  }

  const session = await fetchSessionById(config, authToken, targetSessionId);
  const runs = await fetchRunsForSession(config, authToken, targetSessionId);
  return json(200, {
    ok: true,
    cancelled: cancelledCount,
    session,
    runs,
    summary: summarizeRuns(runs),
  });
};

const handleRun = async (
  request: Request,
  config: { url: string; anonKey: string },
  authToken: string,
  context?: EdgeContextLike,
): Promise<Response> => {
  const body = (await safeJsonParse(request)) as BenchmarkRequestBody | null;
  if (!body || typeof body !== "object") {
    return json(400, {
      error: "Invalid JSON body",
      code: "BENCHMARK_INVALID_BODY",
    });
  }

  const flow = body.flow === "wizard" || body.flow === "surprise" ? body.flow : "classic";
  const scenario = normalizeScenario(body.scenario);
  if (!scenario) {
    return json(400, {
      error: "Missing or invalid scenario. Expected { prompt: string, startDate?: YYYY-MM-DD, roundTrip?: boolean }",
      code: "BENCHMARK_INVALID_SCENARIO",
    });
  }

  const requestedTargets = Array.isArray(body.targets) ? body.targets : [];
  const targets = requestedTargets.map(normalizeTarget).filter((target): target is BenchmarkTarget => Boolean(target));

  if (targets.length === 0) {
    return json(400, {
      error: "No valid targets provided",
      code: "BENCHMARK_INVALID_TARGETS",
    });
  }

  const runCountRaw = Number(body.runCount);
  const runCount = Number.isFinite(runCountRaw) ? clampNumber(Math.round(runCountRaw), 1, MAX_RUN_COUNT) : 1;

  const concurrencyRaw = Number(body.concurrency);
  const concurrency = Number.isFinite(concurrencyRaw)
    ? clampNumber(Math.round(concurrencyRaw), 1, MAX_CONCURRENCY)
    : Math.min(5, MAX_CONCURRENCY);

  let session: BenchmarkSessionRow | null = null;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

  if (sessionId) {
    if (!isUuid(sessionId)) {
      return json(400, {
        error: "Invalid sessionId",
        code: "BENCHMARK_INVALID_SESSION_ID",
      });
    }
    session = await fetchSessionById(config, authToken, sessionId);
    if (!session) {
      return json(404, {
        error: "Benchmark session not found",
        code: "BENCHMARK_SESSION_NOT_FOUND",
      });
    }
  } else {
    const created = await createSession(config, authToken, {
      name: typeof body.sessionName === "string" ? body.sessionName.trim() : undefined,
      flow,
      scenario,
    });

    if (!created.session) {
      return json(502, {
        error: created.error || "Failed to create benchmark session",
        code: "BENCHMARK_SESSION_CREATE_FAILED",
      });
    }

    session = created.session;
  }

  const existingRuns = await fetchRunsForSession(config, authToken, session.id);
  const seedByTarget = new Map<string, number>();

  const runInserts: Array<Record<string, unknown>> = [];
  targets.forEach((target) => {
    const key = `${target.provider}::${target.model}`;
    const existingIndex = seedByTarget.get(key) ?? findExistingRunIndex(existingRuns, target);

    for (let i = 1; i <= runCount; i += 1) {
      runInserts.push({
        session_id: session.id,
        provider: target.provider,
        model: target.model,
        label: target.label || `${target.provider}:${target.model}`,
        run_index: existingIndex + i,
        status: "queued",
        request_payload: {
          scenario,
          target,
        },
      });
    }

    seedByTarget.set(key, existingIndex + runCount);
  });

  const createdRuns = await createRunRows(config, authToken, runInserts);
  if (!createdRuns.rows.length) {
    return json(502, {
      error: createdRuns.error || "Failed to queue benchmark runs",
      code: "BENCHMARK_RUN_CREATE_FAILED",
    });
  }

  const executePromise = runWithConcurrency(
    request,
    createdRuns.rows,
    scenario,
    config,
    authToken,
    session.id,
    concurrency,
  ).catch(async (error) => {
    const fallbackMessage = error instanceof Error ? error.message : "Background benchmark execution failed";
    await Promise.all(
      createdRuns.rows.map((row) => updateRunRow(config, authToken, row.id, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: fallbackMessage,
      })),
    );
  });

  if (typeof context?.waitUntil === "function") {
    context.waitUntil(executePromise);
    const queuedRuns = await fetchRunsForSession(config, authToken, session.id);
    return json(202, {
      ok: true,
      async: true,
      session,
      runs: queuedRuns,
      summary: summarizeRuns(queuedRuns),
    });
  }

  await executePromise;
  const runs = await fetchRunsForSession(config, authToken, session.id);
  return json(200, {
    ok: true,
    async: false,
    session,
    runs,
    summary: summarizeRuns(runs),
  });
};

export default async (request: Request, context?: EdgeContextLike) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, {
      error: "Missing Authorization bearer token.",
      code: "AUTH_TOKEN_MISSING",
    });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return json(503, {
      error: "Supabase edge config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
      code: "SUPABASE_CONFIG_MISSING",
    });
  }

  const authError = await authorizeInternalRequest(request, config, authToken);
  if (authError) return authError;

  const pathname = new URL(request.url).pathname;

  try {
    if (pathname.endsWith("/preferences")) {
      return await handlePreferences(request, config, authToken);
    }

    if (pathname.endsWith("/export")) {
      if (request.method !== "GET") {
        return json(405, { error: "Method not allowed. Use GET." });
      }
      return await handleExport(request, config, authToken);
    }

    if (pathname.endsWith("/telemetry")) {
      if (request.method !== "GET") {
        return json(405, { error: "Method not allowed. Use GET." });
      }
      return await handleTelemetry(request, config);
    }

    if (pathname.endsWith("/cleanup")) {
      return await handleCleanup(request, config, authToken);
    }

    if (pathname.endsWith("/rating")) {
      return await handleRate(request, config, authToken);
    }

    if (pathname.endsWith("/cancel")) {
      return await handleCancel(request, config, authToken);
    }

    if (request.method === "GET") {
      return await handleGetSession(request, config, authToken);
    }

    if (request.method === "POST") {
      return await handleRun(request, config, authToken, context);
    }

    return json(405, { error: "Method not allowed." });
  } catch (error) {
    return json(500, {
      error: "Unexpected benchmark API error",
      code: "BENCHMARK_UNEXPECTED_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
