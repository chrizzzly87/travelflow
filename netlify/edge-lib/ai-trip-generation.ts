import {
  generateProviderItinerary,
  type ProviderGenerationFailurePayload,
  type ProviderGenerationMeta,
  type ProviderGenerationOptions,
  type ProviderUsage,
} from "./ai-provider-runtime.ts";
import {
  prepareTripItineraryModelData,
  type PreparedTripItinerary,
  type TripItineraryPreparationOptions,
} from "../../shared/aiTripItineraryPreparation.ts";
import { TRIP_ITINERARY_SCHEDULE_REPAIR_STRUCTURED_OUTPUT_SCHEMA } from "../../shared/aiTripItinerarySchema.ts";

const MAX_SEMANTIC_REPAIR_ATTEMPTS = 1;

const addUsage = (left: ProviderUsage | undefined, right: ProviderUsage | undefined): ProviderUsage | undefined => {
  if (!left && !right) return undefined;
  const sum = (key: keyof ProviderUsage): number | undefined => {
    const values = [left?.[key], right?.[key]].filter((value): value is number => Number.isFinite(value));
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) : undefined;
  };
  return {
    promptTokens: sum("promptTokens"),
    completionTokens: sum("completionTokens"),
    totalTokens: sum("totalTokens"),
    estimatedCostUsd: sum("estimatedCostUsd"),
  };
};

const buildSemanticRepairPrompt = (prompt: string, errors: string[]): string => `${prompt}

SEMANTIC REPAIR REQUIRED:
The previous schema-valid draft was rejected by TravelFlow's semantic validator:
${errors.slice(0, 12).map((error) => `- ${error}`).join("\n")}

Return a complete replacement object that fixes every listed error. For each activity, use a non-negative dayOffsetInCity and positive duration in days such that dayOffsetInCity + duration is less than or equal to that city's days. Typical activity durations are 0.125, 0.25, or 0.5 days. Preserve all requested stops, recommendation counts, and transfer legs.`;

const isTargetedScheduleError = (error: string): boolean => (
  error.startsWith("travelSegments")
  || /^activities\[\d+\]\.(?:cityIndex|dayOffsetInCity|duration)/.test(error)
  || /^activities\[\d+\].*(?:city stay|cityIndex|dayOffsetInCity|duration|falls outside|extends beyond)/.test(error)
);

const canUseTargetedScheduleRepair = (errors: string[]): boolean => (
  errors.length > 0 && errors.every(isTargetedScheduleError)
);

const buildTargetedScheduleRepairPrompt = (
  draft: Record<string, unknown>,
  errors: string[],
): string => `Repair only the transfer legs and activity scheduling fields in this TravelFlow trip draft.

VALIDATION ERRORS:
${errors.map((error) => `- ${error}`).join("\n")}

INVALID DRAFT:
${JSON.stringify(draft)}

Return the constrained repair object only. travelSegments must be the complete corrected ordered list. activitySchedules must contain exactly one entry for every original activity, identified by its zero-based activityIndex. Preserve every activity's title, description, and activityTypes by changing only cityIndex, dayOffsetInCity, and duration. Each duration must be positive, each offset non-negative, and offset plus duration must fit within the referenced city's days. Typical durations are 0.125, 0.25, or 0.5 days.`;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const normalizeSafeScheduleFields = (
  draft: Record<string, unknown>,
): Record<string, unknown> => {
  const cities = Array.isArray(draft.cities) ? draft.cities : [];
  const activities = Array.isArray(draft.activities) ? draft.activities : [];
  let changed = false;
  const normalizedActivities = activities.map((activity) => {
    const entry = asRecord(activity);
    if (!entry || !Number.isInteger(entry.cityIndex)) return activity;
    const city = asRecord(cities[Number(entry.cityIndex)]);
    const cityDays = Number(city?.days);
    if (!city || !Number.isFinite(cityDays) || cityDays <= 0) return activity;

    const dayOffsetInCity = Number(entry.dayOffsetInCity);
    if (!Number.isFinite(dayOffsetInCity) || dayOffsetInCity < 0 || dayOffsetInCity >= cityDays) return activity;
    const requestedDuration = Number(entry.duration);
    if (!Number.isFinite(requestedDuration) || requestedDuration > 0) return activity;
    const duration = Math.min(0.25, cityDays - dayOffsetInCity);
    if (duration <= 0) return activity;
    changed = true;
    return { ...entry, dayOffsetInCity, duration };
  });

  return changed
    ? { ...draft, activities: normalizedActivities }
    : draft;
};

