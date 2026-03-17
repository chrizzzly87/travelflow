import { parseFlexibleDurationDays, parseFlexibleDurationHours } from "../../shared/durationParsing.ts";
import { normalizeTransportMode } from "../../shared/transportModes.ts";
import { validateModelData } from "../../shared/aiBenchmarkValidation.ts";
import {
  buildAiRuntimeSecurityInputFromTripInputSnapshot,
  evaluateAiRuntimeInputSecurity,
  detectAiRuntimeOutputSecurity,
  summarizeAiRuntimeSecuritySignals,
} from "../../shared/aiRuntimeSecurity.ts";
import {
  generateProviderItinerary,
  resolveTimeoutMs,
} from "../edge-lib/ai-provider-runtime.ts";
import { persistAiGenerationTelemetry } from "../edge-lib/ai-generation-telemetry.ts";

interface WorkerJobRow {
  id: string;
  trip_id: string;
  owner_id: string;
  attempt_id: string;
  state: "queued" | "leased" | "completed" | "failed" | "dead";
  priority: number;
  retry_count: number;
  max_retries: number;
  run_after: string;
  payload: Record<string, unknown> | null;
}

interface WorkerTripRow {
  id: string;
  owner_id: string;
  title: string | null;
  start_date: string | null;
  data: Record<string, unknown> | null;
  view_settings: Record<string, unknown> | null;
  status: string | null;
  trip_expires_at: string | null;
  source_kind: string | null;
}

interface WorkerJobPayload {
  version: number;
  flow: "classic" | "wizard" | "surprise";
  source: string;
  requestId: string;
  queueRequestId: string | null;
  tripId: string;
  attemptId: string;
  startedAt: string | null;
  startDate: string;
  roundTrip: boolean;
  prompt: string;
  target: {
    provider: string;
    model: string;
  };
  inputSnapshot?: Record<string, unknown> | null;
}

interface ProviderFailure {
  error: string;
  code: string;
  details?: string;
  sample?: string;
  model?: string;
  providerModel?: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const WORKER_HEADER = "x-tf-admin-key";
const WORKER_SOURCE = "queue_claim_async_worker";
const DEFAULT_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-5.4";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ATTEMPT_HISTORY = 12;
const MAX_JOB_BATCH = 10;
// Actual provider execution now runs in the background function runtime, so the
// worker timeout can be long enough for slower models without colliding with the
// edge response deadline.
const WORKER_PROVIDER_TIMEOUT_MS = resolveTimeoutMs("AI_GENERATION_ASYNC_PROVIDER_TIMEOUT_MS", 120_000, 20_000, 180_000);
const WORKER_LEASE_SECONDS = Math.max(45, Math.min(180, Math.ceil((WORKER_PROVIDER_TIMEOUT_MS + 15_000) / 1_000)));
const BACKGROUND_DISPATCH_TIMEOUT_MS = 10_000;
const GENERIC_SECURITY_BLOCK_MESSAGE = "Trip request could not be processed safely. Please revise the request and try again.";
const GENERIC_OUTPUT_BLOCK_MESSAGE = "Trip generation returned an invalid response. Please try again.";

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
const TRAVEL_COLOR = "bg-stone-800 border-stone-600 text-stone-100";
const ACTIVITY_TYPE_COLOR: Record<string, string> = {
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

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const readEnv = (name: string): string => {
  try {
    const denoValue = (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name);
    if (typeof denoValue === "string" && denoValue.length > 0) {
      return denoValue;
    }
  } catch {
    // noop
  }
  try {
    const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const nodeValue = nodeEnv?.[name];
    return typeof nodeValue === "string" ? nodeValue : "";
  } catch {
    return "";
  }
};

const isEnabledFlag = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
};

const getServiceConfig = () => {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
};

const buildServiceHeaders = (token: string) => ({
  "Content-Type": "application/json",
  apikey: token,
  Authorization: `Bearer ${token}`,
});

const serviceFetch = async (
  config: { url: string; serviceRoleKey: string },
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildServiceHeaders(config.serviceRoleKey),
      ...(init.headers || {}),
    },
  });
};

const safeJsonParse = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token ? token : null;
};

interface WorkerAuthorizationDiagnostics {
  hasConfiguredAdminKey: boolean;
  configuredAdminKeyLength: number;
  providedAdminKeyLength: number;
  hasAuthorizationHeader: boolean;
  bearerUserResolved: boolean;
}

