import type { AiModelCatalogItem } from '../config/aiModelCatalog.ts';
import { isAiReasoningEffort, type AiReasoningEffort } from '../shared/aiReasoning.ts';

export const OPENROUTER_PUBLIC_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const OPENROUTER_USER_MODELS_URL = 'https://openrouter.ai/api/v1/models/user';

export interface OpenRouterCatalogModel extends AiModelCatalogItem {
    catalogSource: 'openrouter-live';
    contextLength: number | null;
    inputPricePerMillion: number | null;
    outputPricePerMillion: number | null;
    supportedParameters: string[];
    supportsStructuredOutput: boolean;
    supportsTools: boolean;
    supportsReasoning: boolean;
    isFree: boolean;
    expirationDate: string | null;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asFiniteNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const MODEL_FAMILY_LABELS: Record<string, { label: string; shortName: string }> = {
    anthropic: { label: 'Anthropic', shortName: 'Anthropic' },
    deepseek: { label: 'DeepSeek', shortName: 'DeepSeek' },
    google: { label: 'Google Gemini', shortName: 'Gemini' },
    minimax: { label: 'MiniMax', shortName: 'MiniMax' },
    moonshotai: { label: 'Moonshot AI', shortName: 'Kimi' },
    openai: { label: 'OpenAI', shortName: 'OpenAI' },
    qwen: { label: 'Qwen', shortName: 'Qwen' },
    'x-ai': { label: 'xAI', shortName: 'xAI' },
    'z-ai': { label: 'Z.ai', shortName: 'Z.ai' },
};

const toPricePerMillion = (value: unknown): number | null => {
    const perToken = asFiniteNumber(value);
    return perToken === null ? null : Number((perToken * 1_000_000).toFixed(6));
};

const formatUsd = (value: number | null): string => {
    if (value === null) return '?';
    if (value === 0) return '$0';
    if (value < 0.01) return `$${value.toFixed(3)}`;
    if (value < 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(2)}`;
};

const toIsoDate = (unixSeconds: unknown): string | null => {
    const parsed = asFiniteNumber(unixSeconds);
    if (parsed === null || parsed <= 0) return null;
    const date = new Date(parsed * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const normalizeExpirationDate = (value: unknown): string | null => {
    const text = asText(value);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const hasOnlyTextOutput = (architecture: UnknownRecord): boolean => {
    const modalities = Array.isArray(architecture.output_modalities)
        ? architecture.output_modalities.map(asText).filter(Boolean)
        : [];
    return modalities.length === 1 && modalities[0] === 'text';
};

export const isTravelFlowCompatibleOpenRouterModel = (
    value: unknown,
    now = new Date(),
): boolean => {
    if (!isRecord(value)) return false;
    const id = asText(value.id);
    if (!id || id.startsWith('~') || id.includes(':batch')) return false;

    const architecture = isRecord(value.architecture) ? value.architecture : {};
    if (!hasOnlyTextOutput(architecture)) return false;

    const supported = Array.isArray(value.supported_parameters)
        ? value.supported_parameters.map(asText).filter(Boolean)
        : [];
    if (!supported.includes('response_format') || !supported.includes('structured_outputs')) return false;

    const expirationDate = normalizeExpirationDate(value.expiration_date);
    if (expirationDate && new Date(expirationDate).getTime() <= now.getTime()) return false;

    return true;
};

const normalizeOpenRouterModel = (value: UnknownRecord): OpenRouterCatalogModel | null => {
    const id = asText(value.id);
    const releasedAt = toIsoDate(value.created);
    if (!id || !releasedAt) return null;

    const family = id.split('/')[0] || 'openrouter';
    const familyMetadata = MODEL_FAMILY_LABELS[family] || {
        label: family.replace(/(^|-)(\w)/g, (_match, _separator, letter: string) => letter.toUpperCase()),
        shortName: family,
    };
    const rawName = asText(value.name);
    const label = rawName.includes(':') ? rawName.slice(rawName.indexOf(':') + 1).trim() : rawName || id;
    const pricing = isRecord(value.pricing) ? value.pricing : {};
    const inputPricePerMillion = toPricePerMillion(pricing.prompt);
    const outputPricePerMillion = toPricePerMillion(pricing.completion);
    const supportedParameters = Array.isArray(value.supported_parameters)
        ? value.supported_parameters.map(asText).filter(Boolean)
        : [];
    const reasoning = isRecord(value.reasoning) ? value.reasoning : {};
    const reasoningEfforts = Array.isArray(reasoning.supported_efforts)
        ? reasoning.supported_efforts.filter(isAiReasoningEffort)
        : [];
    const defaultReasoningEffort = isAiReasoningEffort(reasoning.default_effort)
        ? reasoning.default_effort
        : null;
    const isFree = inputPricePerMillion === 0 && outputPricePerMillion === 0;

    return {
        id: `openrouter:${id}`,
        provider: 'openrouter',
        providerLabel: familyMetadata.label,
        providerShortName: familyMetadata.shortName,
        model: id,
        label,
        availability: 'active',
        releasedAt,
        estimatedCostPerQueryLabel: `${formatUsd(inputPricePerMillion)} / ${formatUsd(outputPricePerMillion)} per 1M`,
        costNote: 'Live OpenRouter catalog pricing; actual routed provider pricing can vary.',
        catalogSource: 'openrouter-live',
        contextLength: asFiniteNumber(value.context_length),
        inputPricePerMillion,
        outputPricePerMillion,
        supportedParameters,
        supportsStructuredOutput: supportedParameters.includes('structured_outputs'),
        supportsTools: supportedParameters.includes('tools') && supportedParameters.includes('tool_choice'),
        supportsReasoning: supportedParameters.includes('reasoning') || supportedParameters.includes('reasoning_effort'),
        reasoningEfforts: reasoningEfforts as AiReasoningEffort[],
        defaultReasoningEffort,
        reasoningMandatory: reasoning.mandatory === true,
        supportsReasoningMaxTokens: reasoning.supports_max_tokens === true,
        isFree,
        expirationDate: normalizeExpirationDate(value.expiration_date),
    };
};

export const normalizeOpenRouterCatalogResponse = (
    value: unknown,
    now = new Date(),
): OpenRouterCatalogModel[] => {
    const root = isRecord(value) ? value : {};
    const list = Array.isArray(root.data) ? root.data : [];
    const seen = new Set<string>();

    return list.flatMap((entry) => {
        if (!isTravelFlowCompatibleOpenRouterModel(entry, now) || !isRecord(entry)) return [];
        const normalized = normalizeOpenRouterModel(entry);
        if (!normalized || seen.has(normalized.id)) return [];
        seen.add(normalized.id);
        return [normalized];
    });
};

export const mergeAiModelCatalogs = (
    staticModels: AiModelCatalogItem[],
    liveModels: OpenRouterCatalogModel[],
): AiModelCatalogItem[] => {
    const byId = new Map(liveModels.map((model) => [model.id, model as AiModelCatalogItem]));
    staticModels.forEach((model) => byId.set(model.id, { ...byId.get(model.id), ...model }));
    return Array.from(byId.values());
};

export const isAiModelOlderThanMonths = (
    model: Pick<AiModelCatalogItem, 'releasedAt'>,
    months: number,
    now = new Date(),
): boolean => {
    const releasedAt = new Date(`${model.releasedAt}T00:00:00Z`);
    if (Number.isNaN(releasedAt.getTime())) return false;
    const threshold = new Date(now);
    threshold.setUTCMonth(threshold.getUTCMonth() - Math.max(1, Math.round(months)));
    return releasedAt.getTime() < threshold.getTime();
};

export const fetchOpenRouterCatalog = async (
    apiKey?: string,
    fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterCatalogModel[]> => {
    const response = await fetchImpl(apiKey ? OPENROUTER_USER_MODELS_URL : OPENROUTER_PUBLIC_MODELS_URL, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    if (!response.ok) {
        throw new Error(`OpenRouter model catalog request failed (${response.status}).`);
    }
    return normalizeOpenRouterCatalogResponse(await response.json());
};
