import { buildClassicItineraryPrompt, type GenerateOptions } from '../services/aiService.ts';
import { resolveTimeoutMs } from '../netlify/edge-lib/ai-provider-runtime.ts';
import { generatePreparedTripItinerary } from '../netlify/edge-lib/ai-trip-generation.ts';
import {
    TRIP_ITINERARY_COMPACT_STRUCTURED_OUTPUT_SCHEMA,
    TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA,
} from '../shared/aiTripItinerarySchema.ts';
import type { TripEvalVars } from './tripEvalFixtures.ts';

const PROMPTFOO_TIMEOUT_MS = resolveTimeoutMs('AI_PROMPTFOO_TIMEOUT_MS', 90_000, 20_000, 180_000);
const SHORT_TIMEOUT_MAX_OUTPUT_TOKENS = 6_144;

const parseTargetId = (targetId: string): { provider: string; model: string } => {
    const [provider, ...modelParts] = targetId.split(':');
    const model = modelParts.join(':').trim();
    const normalizedProvider = provider?.trim().toLowerCase() || '';

    if (!normalizedProvider || !model) {
        throw new Error(`Invalid Promptfoo target "${targetId}". Expected provider:model.`);
    }

    return {
        provider: normalizedProvider,
        model,
    };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const getTripEvalVars = (value: unknown): TripEvalVars => {
    if (!isRecord(value)) {
        throw new Error('Promptfoo provider expected vars to be an object.');
    }

    const destinationPrompt = typeof value.destinationPrompt === 'string' ? value.destinationPrompt.trim() : '';
    if (!destinationPrompt) {
        throw new Error('Promptfoo provider expected destinationPrompt to be set.');
    }

    const scenarioId = typeof value.scenarioId === 'string' ? value.scenarioId.trim() : destinationPrompt;
    const generationOptions = isRecord(value.generationOptions)
        ? value.generationOptions as GenerateOptions
        : {};

    return {
        scenarioId,
        destinationPrompt,
        startDate: typeof value.startDate === 'string' ? value.startDate : undefined,
        roundTrip: Boolean(value.roundTrip),
        generationOptions,
        expectations: isRecord(value.expectations) ? value.expectations : {},
        selectedDestinations: Array.isArray(value.selectedDestinations)
            ? value.selectedDestinations.filter((entry): entry is string => typeof entry === 'string')
            : [],
    };
};

const toTokenUsage = (usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
} | undefined) => {
    if (!usage) return undefined;
    return {
        prompt: usage.promptTokens || 0,
        completion: usage.completionTokens || 0,
        total: usage.totalTokens || 0,
    };
};

interface PromptfooProviderOptions {
    config?: {
        targetId?: string;
    };
}

export default class TravelFlowTripEvalProvider {
    private readonly provider: string;
    private readonly model: string;
    private readonly targetId: string;

    constructor(options: PromptfooProviderOptions = {}) {
        const targetId = typeof options.config?.targetId === 'string' ? options.config.targetId.trim() : '';
        const target = parseTargetId(targetId);

        this.provider = target.provider;
        this.model = target.model;
        this.targetId = targetId;
    }

    id() {
        return `travelflow:${this.targetId}`;
    }

    async callApi(_prompt: string, context?: { vars?: Record<string, unknown> }) {
        try {
            const vars = getTripEvalVars(context?.vars);
            const prompt = buildClassicItineraryPrompt(vars.destinationPrompt, vars.generationOptions);
            const result = await generatePreparedTripItinerary({
                prompt,
                provider: this.provider,
                model: this.model,
                timeoutMs: PROMPTFOO_TIMEOUT_MS,
                maxOutputTokens: PROMPTFOO_TIMEOUT_MS <= 60_000 ? SHORT_TIMEOUT_MAX_OUTPUT_TOKENS : undefined,
                jsonSchema: vars.generationOptions.promptMode === 'benchmark_compact'
                    ? TRIP_ITINERARY_COMPACT_STRUCTURED_OUTPUT_SCHEMA
                    : TRIP_ITINERARY_STRUCTURED_OUTPUT_SCHEMA,
                preparation: {
                    roundTrip: vars.roundTrip,
                    minimumRecommendations: vars.generationOptions.promptMode === 'benchmark_compact' ? 1 : 3,
                },
            });

            if (!result.ok) {
                const error = result.kind === 'validation'
                    ? `Trip draft validation failed: ${result.errors.join('; ')}`
                    : `${result.failure.error} (${result.failure.code})`;
                return {
                    error,
                    metadata: {
                        scenarioId: vars.scenarioId,
                        provider: this.provider,
                        model: this.model,
                        details: result.kind === 'validation' ? result.errors : result.failure.details || null,
                        semanticRepair: result.repair,
                    },
                };
            }

            return {
                output: JSON.stringify(result.value.draft),
                tokenUsage: toTokenUsage(result.value.meta.usage),
                cost: result.value.meta.usage?.estimatedCostUsd,
                metadata: {
                    scenarioId: vars.scenarioId,
                    provider: result.value.meta.provider,
                    model: result.value.meta.model,
                    providerModel: result.value.meta.providerModel || null,
                    selectedDestinations: vars.selectedDestinations,
                    tripCompiler: result.value.data.metrics,
                    semanticRepair: result.value.repair,
                },
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Unexpected Promptfoo provider error.',
                metadata: {
                    provider: this.provider,
                    model: this.model,
                },
            };
        }
    }
}