const resolveAuthenticatedWorkerUserId = async (
  config: { url: string; serviceRoleKey: string },
  authorizationHeader: string | null,
): Promise<string | null> => {
  const token = extractBearerToken(authorizationHeader);
  if (!token) return null;
  const response = await serviceFetch(config, "/auth/v1/user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const payload = await safeJsonParse(response);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const idValue = (payload as Record<string, unknown>).id;
  return typeof idValue === "string" && idValue.trim().length > 0
    ? idValue.trim()
    : null;
};

export const extractRpcErrorMessage = async (
  response: Response,
  fallbackMessage: string,
): Promise<string> => {
  const payload = await safeJsonParse(response);
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = asString(record.message) || asString(record.error);
    if (message) return message;
  }
  return fallbackMessage;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asIsoMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isTerminalAttemptState = (state: string | null | undefined): boolean => (
  state === "failed" || state === "succeeded"
);

const isInFlightAttemptState = (state: string | null | undefined): boolean => (
  state === "queued" || state === "running"
);

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const isWorkerEnabled = (): boolean => isEnabledFlag(readEnv("AI_GENERATION_ASYNC_WORKER_ENABLED"));

const classifyFailureKind = (params: {
  code?: string | null;
  status?: number | null;
  message: string;
}): "timeout" | "abort" | "quality" | "provider" | "network" | "unknown" => {
  const code = (params.code || "").toLowerCase();
  const message = (params.message || "").toLowerCase();
  if (params.status === 408 || params.status === 504 || code.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (code.includes("abort") || message.includes("abort")) {
    return "abort";
  }
  if (code.includes("parse") || code.includes("quality") || message.includes("quality")) {
    return "quality";
  }
  if (
    code.includes("provider")
    || code.includes("model_not_allowed")
    || code.includes("key_missing")
    || code.includes("request_failed")
  ) {
    return "provider";
  }
  if (code.includes("network") || message.includes("network") || message.includes("failed to fetch")) {
    return "network";
  }
  return "unknown";
};

const toIsoDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const normalizeCityName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");
const getCityColor = (index: number): string => CITY_COLORS[index % CITY_COLORS.length];

const normalizeActivityTypes = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter(Boolean);
  if (normalized.length === 0) return ["general"];
  return Array.from(new Set(normalized)).slice(0, 3);
};

const getActivityColor = (types: string[]): string => {
  for (const type of types) {
    if (ACTIVITY_TYPE_COLOR[type]) return ACTIVITY_TYPE_COLOR[type];
  }
  return ACTIVITY_TYPE_COLOR.general;
};

const normalizeCityColors = (items: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
  let cityIndex = 0;
  return items.map((item) => {
    if (item.type !== "city") return item;
    const color = getCityColor(cityIndex);
    cityIndex += 1;
    return { ...item, color };
  });
};

const buildTripFromModelData = (
  data: Record<string, unknown>,
  params: {
    tripId: string;
    startDate: string;
    roundTrip: boolean;
    provider: string;
    model: string;
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

  if (params.roundTrip && parsedCities.length > 0) {
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
        const cityIndexRaw = Number(typed.cityIndex);
        if (!Number.isFinite(cityIndexRaw) || cityIndexRaw !== city.sourceIndex) return;
        const dayOffsetInCityRaw = Number(typed.dayOffsetInCity);
        const dayOffsetInCity = Number.isFinite(dayOffsetInCityRaw) ? dayOffsetInCityRaw : 0;
        const durationRaw = Number(typed.duration);
        const parsedDays = parseFlexibleDurationDays(typed.duration);
        const activityDuration = Number.isFinite(parsedDays) && (parsedDays as number) > 0
          ? (parsedDays as number)
          : (Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 1);
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
  return {
    id: params.tripId,
    title: String(data.tripTitle || "My Trip"),
    startDate: params.startDate,
    items: normalizeCityColors(items),
    countryInfo: data.countryInfo ?? undefined,
    createdAt: now,
    updatedAt: now,
    roundTrip: params.roundTrip ? true : undefined,
    aiMeta: {
      provider: params.provider,
      model: params.model,
      generatedAt: new Date(now).toISOString(),
    },
  };
};

const mergeAttempts = (
  previous: unknown,
  nextAttempt: Record<string, unknown>,
): Record<string, unknown>[] => {
  const attempts = Array.isArray(previous) ? previous.filter((entry) => entry && typeof entry === "object") as Record<string, unknown>[] : [];
  const nextId = asString(nextAttempt.id);
  const replaced = attempts.map((entry) => {
    const entryId = asString(entry.id);
    if (nextId && entryId === nextId) return nextAttempt;
    return entry;
  });
  if (!nextId || !replaced.some((entry) => asString(entry.id) === nextId)) {
    replaced.unshift(nextAttempt);
  }
  return replaced.slice(0, MAX_ATTEMPT_HISTORY);
};

const applyFailedGenerationState = (
  trip: Record<string, unknown>,
  params: {
    flow: "classic" | "wizard" | "surprise";
    attemptId: string;
    requestId: string;
    provider: string;
    model: string;
    providerModel: string | null;
    statusCode: number | null;
    failureKind: string;
    errorCode: string | null;
    errorMessage: string;
    durationMs: number | null;
    metadata?: Record<string, unknown> | null;
  },
): Record<string, unknown> => {
  const nowIso = new Date().toISOString();
  const aiMeta = asObject(trip.aiMeta) || {};
  const generation = asObject(aiMeta.generation) || {};
  const latestBefore = asObject(generation.latestAttempt) || {};

  const attempt: Record<string, unknown> = {
    ...latestBefore,
    id: params.attemptId,
    flow: asString(latestBefore.flow) || params.flow,
    source: asString(latestBefore.source) || WORKER_SOURCE,
    state: "failed",
    startedAt: asString(latestBefore.startedAt) || new Date(Date.now() - Math.max(params.durationMs || 0, 0)).toISOString(),
    finishedAt: nowIso,
    durationMs: params.durationMs,
    requestId: params.requestId,
    provider: params.provider,
    model: params.model,
    providerModel: params.providerModel,
    statusCode: params.statusCode,
    failureKind: params.failureKind,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    metadata: params.metadata || null,
  };

  const items = Array.isArray(trip.items)
    ? trip.items.map((item) => {
      if (!item || typeof item !== "object") return item;
      const typed = item as Record<string, unknown>;
      if (!typed.loading) return item;
      return {
        ...typed,
        loading: false,
      };
    })
    : trip.items;

  return {
    ...trip,
    items,
    updatedAt: Date.now(),
    aiMeta: {
      ...aiMeta,
      provider: params.provider,
      model: params.model,
      generatedAt: asString(aiMeta.generatedAt) || nowIso,
      generation: {
        ...generation,
        state: "failed",
        latestAttempt: attempt,
        attempts: mergeAttempts(generation.attempts, attempt),
        inputSnapshot: generation.inputSnapshot ?? null,
        retryCount: Number.isFinite(Number(generation.retryCount)) ? Number(generation.retryCount) : 0,
        retryRequestedAt: generation.retryRequestedAt ?? null,
        lastSucceededAt: generation.lastSucceededAt ?? null,
        lastFailedAt: nowIso,
      },
    },
  };
};

const applySucceededGenerationState = (
  previousTrip: Record<string, unknown>,
  generatedTrip: Record<string, unknown>,
  params: {
    flow: "classic" | "wizard" | "surprise";
    attemptId: string;
    requestId: string;
    provider: string;
    model: string;
    providerModel: string | null;
    durationMs: number;
    statusCode: number;
    metadata?: Record<string, unknown> | null;
  },
): Record<string, unknown> => {
  const nowIso = new Date().toISOString();
  const previousAiMeta = asObject(previousTrip.aiMeta) || {};
  const previousGeneration = asObject(previousAiMeta.generation) || {};
  const latestBefore = asObject(previousGeneration.latestAttempt) || {};

  const attempt: Record<string, unknown> = {
    ...latestBefore,
    id: params.attemptId,
    flow: asString(latestBefore.flow) || params.flow,
    source: asString(latestBefore.source) || WORKER_SOURCE,
    state: "succeeded",
    startedAt: asString(latestBefore.startedAt) || new Date(Date.now() - Math.max(params.durationMs, 0)).toISOString(),
    finishedAt: nowIso,
    durationMs: params.durationMs,
    requestId: params.requestId,
    provider: params.provider,
    model: params.model,
    providerModel: params.providerModel,
    statusCode: params.statusCode,
    failureKind: null,
    errorCode: null,
    errorMessage: null,
    metadata: params.metadata || null,
  };

  const generatedAiMeta = asObject(generatedTrip.aiMeta) || {};
  const preferredCityColorPaletteId = asString(previousTrip.cityColorPaletteId) || asString(generatedTrip.cityColorPaletteId);
  const preferredMapColorMode = asString(previousTrip.mapColorMode) || asString(generatedTrip.mapColorMode);
  const mergedTrip = {
    ...previousTrip,
    ...generatedTrip,
    id: previousTrip.id || generatedTrip.id,
    createdAt: Number(previousTrip.createdAt) || Number(generatedTrip.createdAt) || Date.now(),
    updatedAt: Date.now(),
    sourceKind: asString(previousTrip.sourceKind) || asString(generatedTrip.sourceKind) || "created",
    status: asString(previousTrip.status) || asString(generatedTrip.status) || "active",
    tripExpiresAt: previousTrip.tripExpiresAt ?? generatedTrip.tripExpiresAt ?? null,
    isFavorite: Boolean(previousTrip.isFavorite ?? generatedTrip.isFavorite),
  };
  if (preferredCityColorPaletteId) {
    mergedTrip.cityColorPaletteId = preferredCityColorPaletteId;
  }
  if (preferredMapColorMode) {
    mergedTrip.mapColorMode = preferredMapColorMode;
  }

  return {
    ...mergedTrip,
    aiMeta: {
      ...generatedAiMeta,
      ...previousAiMeta,
      provider: params.provider,
      model: params.model,
      generatedAt: nowIso,
      generation: {
        ...previousGeneration,
        state: "succeeded",
        latestAttempt: attempt,
        attempts: mergeAttempts(previousGeneration.attempts, attempt),
        inputSnapshot: previousGeneration.inputSnapshot ?? null,
        retryCount: Number.isFinite(Number(previousGeneration.retryCount)) ? Number(previousGeneration.retryCount) : 0,
        retryRequestedAt: previousGeneration.retryRequestedAt ?? null,
        lastSucceededAt: nowIso,
        lastFailedAt: previousGeneration.lastFailedAt ?? null,
      },
    },
  };
};

const parseWorkerPayload = (payload: unknown): WorkerJobPayload | null => {
  const record = asObject(payload);
  if (!record) return null;
  const version = asNumber(record.version, 0);
  const flow = asString(record.flow);
  const requestId = asString(record.requestId);
  const tripId = asString(record.tripId);
  const attemptId = asString(record.attemptId);
  const startedAt = asString(record.startedAt);
  const startDate = asString(record.startDate);
  const prompt = asString(record.prompt);
  const source = asString(record.source) || WORKER_SOURCE;
  const target = asObject(record.target);
  const inputSnapshot = asObject(record.inputSnapshot);
  const provider = asString(target?.provider) || DEFAULT_PROVIDER;
  const model = asString(target?.model) || DEFAULT_MODEL;
  const queueRequestIdRaw = asString(record.queueRequestId);
  const queueRequestId = queueRequestIdRaw && UUID_REGEX.test(queueRequestIdRaw) ? queueRequestIdRaw : null;
  const normalizedFlow = flow === "classic" || flow === "wizard" || flow === "surprise"
    ? flow
    : null;
  if (version < 1 || !normalizedFlow || !requestId || !tripId || !attemptId || !startDate || !prompt) return null;
  return {
    version,
    flow: normalizedFlow,
    source,
    requestId,
    queueRequestId,
    tripId,
    attemptId,
    startedAt,
    startDate,
    roundTrip: Boolean(record.roundTrip),
    prompt,
    inputSnapshot,
    target: {
      provider,
      model,
    },
  };
};

const parseWorkerJobRow = (value: unknown): WorkerJobRow | null => {
  const row = asObject(value);
  if (!row) return null;
  const id = asString(row.id);
  const tripId = asString(row.trip_id);
  const ownerId = asString(row.owner_id);
  const attemptId = asString(row.attempt_id);
  const state = asString(row.state) as WorkerJobRow["state"] | null;
  const runAfter = asString(row.run_after);
  if (!id || !tripId || !ownerId || !attemptId || !state || !runAfter) return null;
  if (!["queued", "leased", "completed", "failed", "dead"].includes(state)) return null;
  return {
    id,
    trip_id: tripId,
    owner_id: ownerId,
    attempt_id: attemptId,
    state,
    priority: asNumber(row.priority, 100),
    retry_count: Math.max(0, asNumber(row.retry_count, 0)),
    max_retries: Math.max(0, asNumber(row.max_retries, 0)),
    run_after: runAfter,
    payload: asObject(row.payload),
  };
};

interface WorkerAttemptStateRow {
  id: string;
  state: string | null;
  startedAt: string | null;
}

const readAttemptStateRows = async (
  config: { url: string; serviceRoleKey: string },
  attemptIds: string[],
): Promise<Map<string, WorkerAttemptStateRow>> => {
  const uniqueAttemptIds = Array.from(new Set(
    attemptIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  ));
  if (uniqueAttemptIds.length === 0) return new Map();

  const endpoint = `/rest/v1/trip_generation_attempts?select=id,state,started_at&id=in.(${uniqueAttemptIds.join(",")})&limit=${uniqueAttemptIds.length}`;
  const response = await serviceFetch(config, endpoint, {
    method: "GET",
  });
  if (!response.ok) return new Map();

  const payload = await safeJsonParse(response);
  const rows = Array.isArray(payload) ? payload : [];
  const mapped = new Map<string, WorkerAttemptStateRow>();
  rows.forEach((entry) => {
    const row = asObject(entry);
    if (!row) return;
    const id = asString(row.id);
    if (!id) return;
    mapped.set(id, {
      id,
      state: asString(row.state),
      startedAt: asString(row.started_at),
    });
  });
  return mapped;
};

export const decideSupersededByAttemptOrdering = (params: {
  payloadState: string | null;
  latestState: string | null;
  payloadStartedAt: string | null;
  latestStartedAt: string | null;
}): boolean => {
  if (isTerminalAttemptState(params.latestState) && isInFlightAttemptState(params.payloadState)) {
    return false;
  }
  if (isTerminalAttemptState(params.payloadState) && isInFlightAttemptState(params.latestState)) {
    return true;
  }
  if (isInFlightAttemptState(params.latestState) && !isInFlightAttemptState(params.payloadState)) {
    return true;
  }

  const payloadStartedAtMs = asIsoMs(params.payloadStartedAt);
  const latestStartedAtMs = asIsoMs(params.latestStartedAt);
  if (payloadStartedAtMs !== null && latestStartedAtMs !== null) {
    return latestStartedAtMs > payloadStartedAtMs;
  }
  if (latestStartedAtMs !== null && payloadStartedAtMs === null) {
    return true;
  }
  if (payloadStartedAtMs !== null && latestStartedAtMs === null) {
    return false;
  }

  // Conservative fallback: when there is no ordering signal, treat the payload as outdated.
  return true;
};

const shouldSupersedePayloadAttempt = async (
  config: { url: string; serviceRoleKey: string },
  params: {
    payloadAttemptId: string;
    payloadStartedAt: string | null;
    tripLatestAttemptId: string | null;
    tripLatestStartedAt: string | null;
  },
): Promise<boolean> => {
  const latestAttemptId = params.tripLatestAttemptId;
  if (!latestAttemptId) return false;
  if (latestAttemptId === params.payloadAttemptId) return false;

  const attemptRows = await readAttemptStateRows(config, [
    params.payloadAttemptId,
    latestAttemptId,
  ]);
  const payloadAttempt = attemptRows.get(params.payloadAttemptId) || null;
  const latestAttempt = attemptRows.get(latestAttemptId) || null;

  return decideSupersededByAttemptOrdering({
    payloadState: payloadAttempt?.state || null,
    latestState: latestAttempt?.state || null,
    payloadStartedAt: payloadAttempt?.startedAt || params.payloadStartedAt,
    latestStartedAt: latestAttempt?.startedAt || params.tripLatestStartedAt,
  });
};

const readTripRow = async (
  config: { url: string; serviceRoleKey: string },
  tripId: string,
): Promise<WorkerTripRow | null> => {
  const endpoint = `/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=id,owner_id,title,start_date,data,view_settings,status,trip_expires_at,source_kind&limit=1`;
  const response = await serviceFetch(config, endpoint, {
    method: "GET",
  });
  if (!response.ok) return null;
  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? payload[0] : null;
  if (!row || typeof row !== "object") return null;
  return {
    id: asString((row as Record<string, unknown>).id) || "",
    owner_id: asString((row as Record<string, unknown>).owner_id) || "",
    title: asString((row as Record<string, unknown>).title),
    start_date: asString((row as Record<string, unknown>).start_date),
    data: asObject((row as Record<string, unknown>).data),
    view_settings: asObject((row as Record<string, unknown>).view_settings),
    status: asString((row as Record<string, unknown>).status),
    trip_expires_at: asString((row as Record<string, unknown>).trip_expires_at),
    source_kind: asString((row as Record<string, unknown>).source_kind),
  };
};

const upsertTripRow = async (
  config: { url: string; serviceRoleKey: string },
  trip: Record<string, unknown>,
  ownerId: string,
): Promise<boolean> => {
  const tripId = asString(trip.id);
  if (!tripId) return false;
  const title = asString(trip.title) || "Untitled trip";
  const startDate = asString(trip.startDate) || new Date().toISOString();
  const status = asString(trip.status) || "active";
  const sourceKind = asString(trip.sourceKind) || "created";
  const payload = {
    id: tripId,
    owner_id: ownerId,
    title,
    start_date: toIsoDate(startDate),
    data: trip,
    view_settings: null,
    is_favorite: Boolean(trip.isFavorite),
    status,
    trip_expires_at: trip.tripExpiresAt ?? null,
    source_kind: sourceKind,
  };

  const response = await serviceFetch(config, "/rest/v1/trips?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });
  if (response.ok) return true;
  const errorMessage = await extractRpcErrorMessage(response, "trip upsert failed");
  console.error("[ai-generate-worker] trip upsert failed", {
    tripId,
    status: response.status,
    error: errorMessage,
  });
  return false;
};

const insertTripVersion = async (
  config: { url: string; serviceRoleKey: string },
  tripId: string,
  trip: Record<string, unknown>,
  label: string,
): Promise<boolean> => {
  const response = await serviceFetch(config, "/rest/v1/trip_versions", {
    method: "POST",
    body: JSON.stringify({
      trip_id: tripId,
      data: trip,
      view_settings: null,
      label,
    }),
  });
  if (response.ok) return true;
  const errorMessage = await extractRpcErrorMessage(response, "trip version insert failed");
  console.error("[ai-generate-worker] trip version insert failed", {
    tripId,
    label,
    status: response.status,
    error: errorMessage,
  });
  return false;
};

const finishAttempt = async (
  config: { url: string; serviceRoleKey: string },
  payload: Record<string, unknown>,
): Promise<boolean> => {
  const response = await serviceFetch(config, "/rest/v1/rpc/trip_generation_attempt_finish", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify(payload),
  });
  if (response.ok) return true;
  const errorMessage = await extractRpcErrorMessage(response, "trip_generation_attempt_finish failed");
  console.error("[ai-generate-worker] trip_generation_attempt_finish failed", {
    status: response.status,
    error: errorMessage,
  });
  return false;
};

const completeJob = async (
  config: { url: string; serviceRoleKey: string },
  jobId: string,
  workerId: string,
): Promise<boolean> => {
  const response = await serviceFetch(config, "/rest/v1/rpc/trip_generation_job_complete", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_job_id: jobId,
      p_worker_id: workerId,
    }),
  });
  if (response.ok) return true;
  const errorMessage = await extractRpcErrorMessage(response, "trip_generation_job_complete failed");
  console.error("[ai-generate-worker] trip_generation_job_complete failed", {
    jobId,
    workerId,
    status: response.status,
    error: errorMessage,
  });
  return false;
};