const mergeTargetedScheduleRepair = (
  draft: Record<string, unknown>,
  patch: Record<string, unknown>,
  errors: string[],
): Record<string, unknown> | null => {
  const activities = Array.isArray(draft.activities) ? draft.activities : null;
  const cities = Array.isArray(draft.cities) ? draft.cities : null;
  const travelSegments = Array.isArray(patch.travelSegments) ? patch.travelSegments : null;
  if (!activities || !cities || !travelSegments) return null;

  const needsActivityRepair = errors.some((error) => error.startsWith("activities["));
  if (!needsActivityRepair) {
    return { ...draft, travelSegments };
  }

  const schedules = Array.isArray(patch.activitySchedules) ? patch.activitySchedules : null;
  if (!schedules || schedules.length !== activities.length) return null;

  const scheduleByIndex = new Map<number, Record<string, unknown>>();
  for (const entry of schedules) {
    const schedule = asRecord(entry);
    const activityIndex = schedule?.activityIndex;
    if (!schedule || !Number.isInteger(activityIndex) || (activityIndex as number) < 0 || (activityIndex as number) >= activities.length) {
      return null;
    }
    if (scheduleByIndex.has(activityIndex as number)) return null;
    scheduleByIndex.set(activityIndex as number, schedule);
  }

  const repairedActivities = activities.map((activity, index) => {
    const original = asRecord(activity);
    const schedule = scheduleByIndex.get(index);
    if (!original || !schedule) return null;
    const cityIndex = Number(schedule.cityIndex);
    const city = Number.isInteger(cityIndex) ? asRecord(cities[cityIndex]) : null;
    const cityDays = Number(city?.days);
    if (!city || !Number.isFinite(cityDays) || cityDays <= 0) return null;
    const dayOffsetInCity = Number(schedule.dayOffsetInCity);
    const duration = Number(schedule.duration);
    if (!Number.isFinite(dayOffsetInCity) || dayOffsetInCity < 0 || !Number.isFinite(duration) || duration <= 0) return null;
    if (dayOffsetInCity + duration > cityDays) return null;
    return {
      ...original,
      cityIndex,
      dayOffsetInCity,
      duration,
    };
  });
  if (repairedActivities.some((activity) => activity === null)) return null;

  return {
    ...draft,
    travelSegments,
    activities: repairedActivities,
  };
};

export type PreparedProviderGenerationResult =
  | {
    ok: true;
    value: {
      data: PreparedTripItinerary;
      draft: Record<string, unknown>;
      meta: ProviderGenerationMeta;
      attempts: number;
      repaired: boolean;
      repair: SemanticRepairMetadata;
    };
  }
  | {
    ok: false;
    kind: "provider";
    status: number;
    failure: ProviderGenerationFailurePayload;
    usage?: ProviderUsage;
    attempts: number;
    repair: SemanticRepairMetadata;
  }
  | {
    ok: false;
    kind: "validation";
    status: 502;
    errors: string[];
    draft?: Record<string, unknown>;
    meta: ProviderGenerationMeta;
    attempts: number;
    repair: SemanticRepairMetadata;
  };

export interface SemanticRepairMetadata {
  attempted: boolean;
  succeeded: boolean;
  initialErrors: string[];
  finalErrors?: string[];
  providerFailureCode?: string;
  strategy?: "deterministic_normalization" | "targeted_schedule_patch" | "full_regeneration";
}

