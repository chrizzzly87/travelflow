import {
    type AiProviderId,
    getAiProviderMetadata,
    getAiProviderSortOrder,
} from './aiProviderCatalog.ts';

export type AiModelAvailability = 'active' | 'planned';

export interface AiModelCatalogItem {
    id: string;
    provider: AiProviderId;
    providerLabel: string;
    providerShortName: string;
    model: string;
    label: string;
    availability: AiModelAvailability;
    releasedAt: string;
    isPreferred?: boolean;
    isCurrentRuntime?: boolean;
    estimatedCostPerQueryLabel: string;
    costNote?: string;
}

export const CURRENT_RUNTIME_MODEL_ID = 'gemini-3-pro-preview';

export const DEFAULT_CREATE_TRIP_MODEL_ID = `${'gemini'}:${CURRENT_RUNTIME_MODEL_ID}`;

const ESTIMATE_NOTE = 'Estimate for one classic itinerary generation; real cost varies by prompt/output size.';

type RawAiModelCatalogItem = Omit<AiModelCatalogItem, 'providerLabel' | 'providerShortName'> & {
    providerLabel?: string;
    providerShortName?: string;
};

const RAW_AI_MODEL_CATALOG: RawAiModelCatalogItem[] = [
    {
        id: 'gemini:gemini-2.5-flash',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        model: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        availability: 'active',
        releasedAt: '2025-05-01',
        estimatedCostPerQueryLabel: '~$0.01 - $0.03',
        costNote: ESTIMATE_NOTE,
    },
    {
        id: 'gemini:gemini-2.5-flash-lite',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        model: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash Lite',
        availability: 'active',
        releasedAt: '2025-09-15',
        estimatedCostPerQueryLabel: '~$0.003 - $0.01',
        costNote: ESTIMATE_NOTE,
    },
    {
        id: 'gemini:gemini-2.5-pro',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        model: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        availability: 'active',
        releasedAt: '2025-05-01',
        estimatedCostPerQueryLabel: '~$0.04 - $0.12',
        costNote: ESTIMATE_NOTE,
    },
    {
        id: 'gemini:gemini-3-flash-preview',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        model: 'gemini-3-flash-preview',
        label: 'Gemini 3 Flash Preview',
        availability: 'active',
        releasedAt: '2026-01-10',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.01 - $0.04',
        costNote: ESTIMATE_NOTE,
    },
    {
        id: 'gemini:gemini-3-pro-preview',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        model: 'gemini-3-pro-preview',
        label: 'Gemini 3 Pro Preview',
        availability: 'active',
        releasedAt: '2026-01-10',
        isPreferred: true,
        isCurrentRuntime: true,
        estimatedCostPerQueryLabel: '~$0.05 - $0.15',
        costNote: ESTIMATE_NOTE,
    },
    {
        id: 'gemini:gemini-3.1-pro-preview',
        provider: 'gemini',
        providerLabel: 'Google Gemini',
        model: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        availability: 'active',
        releasedAt: '2026-02-18',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.06 - $0.18',
        costNote: ESTIMATE_NOTE,
    },
    {
        id: 'openai:gpt-5-nano',
        provider: 'openai',
        providerLabel: 'OpenAI',
        model: 'gpt-5-nano',
        label: 'GPT-5 Nano',
        availability: 'active',
        releasedAt: '2025-11-01',
        estimatedCostPerQueryLabel: '~$0.01 - $0.03',
        costNote: 'Requires OPENAI_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'openai:gpt-5-mini',
        provider: 'openai',
        providerLabel: 'OpenAI',
        model: 'gpt-5-mini',
        label: 'GPT-5 Mini',
        availability: 'active',
        releasedAt: '2025-10-15',
        estimatedCostPerQueryLabel: '~$0.03 - $0.08',
        costNote: 'Requires OPENAI_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'openai:gpt-5.2',
        provider: 'openai',
        providerLabel: 'OpenAI',
        model: 'gpt-5.2',
        label: 'GPT-5.2',
        availability: 'active',
        releasedAt: '2026-01-20',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.06 - $0.20',
        costNote: 'Requires OPENAI_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'openai:gpt-5.2-pro',
        provider: 'openai',
        providerLabel: 'OpenAI',
        model: 'gpt-5.2-pro',
        label: 'GPT-5.2 Pro',
        availability: 'active',
        releasedAt: '2026-02-19',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.10 - $0.30',
        costNote: 'Requires OPENAI_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'anthropic:claude-haiku-4.5',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        model: 'claude-haiku-4.5',
        label: 'Claude Haiku 4.5',
        availability: 'active',
        releasedAt: '2025-10-01',
        estimatedCostPerQueryLabel: '~$0.01 - $0.04',
        costNote: 'Requires ANTHROPIC_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'anthropic:claude-sonnet-4.5',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        model: 'claude-sonnet-4.5',
        label: 'Claude Sonnet 4.5',
        availability: 'active',
        releasedAt: '2025-12-10',
        estimatedCostPerQueryLabel: '~$0.05 - $0.14',
        costNote: 'Requires ANTHROPIC_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'anthropic:claude-sonnet-4.6',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        model: 'claude-sonnet-4.6',
        label: 'Claude Sonnet 4.6',
        availability: 'active',
        releasedAt: '2026-02-17',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.06 - $0.16',
        costNote: 'Requires ANTHROPIC_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'anthropic:claude-opus-4.6',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        model: 'claude-opus-4.6',
        label: 'Claude Opus 4.6',
        availability: 'active',
        releasedAt: '2026-01-25',
        estimatedCostPerQueryLabel: '~$0.10 - $0.30',
        costNote: 'Requires ANTHROPIC_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'anthropic:claude-opus-4.1',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        model: 'claude-opus-4.1',
        label: 'Claude Opus 4.1',
        availability: 'active',
        releasedAt: '2025-08-05',
        estimatedCostPerQueryLabel: '~$0.08 - $0.25',
        costNote: 'Requires ANTHROPIC_API_KEY on server. Exact pricing depends on active provider account pricing.',
    },
    {
        id: 'perplexity:perplexity/sonar',
        provider: 'perplexity',
        model: 'perplexity/sonar',
        label: 'Sonnar',
        availability: 'active',
        releasedAt: '2026-02-21',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.004 - $0.02',
        costNote: 'Requires OPENROUTER_API_KEY on server. Perplexity benchmark calls are routed via OpenRouter for unified execution.',
    },
    {
        id: 'perplexity:perplexity/sonar-pro',
        provider: 'perplexity',
        model: 'perplexity/sonar-pro',
        label: 'Sonnar Pro',
        availability: 'active',
        releasedAt: '2026-02-21',
        estimatedCostPerQueryLabel: '~$0.01 - $0.05',
        costNote: 'Requires OPENROUTER_API_KEY on server. Perplexity benchmark calls are routed via OpenRouter for unified execution.',
    },
    {
        id: 'qwen:qwen/qwen3.5-plus-02-15',
        provider: 'qwen',
        model: 'qwen/qwen3.5-plus-02-15',
        label: 'Qwen 3.5 Plus',
        availability: 'active',
        releasedAt: '2026-02-22',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.003 - $0.015',
        costNote: 'Requires OPENROUTER_API_KEY on server. Qwen benchmark calls are routed via OpenRouter for unified execution.',
    },
    {
        id: 'qwen:qwen/qwen3.5-397b-a17b',
        provider: 'qwen',
        model: 'qwen/qwen3.5-397b-a17b',
        label: 'Qwen 3.5',
        availability: 'active',
        releasedAt: '2026-02-22',
        estimatedCostPerQueryLabel: '~$0.002 - $0.01',
        costNote: 'Requires OPENROUTER_API_KEY on server. Qwen benchmark calls are routed via OpenRouter for unified execution.',
    },
    {
        id: 'openrouter:openrouter/free',
        provider: 'openrouter',
        providerLabel: 'OpenRouter (Free)',
        model: 'openrouter/free',
        label: 'OpenRouter Free Router',
        availability: 'active',
        releasedAt: '2024-12-01',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.00',
        costNote: 'Requires OPENROUTER_API_KEY on server. Free-tier routing and limits vary by provider availability.',
    },
    {
        id: 'openrouter:openai/gpt-oss-20b:free',
        provider: 'openrouter',
        providerLabel: 'OpenRouter (Free)',
        model: 'openai/gpt-oss-20b:free',
        label: 'GPT-OSS 20B (Free)',
        availability: 'active',
        releasedAt: '2025-08-05',
        estimatedCostPerQueryLabel: '~$0.00',
        costNote: 'Requires OPENROUTER_API_KEY on server. Free-tier routing and limits vary by provider availability.',
    },
    {
        id: 'openrouter:qwen/qwen3-coder:free',
        provider: 'openrouter',
        providerLabel: 'OpenRouter (Free)',
        model: 'qwen/qwen3-coder:free',
        label: 'Qwen3 Coder (Free)',
        availability: 'active',
        releasedAt: '2025-07-10',
        estimatedCostPerQueryLabel: '~$0.00',
        costNote: 'Requires OPENROUTER_API_KEY on server. Free-tier routing and limits vary by provider availability.',
    },
    {
        id: 'openrouter:z-ai/glm-5',
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        model: 'z-ai/glm-5',
        label: 'GLM 5',
        availability: 'active',
        releasedAt: '2026-02-11',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.01 - $0.04',
        costNote: 'Requires OPENROUTER_API_KEY on server. OpenRouter pricing and routing can vary by account and region.',
    },
    {
        id: 'openrouter:deepseek/deepseek-v3.2',
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        model: 'deepseek/deepseek-v3.2',
        label: 'DeepSeek V3.2',
        availability: 'active',
        releasedAt: '2025-12-01',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.002 - $0.01',
        costNote: 'Requires OPENROUTER_API_KEY on server. OpenRouter pricing and routing can vary by account and region.',
    },
    {
        id: 'openrouter:x-ai/grok-4.1-fast',
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        model: 'x-ai/grok-4.1-fast',
        label: 'Grok 4.1 Fast',
        availability: 'active',
        releasedAt: '2025-11-19',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.003 - $0.02',
        costNote: 'Requires OPENROUTER_API_KEY on server. OpenRouter pricing and routing can vary by account and region.',
    },
    {
        id: 'openrouter:minimax/minimax-m2.5',
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        model: 'minimax/minimax-m2.5',
        label: 'MiniMax M2.5',
        availability: 'active',
        releasedAt: '2026-02-12',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.004 - $0.02',
        costNote: 'Requires OPENROUTER_API_KEY on server. OpenRouter pricing and routing can vary by account and region.',
    },
    {
        id: 'openrouter:moonshotai/kimi-k2.5',
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        model: 'moonshotai/kimi-k2.5',
        label: 'Kimi K2.5',
        availability: 'active',
        releasedAt: '2026-01-27',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.006 - $0.03',
        costNote: 'Requires OPENROUTER_API_KEY on server. OpenRouter pricing and routing can vary by account and region.',
    },
];