const failJob = async (
  config: { url: string; serviceRoleKey: string },
  payload: {
    jobId: string;
    workerId: string;
    errorCode: string | null;
    errorMessage: string;
    terminal?: boolean;
  },
): Promise<boolean> => {
  const response = await serviceFetch(config, "/rest/v1/rpc/trip_generation_job_fail", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_job_id: payload.jobId,
      p_worker_id: payload.workerId,
      p_error_code: payload.errorCode,
      p_error_message: payload.errorMessage.slice(0, 1200),
      p_retry_delay_seconds: 15,
      p_terminal: payload.terminal ?? true,
    }),
  });
  if (response.ok) return true;
  const errorMessage = await extractRpcErrorMessage(response, "trip_generation_job_fail failed");
  console.error("[ai-generate-worker] trip_generation_job_fail failed", {
    jobId: payload.jobId,
    workerId: payload.workerId,
    status: response.status,
    error: errorMessage,
  });
  return false;
};

const patchQueueRequest = async (
  config: { url: string; serviceRoleKey: string },
  params: {
    requestId: string | null;
    ownerId: string;
    patch: Record<string, unknown>;
  },
): Promise<void> => {
  if (!params.requestId) return;
  const endpoint = `/rest/v1/trip_generation_requests?id=eq.${encodeURIComponent(params.requestId)}&owner_user_id=eq.${encodeURIComponent(params.ownerId)}`;
  await serviceFetch(config, endpoint, {
    method: "PATCH",
    body: JSON.stringify(params.patch),
  });
};

