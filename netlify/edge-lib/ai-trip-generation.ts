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

  for (let repairAttempt = 0; repairAttempt <= MAX_SEMANTIC_REPAIR_ATTEMPTS; repairAttempt += 1) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(1_000, options.timeoutMs - elapsedMs);
    if (repairAttempt > 0 && remainingMs < 5_000) break;

    attempts += 1;
    const result = await generate({
      ...providerOptions,
      prompt,
      timeoutMs: remainingMs,
    });
    if (!result.ok) {
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
        },
      };
    }

    usage = addUsage(usage, result.value.meta.usage);
    lastMeta = { ...result.value.meta, usage };
    lastDraft = result.value.data;
    const prepared = prepareTripItineraryModelData(result.value.data, preparation);
    if (prepared.ok) {
      return {
        ok: true,
        value: {
          data: prepared.value,
          draft: result.value.data,
          meta: lastMeta,
          attempts,
          repaired: repairAttempt > 0,
          repair: {
            attempted: repairAttempt > 0,
            succeeded: repairAttempt > 0,
            initialErrors,
          },
        },
      };
    }

    lastErrors = prepared.errors;
    if (initialErrors.length === 0) initialErrors = prepared.errors;
    prompt = buildSemanticRepairPrompt(options.prompt, prepared.errors);
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
    },
  };
};