export const AI_MODEL_CATALOG: AiModelCatalogItem[] = RAW_AI_MODEL_CATALOG.map((item) => {
    const providerMeta = getAiProviderMetadata(item.provider);
    return {
        ...item,
        providerLabel: item.providerLabel || providerMeta.label,
        providerShortName: item.providerShortName || providerMeta.shortName,
    };
});

const toReleaseTs = (releasedAt: string): number => {
    const parsed = Date.parse(releasedAt);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const sortAiModels = (items: AiModelCatalogItem[]): AiModelCatalogItem[] => {
    return [...items].sort((left, right) => {
        const providerDelta = getAiProviderSortOrder(left.provider) - getAiProviderSortOrder(right.provider);
        if (providerDelta !== 0) return providerDelta;

        const releaseDelta = toReleaseTs(right.releasedAt) - toReleaseTs(left.releasedAt);
        if (releaseDelta !== 0) return releaseDelta;

        if (left.isCurrentRuntime && !right.isCurrentRuntime) return -1;
        if (!left.isCurrentRuntime && right.isCurrentRuntime) return 1;
        if (left.isPreferred && !right.isPreferred) return -1;
        if (!left.isPreferred && right.isPreferred) return 1;

        return left.label.localeCompare(right.label);
    });
};

export const getAiModelById = (id: string): AiModelCatalogItem | null => {
    return AI_MODEL_CATALOG.find((item) => item.id === id) || null;
};

export const getDefaultCreateTripModel = (): AiModelCatalogItem => {
    return (
        getAiModelById(DEFAULT_CREATE_TRIP_MODEL_ID)
        || AI_MODEL_CATALOG.find((item) => item.isCurrentRuntime)
        || AI_MODEL_CATALOG[0]
    );
};

export const getCurrentRuntimeModel = (): AiModelCatalogItem | null => {
    return AI_MODEL_CATALOG.find((item) => item.model === CURRENT_RUNTIME_MODEL_ID) || null;
};

export const groupAiModelsByProvider = (items: AiModelCatalogItem[]) => {
    return sortAiModels(items).reduce<Record<string, AiModelCatalogItem[]>>((acc, item) => {
        if (!acc[item.providerLabel]) {
            acc[item.providerLabel] = [];
        }
        acc[item.providerLabel].push(item);
        return acc;
    }, {});
};