const requeueExpiredLeasedJobs = async (
  config: { url: string; serviceRoleKey: string },
): Promise<void> => {
  const cutoffIso = new Date().toISOString();
  const endpoint = `/rest/v1/trip_generation_jobs?state=eq.leased&lease_expires_at=lte.${encodeURIComponent(cutoffIso)}`;
  const response = await serviceFetch(config, endpoint, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      state: "queued",
      leased_by: null,
      lease_expires_at: null,
      updated_at: cutoffIso,
    }),
  });
  if (response.ok) return;
  const errorMessage = await extractRpcErrorMessage(response, "Requeue expired leased jobs failed");
  console.error("[ai-generate-worker] requeue expired leased jobs failed", {
    status: response.status,
    error: errorMessage,
  });
};

const claimJobs = async (
  config: { url: string; serviceRoleKey: string },
  workerId: string,
  limit: number,
): Promise<{
  jobs: WorkerJobRow[];
  error: {
    status: number;
    message: string;
  } | null;
}> => {
  const response = await serviceFetch(config, "/rest/v1/rpc/trip_generation_job_claim", {
    method: "POST",
    headers: {
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_worker_id: workerId,
      p_limit: Math.max(1, Math.min(limit, MAX_JOB_BATCH)),
      p_lease_seconds: WORKER_LEASE_SECONDS,
    }),
  });

  if (!response.ok) {
    const errorMessage = await extractRpcErrorMessage(response, "trip_generation_job_claim failed");
    return {
      jobs: [],
      error: {
        status: response.status,
        message: errorMessage,
      },
    };
  }
  const payload = await safeJsonParse(response);
  const rows = Array.isArray(payload) ? payload : [];
  return {
    jobs: rows
    .map((entry) => parseWorkerJobRow(entry))
    .filter((entry): entry is WorkerJobRow => Boolean(entry)),
    error: null,
  };
};

const ensureWorkerAuthorized = async (
  request: Request,
  config: { url: string; serviceRoleKey: string },
): Promise<{
  authorized: boolean;
  mode: "admin" | "user" | "none";
  userId: string | null;
  diagnostics: WorkerAuthorizationDiagnostics;
}> => {
  const expected = readEnv("TF_ADMIN_API_KEY").trim();
  const provided = request.headers.get(WORKER_HEADER)?.trim() || "";
  const diagnosticsBase = {
    hasConfiguredAdminKey: expected.length > 0,
    configuredAdminKeyLength: expected.length,
    providedAdminKeyLength: provided.length,
    hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
  };
  if (expected && provided && expected === provided) {
    return {
      authorized: true,
      mode: "admin",
      userId: null,
      diagnostics: {
        ...diagnosticsBase,
        bearerUserResolved: false,
      },
    };
  }

  const userId = await resolveAuthenticatedWorkerUserId(config, request.headers.get("authorization"));
  if (userId) {
    return {
      authorized: true,
      mode: "user",
      userId,
      diagnostics: {
        ...diagnosticsBase,
        bearerUserResolved: true,
      },
    };
  }

  return {
    authorized: false,
    mode: "none",
    userId: null,
    diagnostics: {
      ...diagnosticsBase,
      bearerUserResolved: false,
    },
  };
};

const resolveRequestedWorkerLimit = (request: Request, mode: "admin" | "user"): number => {
  const url = new URL(request.url);
  const queryLimit = Number(url.searchParams.get("limit"));
  const maxLimit = mode === "admin" ? MAX_JOB_BATCH : 1;
  return Number.isFinite(queryLimit)
    ? Math.max(1, Math.min(maxLimit, Math.round(queryLimit)))
    : (mode === "admin" ? 3 : 1);
};

