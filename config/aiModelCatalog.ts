export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export type AiModelAvailability = 'active' | 'planned';

export interface AiModelCatalogItem {
    id: string;
    provider: AiProviderId;
    providerLabel: string;
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

export const AI_MODEL_CATALOG: AiModelCatalogItem[] = [
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
        id: 'anthropic:claude-sonnet-4.5',
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        model: 'claude-sonnet-4.5',
        label: 'Claude Sonnet 4.5',
        availability: 'active',
        releasedAt: '2025-12-10',
        isPreferred: true,
        estimatedCostPerQueryLabel: '~$0.05 - $0.14',
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
];

const PROVIDER_SORT_ORDER: Record<AiProviderId, number> = {
    gemini: 0,
    openai: 1,
    anthropic: 2,
};

const toReleaseTs = (releasedAt: string): number => {
    const parsed = Date.parse(releasedAt);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const sortAiModels = (items: AiModelCatalogItem[]): AiModelCatalogItem[] => {
    return [...items].sort((left, right) => {
        const providerDelta = (PROVIDER_SORT_ORDER[left.provider] ?? 99) - (PROVIDER_SORT_ORDER[right.provider] ?? 99);
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