export const generatePreparedTripItinerary = async (
  options: ProviderGenerationOptions & {
    preparation?: TripItineraryPreparationOptions;
    generate?: typeof generateProviderItinerary;
  },
): Promise<PreparedProviderGenerationResult> => {
  const {
    preparation,
    generate: generationOverride,
    ...providerOptions
  } = options;
  const generate = generationOverride ?? generateProviderItinerary;
  const startedAt = Date.now();
  let prompt = options.prompt;
  let usage: ProviderUsage | undefined;
  let lastErrors: string[] = [];
  let initialErrors: string[] = [];
  let lastMeta: ProviderGenerationMeta | null = null;
  let lastDraft: Record<string, unknown> | undefined;
  let attempts = 0;
  let repairStrategy: SemanticRepairMetadata["strategy"];

  for (let repairAttempt = 0; repairAttempt <= MAX_SEMANTIC_REPAIR_ATTEMPTS; repairAttempt += 1) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(1_000, options.timeoutMs - elapsedMs);
    if (repairAttempt > 0 && remainingMs < 5_000) break;

    attempts += 1;
    const result = await generate({
      ...providerOptions,
      prompt,
      ...(repairAttempt > 0 && repairStrategy === "targeted_schedule_patch"
        ? { jsonSchema: TRIP_ITINERARY_SCHEDULE_REPAIR_STRUCTURED_OUTPUT_SCHEMA }
        : {}),
      timeoutMs: remainingMs,
    });
    if (result.ok === false) {
      return {
        ok: false,
        kind: "provider",
        status: result.status,
        failure: result.value,
        usage,
        attempts,
        repair: {
          attempted: attempts > 1,
          succeeded: false,
          initialErrors,
          providerFailureCode: result.value.code,
          strategy: repairStrategy,
        },
      };
    }

    usage = addUsage(usage, result.value.meta.usage);
    lastMeta = { ...result.value.meta, usage };
    const generatedData = result.value.data;
    const candidateDraft = repairAttempt > 0 && repairStrategy === "targeted_schedule_patch"
      ? mergeTargetedScheduleRepair(lastDraft ?? {}, generatedData, lastErrors)
      : generatedData;
    lastDraft = candidateDraft ?? lastDraft;
    const prepared = candidateDraft
      ? prepareTripItineraryModelData(candidateDraft, preparation)
      : { ok: false as const, errors: ["Targeted schedule repair returned an incomplete or ambiguous patch"] };
    if (prepared.ok === true) {
      return {
        ok: true,
        value: {
          data: prepared.value,
          draft: candidateDraft,
          meta: lastMeta,
          attempts,
          repaired: repairAttempt > 0,
          repair: {
            attempted: repairAttempt > 0,
            succeeded: repairAttempt > 0,
            initialErrors,
            strategy: repairStrategy,
          },
        },
      };
    }

    let currentErrors = prepared.errors;
    if (repairAttempt === 0 && candidateDraft && canUseTargetedScheduleRepair(prepared.errors)) {
      const normalizedDraft = normalizeSafeScheduleFields(candidateDraft);
      if (normalizedDraft !== candidateDraft) {
        const normalized = prepareTripItineraryModelData(normalizedDraft, preparation);
        lastDraft = normalizedDraft;
        if (normalized.ok === true) {
          return {
            ok: true,
            value: {
              data: normalized.value,
              draft: normalizedDraft,
              meta: lastMeta,
              attempts,
              repaired: true,
              repair: {
                attempted: true,
                succeeded: true,
                initialErrors: prepared.errors,
                strategy: "deterministic_normalization",
              },
            },
          };
        }
        currentErrors = normalized.errors;
        if (initialErrors.length === 0) initialErrors = prepared.errors;
      }
    }

    lastErrors = currentErrors;
    if (initialErrors.length === 0) initialErrors = prepared.errors;
    if (repairAttempt < MAX_SEMANTIC_REPAIR_ATTEMPTS) {
      repairStrategy = canUseTargetedScheduleRepair(currentErrors)
        ? "targeted_schedule_patch"
        : "full_regeneration";
      prompt = repairStrategy === "targeted_schedule_patch"
        ? buildTargetedScheduleRepairPrompt(lastDraft ?? generatedData, currentErrors)
        : buildSemanticRepairPrompt(options.prompt, currentErrors);
    }
  }

  return {
    ok: false,
    kind: "validation",
    status: 502,
    errors: lastErrors,
    draft: lastDraft,
    meta: lastMeta ?? {
      provider: providerOptions.provider,
      model: providerOptions.model,
      usage,
    },
    attempts,
    repair: {
      attempted: attempts > 1,
      succeeded: false,
      initialErrors,
      finalErrors: lastErrors,
      strategy: repairStrategy,
    },
  };
};