const resolveBackgroundWorkerUrl = (request: Request): string => {
  const origin = new URL(request.url).origin.replace(/\/+$/, "");
  return `${origin}/.netlify/functions/ai-generate-worker-background`;
};

const safeReadResponseText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const dispatchGenerationWorkerToBackground = async (
  request: Request,
  params: {
    mode: "admin" | "user";
    limit: number;
  },
): Promise<Response> => {
  const adminKey = readEnv("TF_ADMIN_API_KEY").trim();
  if (!adminKey) {
    return json(500, {
      ok: false,
      error: "Background worker auth key is missing.",
      code: "WORKER_DISPATCH_CONFIG_MISSING",
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BACKGROUND_DISPATCH_TIMEOUT_MS);
  try {
    const dispatchResponse = await fetch(resolveBackgroundWorkerUrl(request), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tf-admin-key": adminKey,
        "x-tf-worker-dispatch-mode": params.mode,
      },
      body: JSON.stringify({ limit: params.limit }),
      signal: controller.signal,
    });

    if (!dispatchResponse.ok) {
      return json(502, {
        ok: false,
        error: "Background worker dispatch failed.",
        code: "WORKER_DISPATCH_FAILED",
        details: await safeReadResponseText(dispatchResponse),
        status: dispatchResponse.status,
      });
    }

    return json(202, {
      ok: true,
      accepted: true,
      auth_mode: params.mode,
      limit: params.limit,
    });
  } catch (error) {
    return json(502, {
      ok: false,
      error: "Background worker dispatch failed.",
      code: "WORKER_DISPATCH_FAILED",
      details: error instanceof Error ? error.message : "Unknown dispatch error",
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const processJob = async (
  config: { url: string; serviceRoleKey: string },
  workerId: string,
  job: WorkerJobRow,
): Promise<{ ok: boolean; jobId: string; tripId: string; error?: string }> => {
  const payload = parseWorkerPayload(job.payload);
  if (!payload) {
    const failedToMark = !(await failJob(config, {
      jobId: job.id,
      workerId,
      errorCode: "ASYNC_WORKER_PAYLOAD_INVALID",
      errorMessage: "Job payload is invalid for async generation worker.",
      terminal: true,
    }));
    return {
      ok: false,
      jobId: job.id,
      tripId: job.trip_id,
      error: failedToMark ? "invalid_payload (job_fail_rpc_failed)" : "invalid_payload",
    };
  }

  const tripRow = await readTripRow(config, job.trip_id);
  if (!tripRow?.data) {
    const failedToMark = !(await failJob(config, {
      jobId: job.id,
      workerId,
      errorCode: "ASYNC_WORKER_TRIP_NOT_FOUND",
      errorMessage: "Trip row was not found while processing queued generation.",
      terminal: true,
    }));
    return {
      ok: false,
      jobId: job.id,
      tripId: job.trip_id,
      error: failedToMark ? "trip_missing (job_fail_rpc_failed)" : "trip_missing",
    };
  }

  const tripData = tripRow.data;
  const tripAiMeta = asObject(tripData.aiMeta);
  const tripGeneration = asObject(tripAiMeta?.generation);
  const latestAttemptId = asString(asObject(tripGeneration?.latestAttempt)?.id);
  const latestAttemptStartedAt = asString(asObject(tripGeneration?.latestAttempt)?.startedAt);
  if (latestAttemptId && latestAttemptId !== payload.attemptId) {
    const isSupersededAttempt = await shouldSupersedePayloadAttempt(config, {
      payloadAttemptId: payload.attemptId,
      payloadStartedAt: payload.startedAt,
      tripLatestAttemptId: latestAttemptId,
      tripLatestStartedAt: latestAttemptStartedAt,
    });
    if (isSupersededAttempt) {
      const skippedMessage = "Skipped outdated queued attempt because a newer attempt exists.";
      const attemptLogged = await finishAttempt(config, {
        p_attempt_id: payload.attemptId,
        p_state: "failed",
        p_provider: payload.target.provider || DEFAULT_PROVIDER,
        p_model: payload.target.model || DEFAULT_MODEL,
        p_provider_model: null,
        p_request_id: payload.requestId,
        p_duration_ms: null,
        p_status_code: 409,
        p_failure_kind: "abort",
        p_error_code: "ASYNC_WORKER_ATTEMPT_SUPERSEDED",
        p_error_message: skippedMessage,
        p_metadata: {
          source: WORKER_SOURCE,
          superseded_by_attempt_id: latestAttemptId,
        },
      });
      const jobCompleted = await completeJob(config, job.id, workerId);
      await patchQueueRequest(config, {
        requestId: payload.queueRequestId,
        ownerId: job.owner_id,
        patch: {
          status: "failed",
          result_trip_id: job.trip_id,
          error_message: skippedMessage,
          updated_at: new Date().toISOString(),
        },
      });
      return {
        ok: true,
        jobId: job.id,
        tripId: job.trip_id,
        error: !attemptLogged || !jobCompleted
          ? [
            !attemptLogged ? "attempt_finish_rpc_failed" : null,
            !jobCompleted ? "job_complete_rpc_failed" : null,
          ].filter(Boolean).join(" | ")
          : undefined,
      };
    }
    console.warn("[ai-generate-worker] Trip latest attempt id differs, but payload attempt is newer. Continuing job.", {
      tripId: job.trip_id,
      payloadAttemptId: payload.attemptId,
      latestAttemptId,
    });
  }

  const provider = payload.target.provider || DEFAULT_PROVIDER;
  const model = payload.target.model || DEFAULT_MODEL;
  const startedAt = Date.now();
  const securityInput = buildAiRuntimeSecurityInputFromTripInputSnapshot(payload.inputSnapshot || null);
  const inputSecurityEvaluation = await evaluateAiRuntimeInputSecurity(securityInput);
  const inputSecurity = inputSecurityEvaluation.effectiveSignal;
  const securityContext = {
    tripId: job.trip_id,
    attemptId: payload.attemptId,
  };

  if (inputSecurity.blocked) {
    const durationMs = Math.max(0, Date.now() - startedAt);
    const security = {
      ...summarizeAiRuntimeSecuritySignals([inputSecurity], securityContext),
      sanitization: inputSecurityEvaluation.sanitization,
    };
    const failedTrip = applyFailedGenerationState(tripData, {
      flow: payload.flow,
      attemptId: payload.attemptId,
      requestId: payload.requestId,
      provider,
      model,
      providerModel: null,
      statusCode: 422,
      failureKind: "quality",
      errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
      errorMessage: GENERIC_SECURITY_BLOCK_MESSAGE,
      durationMs,
      metadata: {
        source: WORKER_SOURCE,
        details: "User-provided trip fields were blocked during input preflight before a provider call was made.",
        providerReached: false,
        security,
      },
    });
    const failedTripPersisted = await upsertTripRow(config, failedTrip, job.owner_id);
    const failedTripVersionLogged = failedTripPersisted
      ? await insertTripVersion(config, job.trip_id, failedTrip, "Data: Queued generation blocked")
      : false;
    const attemptLogged = await finishAttempt(config, {
      p_attempt_id: payload.attemptId,
      p_state: "failed",
      p_provider: provider,
      p_model: model,
      p_provider_model: null,
      p_request_id: payload.requestId,
      p_duration_ms: durationMs,
      p_status_code: 422,
      p_failure_kind: "quality",
      p_error_code: "AI_RUNTIME_SECURITY_BLOCKED",
      p_error_message: GENERIC_SECURITY_BLOCK_MESSAGE,
      p_metadata: {
        source: WORKER_SOURCE,
        details: "User-provided trip fields were blocked during input preflight before a provider call was made.",
        providerReached: false,
        security,
        trip_upsert_ok: failedTripPersisted,
        trip_version_ok: failedTripVersionLogged,
      },
    });
    const jobFailed = await failJob(config, {
      jobId: job.id,
      workerId,
      errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
      errorMessage: GENERIC_SECURITY_BLOCK_MESSAGE,
      terminal: true,
    });
    await patchQueueRequest(config, {
      requestId: payload.queueRequestId,
      ownerId: job.owner_id,
      patch: {
        status: "failed",
        result_trip_id: job.trip_id,
        error_message: GENERIC_SECURITY_BLOCK_MESSAGE.slice(0, 400),
        updated_at: new Date().toISOString(),
      },
    });
    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId: payload.requestId,
      provider,
      model,
      status: "failed",
      latencyMs: durationMs,
      httpStatus: 422,
      errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
      errorMessage: GENERIC_SECURITY_BLOCK_MESSAGE,
      guardDecision: security.guardDecision,
      riskScore: security.riskScore,
      blocked: security.blocked,
      metadata: {
        endpoint: "/api/internal/ai/generation-worker",
        trip_id: job.trip_id,
        attempt_id: payload.attemptId,
        queue_request_id: payload.queueRequestId,
        flow: payload.flow,
        source: payload.source,
        provider_reached: false,
        details: "User-provided trip fields were blocked during input preflight before a provider call was made.",
        security,
      },
    });
    return {
      ok: false,
      jobId: job.id,
      tripId: job.trip_id,
      error: [
        "preflight_blocked",
        !failedTripPersisted ? "trip_upsert_failed" : null,
        failedTripPersisted && !failedTripVersionLogged ? "trip_version_insert_failed" : null,
        !attemptLogged ? "attempt_finish_rpc_failed" : null,
        !jobFailed ? "job_fail_rpc_failed" : null,
      ].filter(Boolean).join(" | "),
    };
  }

  let providerReached = false;
  try {
    providerReached = true;
    const generation = await generateProviderItinerary({
      prompt: payload.prompt,
      provider,
      model,
      timeoutMs: WORKER_PROVIDER_TIMEOUT_MS,
    });
    const durationMs = Math.max(0, Date.now() - startedAt);

    if (!generation.ok) {
      const failure = generation.value as ProviderFailure;
      const statusCode = "status" in generation ? generation.status : 500;
      const providerMessage = asString(failure.error) || "Provider generation failed.";
      const providerDetails = asString(failure.details);
      const providerErrorCode = asString(failure.code) || "ASYNC_WORKER_PROVIDER_FAILED";
      const outputSecurity = await detectAiRuntimeOutputSecurity({
        rawOutputText: asString(failure.sample) || providerDetails || providerMessage,
        input: securityInput,
        forceSchemaBypass: /parse|json|schema/i.test(providerErrorCode),
      });
      const security = {
        ...summarizeAiRuntimeSecuritySignals([inputSecurity, outputSecurity], securityContext),
        sanitization: inputSecurityEvaluation.sanitization,
      };
      const message = security.blocked ? GENERIC_OUTPUT_BLOCK_MESSAGE : providerMessage;
      const errorCode = security.blocked ? "AI_RUNTIME_SECURITY_BLOCKED" : providerErrorCode;
      const failureKind = security.blocked
        ? "quality"
        : classifyFailureKind({
          code: providerErrorCode,
          status: statusCode,
          message: providerMessage,
        });
      const failedTrip = applyFailedGenerationState(tripData, {
        flow: payload.flow,
        attemptId: payload.attemptId,
        requestId: payload.requestId,
        provider,
        model,
        providerModel: asString(failure.providerModel),
        statusCode,
        failureKind,
        errorCode,
        errorMessage: message,
        durationMs,
        metadata: {
          source: WORKER_SOURCE,
          details: providerDetails,
          providerReached: true,
          original_error_code: providerErrorCode,
          original_error_message: providerMessage,
          security,
        },
      });

      const failedTripPersisted = await upsertTripRow(config, failedTrip, job.owner_id);
      const failedTripVersionLogged = failedTripPersisted
        ? await insertTripVersion(config, job.trip_id, failedTrip, "Data: Queued generation failed")
        : false;
      const attemptLogged = await finishAttempt(config, {
        p_attempt_id: payload.attemptId,
        p_state: "failed",
        p_provider: provider,
        p_model: model,
        p_provider_model: asString(failure.providerModel),
        p_request_id: payload.requestId,
        p_duration_ms: durationMs,
        p_status_code: statusCode,
        p_failure_kind: failureKind,
        p_error_code: errorCode,
        p_error_message: message.slice(0, 1200),
        p_metadata: {
          source: WORKER_SOURCE,
          details: providerDetails,
          providerReached: true,
          original_error_code: providerErrorCode,
          original_error_message: providerMessage,
          security,
          trip_upsert_ok: failedTripPersisted,
          trip_version_ok: failedTripVersionLogged,
        },
      });
      const jobFailed = await failJob(config, {
        jobId: job.id,
        workerId,
        errorCode,
        errorMessage: message,
        terminal: true,
      });
      await patchQueueRequest(config, {
        requestId: payload.queueRequestId,
        ownerId: job.owner_id,
        patch: {
          status: "failed",
          result_trip_id: job.trip_id,
          error_message: message.slice(0, 400),
          updated_at: new Date().toISOString(),
        },
      });
      await persistAiGenerationTelemetry({
        source: "create_trip",
        requestId: payload.requestId,
        provider,
        model,
        providerModel: asString(failure.providerModel) || undefined,
        status: "failed",
        latencyMs: durationMs,
        httpStatus: statusCode,
        errorCode,
        errorMessage: message,
        guardDecision: security.guardDecision,
        riskScore: security.riskScore,
        blocked: security.blocked,
        metadata: {
          endpoint: "/api/internal/ai/generation-worker",
          trip_id: job.trip_id,
          attempt_id: payload.attemptId,
          queue_request_id: payload.queueRequestId,
          flow: payload.flow,
          source: payload.source,
          details: providerDetails,
          provider_reached: true,
          original_error_code: providerErrorCode,
          original_error_message: providerMessage,
          security,
        },
      });
      return {
        ok: false,
        jobId: job.id,
        tripId: job.trip_id,
        error: [
          message,
          !failedTripPersisted ? "trip_upsert_failed" : null,
          failedTripPersisted && !failedTripVersionLogged ? "trip_version_insert_failed" : null,
          !attemptLogged ? "attempt_finish_rpc_failed" : null,
          !jobFailed ? "job_fail_rpc_failed" : null,
        ].filter(Boolean).join(" | "),
      };
    }

    const validation = validateModelData(generation.value.data, {
      roundTrip: payload.roundTrip,
    });
    const outputSecurity = await detectAiRuntimeOutputSecurity({
      rawOutputText: JSON.stringify(generation.value.data),
      parsedData: generation.value.data,
      validation,
      input: securityInput,
    });
    const security = {
      ...summarizeAiRuntimeSecuritySignals([inputSecurity, outputSecurity], securityContext),
      sanitization: inputSecurityEvaluation.sanitization,
    };

    if (security.blocked) {
      const failedTrip = applyFailedGenerationState(tripData, {
        flow: payload.flow,
        attemptId: payload.attemptId,
        requestId: payload.requestId,
        provider: generation.value.meta.provider || provider,
        model: generation.value.meta.model || model,
        providerModel: asString(generation.value.meta.providerModel),
        statusCode: 422,
        failureKind: "quality",
        errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
        errorMessage: GENERIC_OUTPUT_BLOCK_MESSAGE,
        durationMs,
        metadata: {
          source: WORKER_SOURCE,
          providerReached: true,
          details: "Provider output was rejected after generation because it failed response validation or hard trip constraints.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          security,
        },
      });

      const failedTripPersisted = await upsertTripRow(config, failedTrip, job.owner_id);
      const failedTripVersionLogged = failedTripPersisted
        ? await insertTripVersion(config, job.trip_id, failedTrip, "Data: Queued generation blocked")
        : false;
      const attemptLogged = await finishAttempt(config, {
        p_attempt_id: payload.attemptId,
        p_state: "failed",
        p_provider: generation.value.meta.provider || provider,
        p_model: generation.value.meta.model || model,
        p_provider_model: asString(generation.value.meta.providerModel),
        p_request_id: payload.requestId,
        p_duration_ms: durationMs,
        p_status_code: 422,
        p_failure_kind: "quality",
        p_error_code: "AI_RUNTIME_SECURITY_BLOCKED",
        p_error_message: GENERIC_OUTPUT_BLOCK_MESSAGE,
        p_metadata: {
          source: WORKER_SOURCE,
          providerReached: true,
          details: "Provider output was rejected after generation because it failed response validation or hard trip constraints.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          security,
          trip_upsert_ok: failedTripPersisted,
          trip_version_ok: failedTripVersionLogged,
        },
      });
      const jobFailed = await failJob(config, {
        jobId: job.id,
        workerId,
        errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
        errorMessage: GENERIC_OUTPUT_BLOCK_MESSAGE,
        terminal: true,
      });
      await patchQueueRequest(config, {
        requestId: payload.queueRequestId,
        ownerId: job.owner_id,
        patch: {
          status: "failed",
          result_trip_id: job.trip_id,
          error_message: GENERIC_OUTPUT_BLOCK_MESSAGE.slice(0, 400),
          updated_at: new Date().toISOString(),
        },
      });
      await persistAiGenerationTelemetry({
        source: "create_trip",
        requestId: payload.requestId,
        provider: generation.value.meta.provider || provider,
        model: generation.value.meta.model || model,
        providerModel: generation.value.meta.providerModel,
        status: "failed",
        latencyMs: durationMs,
        httpStatus: 422,
        errorCode: "AI_RUNTIME_SECURITY_BLOCKED",
        errorMessage: GENERIC_OUTPUT_BLOCK_MESSAGE,
        estimatedCostUsd: generation.value.meta.usage?.estimatedCostUsd,
        promptTokens: generation.value.meta.usage?.promptTokens,
        completionTokens: generation.value.meta.usage?.completionTokens,
        totalTokens: generation.value.meta.usage?.totalTokens,
        guardDecision: security.guardDecision,
        riskScore: security.riskScore,
        blocked: security.blocked,
        metadata: {
          endpoint: "/api/internal/ai/generation-worker",
          trip_id: job.trip_id,
          attempt_id: payload.attemptId,
          queue_request_id: payload.queueRequestId,
          flow: payload.flow,
          source: payload.source,
          provider_reached: true,
          details: "Provider output was rejected after generation because it failed response validation or hard trip constraints.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          security,
        },
      });
      return {
        ok: false,
        jobId: job.id,
        tripId: job.trip_id,
        error: [
          "postflight_blocked",
          !failedTripPersisted ? "trip_upsert_failed" : null,
          failedTripPersisted && !failedTripVersionLogged ? "trip_version_insert_failed" : null,
          !attemptLogged ? "attempt_finish_rpc_failed" : null,
          !jobFailed ? "job_fail_rpc_failed" : null,
        ].filter(Boolean).join(" | "),
      };
    }

    const builtTrip = buildTripFromModelData(generation.value.data, {
      tripId: job.trip_id,
      startDate: payload.startDate || tripRow.start_date || new Date().toISOString(),
      roundTrip: payload.roundTrip,
      provider: generation.value.meta.provider || provider,
      model: generation.value.meta.model || model,
    });

    const succeededTrip = applySucceededGenerationState(
      tripData,
      builtTrip,
      {
        flow: payload.flow,
        attemptId: payload.attemptId,
        requestId: payload.requestId,
        provider: generation.value.meta.provider || provider,
        model: generation.value.meta.model || model,
        providerModel: asString(generation.value.meta.providerModel),
        durationMs,
        statusCode: 200,
        metadata: {
          source: WORKER_SOURCE,
          providerReached: true,
          details: inputSecurityEvaluation.sanitization?.applied
            ? "Generation succeeded after sanitizing suspicious instruction-like fragments from user-provided fields."
            : "Generation completed successfully.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          security,
        },
      },
    );

    const succeededTripPersisted = await upsertTripRow(config, succeededTrip, job.owner_id);
    if (!succeededTripPersisted) {
      const persistenceError = new Error("Trip upsert failed while finalizing queued generation.");
      persistenceError.name = "ASYNC_WORKER_TRIP_UPSERT_FAILED";
      throw persistenceError;
    }
    const succeededTripVersionLogged = await insertTripVersion(config, job.trip_id, succeededTrip, "Data: Queued generation completed");
    if (!succeededTripVersionLogged) {
      const versionError = new Error("Trip version insert failed while finalizing queued generation.");
      versionError.name = "ASYNC_WORKER_TRIP_VERSION_WRITE_FAILED";
      throw versionError;
    }
    const attemptLogged = await finishAttempt(config, {
      p_attempt_id: payload.attemptId,
      p_state: "succeeded",
      p_provider: generation.value.meta.provider || provider,
      p_model: generation.value.meta.model || model,
      p_provider_model: asString(generation.value.meta.providerModel),
      p_request_id: payload.requestId,
      p_duration_ms: durationMs,
      p_status_code: 200,
        p_metadata: {
          source: WORKER_SOURCE,
          providerReached: true,
          details: inputSecurityEvaluation.sanitization?.applied
            ? "Generation succeeded after sanitizing suspicious instruction-like fragments from user-provided fields."
            : "Generation completed successfully.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
          warnings: validation.warnings,
        },
        security,
        trip_upsert_ok: true,
        trip_version_ok: true,
      },
    });
    const jobCompleted = await completeJob(config, job.id, workerId);
    await patchQueueRequest(config, {
      requestId: payload.queueRequestId,
      ownerId: job.owner_id,
      patch: {
        status: "completed",
        result_trip_id: job.trip_id,
        completed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      },
    });
    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId: payload.requestId,
      provider: generation.value.meta.provider || provider,
      model: generation.value.meta.model || model,
      providerModel: generation.value.meta.providerModel,
      status: "success",
      latencyMs: durationMs,
      httpStatus: 200,
      promptTokens: generation.value.meta.usage?.promptTokens,
      completionTokens: generation.value.meta.usage?.completionTokens,
      totalTokens: generation.value.meta.usage?.totalTokens,
      estimatedCostUsd: generation.value.meta.usage?.estimatedCostUsd,
      guardDecision: security.guardDecision,
      riskScore: security.riskScore,
      blocked: security.blocked,
      metadata: {
        endpoint: "/api/internal/ai/generation-worker",
        trip_id: job.trip_id,
        attempt_id: payload.attemptId,
          queue_request_id: payload.queueRequestId,
          flow: payload.flow,
          source: payload.source,
          provider_reached: true,
          details: inputSecurityEvaluation.sanitization?.applied
            ? "Generation succeeded after sanitizing suspicious instruction-like fragments from user-provided fields."
            : "Generation completed successfully.",
          validation: {
            schemaValid: validation.schemaValid,
            errors: validation.errors,
          warnings: validation.warnings,
        },
        security,
      },
    });
    return {
      ok: true,
      jobId: job.id,
      tripId: job.trip_id,
      error: !attemptLogged || !jobCompleted
        ? [
          !attemptLogged ? "attempt_finish_rpc_failed" : null,
          !jobCompleted ? "job_complete_rpc_failed" : null,
        ].filter(Boolean).join(" | ")
        : undefined,
    };
  } catch (error) {
    const durationMs = Math.max(0, Date.now() - startedAt);
    const message = error instanceof Error ? error.message : "Unexpected async worker error";
    const errorCode = error instanceof Error ? error.name : "ASYNC_WORKER_UNKNOWN_ERROR";
    const failureKind = classifyFailureKind({
      code: errorCode,
      status: 500,
      message,
    });
    const security = {
      ...summarizeAiRuntimeSecuritySignals([inputSecurity], securityContext),
      sanitization: inputSecurityEvaluation.sanitization,
    };
    const failedTrip = applyFailedGenerationState(tripData, {
      flow: payload.flow,
      attemptId: payload.attemptId,
      requestId: payload.requestId,
      provider,
      model,
      providerModel: null,
      statusCode: 500,
      failureKind,
      errorCode,
      errorMessage: message,
      durationMs,
      metadata: {
        source: WORKER_SOURCE,
        details: message,
        providerReached,
        security,
      },
    });
    const failedTripPersisted = await upsertTripRow(config, failedTrip, job.owner_id);
    const failedTripVersionLogged = failedTripPersisted
      ? await insertTripVersion(config, job.trip_id, failedTrip, "Data: Queued generation failed")
      : false;
    const attemptLogged = await finishAttempt(config, {
      p_attempt_id: payload.attemptId,
      p_state: "failed",
      p_provider: provider,
      p_model: model,
      p_provider_model: null,
      p_request_id: payload.requestId,
      p_duration_ms: durationMs,
      p_status_code: 500,
      p_failure_kind: failureKind,
      p_error_code: errorCode,
      p_error_message: message.slice(0, 1200),
      p_metadata: {
        source: WORKER_SOURCE,
        details: message,
        providerReached,
        security,
        trip_upsert_ok: failedTripPersisted,
        trip_version_ok: failedTripVersionLogged,
      },
    });
    const jobFailed = await failJob(config, {
      jobId: job.id,
      workerId,
      errorCode,
      errorMessage: message,
      terminal: true,
    });
    await patchQueueRequest(config, {
      requestId: payload.queueRequestId,
      ownerId: job.owner_id,
      patch: {
        status: "failed",
        result_trip_id: job.trip_id,
        error_message: message.slice(0, 400),
        updated_at: new Date().toISOString(),
      },
    });
    await persistAiGenerationTelemetry({
      source: "create_trip",
      requestId: payload.requestId,
      provider,
      model,
      status: "failed",
      latencyMs: durationMs,
      httpStatus: 500,
      errorCode,
      errorMessage: message,
      guardDecision: security.guardDecision,
      riskScore: security.riskScore,
      blocked: security.blocked,
      metadata: {
        endpoint: "/api/internal/ai/generation-worker",
        trip_id: job.trip_id,
        attempt_id: payload.attemptId,
        queue_request_id: payload.queueRequestId,
        flow: payload.flow,
        source: payload.source,
        provider_reached: providerReached,
        details: message,
        security,
      },
    });
    return {
      ok: false,
      jobId: job.id,
      tripId: job.trip_id,
      error: [
        message,
        !failedTripPersisted ? "trip_upsert_failed" : null,
        failedTripPersisted && !failedTripVersionLogged ? "trip_version_insert_failed" : null,
        !attemptLogged ? "attempt_finish_rpc_failed" : null,
        !jobFailed ? "job_fail_rpc_failed" : null,
      ].filter(Boolean).join(" | "),
    };
  }
};

