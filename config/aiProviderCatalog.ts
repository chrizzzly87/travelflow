export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'perplexity' | 'qwen';

export interface AiProviderMetadata {
    id: AiProviderId;
    label: string;
    shortName: string;
    shortCode: string;
}

export interface AiProviderDisplayMetadata {
    id: AiProviderId | 'unknown';
    label: string;
    shortName: string;
    shortCode: string;
    isKnown: boolean;
}

const AI_PROVIDER_METADATA: Record<AiProviderId, AiProviderMetadata> = {
    gemini: {
        id: 'gemini',
        label: 'Google Gemini',
        shortName: 'Gemini',
        shortCode: 'GM',
    },
    openai: {
        id: 'openai',
        label: 'OpenAI',
        shortName: 'OpenAI',
        shortCode: 'OAI',
    },
    anthropic: {
        id: 'anthropic',
        label: 'Anthropic',
        shortName: 'Anthropic',
        shortCode: 'ANT',
    },
    openrouter: {
        id: 'openrouter',
        label: 'OpenRouter',
        shortName: 'OpenRouter',
        shortCode: 'OR',
    },
    perplexity: {
        id: 'perplexity',
        label: 'Perplexity',
        shortName: 'PPLX',
        shortCode: 'PPLX',
    },
    qwen: {
        id: 'qwen',
        label: 'Qwen',
        shortName: 'Qwen',
        shortCode: 'QWEN',
    },
};

const PROVIDER_SORT_ORDER: Record<AiProviderId, number> = {
    gemini: 0,
    openai: 1,
    anthropic: 2,
    perplexity: 3,
    qwen: 4,
    openrouter: 5,
};

const isAiProviderId = (value: string): value is AiProviderId => (
    Object.prototype.hasOwnProperty.call(AI_PROVIDER_METADATA, value)
);

const toTitleCase = (value: string): string => (
    value
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ')
);

const normalizeProvider = (provider: string | null | undefined): string => (
    typeof provider === 'string' ? provider.trim().toLowerCase() : ''
);

const toUnknownMetadata = (provider: string | null | undefined): AiProviderDisplayMetadata => {
    const normalized = normalizeProvider(provider);
    if (!normalized || normalized === 'other') {
        return {
            id: 'unknown',
            label: 'Other',
            shortName: 'Other',
            shortCode: 'OTHER',
            isKnown: false,
        };
    }

    const prettified = toTitleCase(normalized);
    const shortCode = prettified
        .split(/\s+/)
        .map((token) => token.slice(0, 1))
        .join('')
        .toUpperCase()
        .slice(0, 4) || 'AI';

    return {
        id: 'unknown',
        label: prettified,
        shortName: prettified,
        shortCode,
        isKnown: false,
    };
};

export const getAiProviderMetadata = (provider: string | null | undefined): AiProviderDisplayMetadata => {
    const normalized = normalizeProvider(provider);
    if (isAiProviderId(normalized)) {
        return {
            ...AI_PROVIDER_METADATA[normalized],
            isKnown: true,
        };
    }
    return toUnknownMetadata(normalized);
};

export const getAiProviderSortOrder = (provider: string | null | undefined): number => {
    const normalized = normalizeProvider(provider);
    if (isAiProviderId(normalized)) return PROVIDER_SORT_ORDER[normalized];
    return Number.MAX_SAFE_INTEGER;
};