export const processGenerationWorkerRequest = async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed. Use POST." });
  }

  if (!isWorkerEnabled()) {
    return json(202, {
      ok: true,
      skipped: true,
      reason: "worker_disabled",
    });
  }

  const config = getServiceConfig();
  if (!config) {
    return json(500, {
      ok: false,
      error: "Supabase service configuration is missing.",
      code: "WORKER_SUPABASE_CONFIG_MISSING",
    });
  }

  const auth = await ensureWorkerAuthorized(request, config);
  if (!auth.authorized) {
    console.error("[ai-generate-worker] unauthorized process request", auth.diagnostics);
    return json(401, {
      ok: false,
      error: "Unauthorized worker request.",
      code: "WORKER_UNAUTHORIZED",
      details: auth.diagnostics,
    });
  }

  const limit = resolveRequestedWorkerLimit(request, auth.mode);
  const workerId = `edge:${crypto.randomUUID()}`;

  await requeueExpiredLeasedJobs(config);

  const claimed = await claimJobs(config, workerId, limit);
  if (claimed.error) {
    return json(502, {
      ok: false,
      code: "WORKER_JOB_CLAIM_FAILED",
      error: claimed.error.message,
      status: claimed.error.status,
    });
  }

  const jobs = claimed.jobs;
  if (jobs.length === 0) {
    return json(200, {
      ok: true,
      auth_mode: auth.mode,
      claimed: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      jobs: [],
    });
  }

  const results: Array<{ ok: boolean; jobId: string; tripId: string; error?: string }> = [];
  for (const job of jobs) {
    // Sequential processing keeps provider concurrency bounded and easier to reason about.
    const result = await processJob(config, workerId, job);
    results.push(result);
  }

  const succeeded = results.filter((entry) => entry.ok).length;
  const failed = results.length - succeeded;
  return json(200, {
    ok: true,
    auth_mode: auth.mode,
    claimed: jobs.length,
    processed: results.length,
    succeeded,
    failed,
    jobs: results,
  });
};

export const handleGenerationWorkerRequest = async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed. Use POST." });
  }

  if (!isWorkerEnabled()) {
    return json(202, {
      ok: true,
      skipped: true,
      reason: "worker_disabled",
    });
  }

  const config = getServiceConfig();
  if (!config) {
    return json(500, {
      ok: false,
      error: "Supabase service configuration is missing.",
      code: "WORKER_SUPABASE_CONFIG_MISSING",
    });
  }

  const auth = await ensureWorkerAuthorized(request, config);
  if (!auth.authorized) {
    console.error("[ai-generate-worker] unauthorized dispatch request", auth.diagnostics);
    return json(401, {
      ok: false,
      error: "Unauthorized worker request.",
      code: "WORKER_UNAUTHORIZED",
      details: auth.diagnostics,
    });
  }

  const limit = resolveRequestedWorkerLimit(request, auth.mode);
  return dispatchGenerationWorkerToBackground(request, {
    mode: auth.mode,
    limit,
  });
};

export default handleGenerationWorkerRequest;
