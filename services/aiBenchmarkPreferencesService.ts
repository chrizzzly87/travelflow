export type BenchmarkDateInputMode = 'exact' | 'flex';
export type BenchmarkFlexWindow = 'spring' | 'summer' | 'autumn' | 'winter' | 'shoulder';
export type BenchmarkTravelerSetup = 'solo' | 'couple' | 'friends' | 'family';
export type BenchmarkTripStyleMask = 'everything_except_remote_work' | 'culture_focused' | 'food_focused';
export type BenchmarkTransportMask = 'automatic' | 'plane' | 'train' | 'camper';
export type BenchmarkPresetKind = 'system' | 'custom';

export interface BenchmarkMaskScenario {
    destinations: string;
    dateInputMode: BenchmarkDateInputMode;
    startDate: string | null;
    endDate: string | null;
    flexWeeks: number;
    flexWindow: BenchmarkFlexWindow;
    budget: string;
    pace: string;
    specificCities: string;
    notes: string;
    numCities: number | null;
    roundTrip: boolean;
    routeLock: boolean;
    travelerSetup: BenchmarkTravelerSetup;
    tripStyleMask: BenchmarkTripStyleMask;
    transportMask: BenchmarkTransportMask;
}

export interface BenchmarkPresetConfig {
    id: string;
    name: string;
    description: string;
    kind: BenchmarkPresetKind;
    scenario: BenchmarkMaskScenario;
}

export interface BenchmarkPreferencesPayload {
    modelTargets: string[];
    presets: BenchmarkPresetConfig[];
    selectedPresetId: string;
}

export const BENCHMARK_DEFAULT_MODEL_IDS = [
    'gemini:gemini-3.1-pro-preview',
    'gemini:gemini-3-pro-preview',
    'openai:gpt-5.2-pro',
    'anthropic:claude-sonnet-4.6',
    'perplexity:perplexity/sonar',
    'qwen:qwen/qwen3.5-plus-02-15',
];

export const DEFAULT_BENCHMARK_MASK_SCENARIO: BenchmarkMaskScenario = {
    destinations: 'Japan',
    dateInputMode: 'exact',
    startDate: null,
    endDate: null,
    flexWeeks: 2,
    flexWindow: 'shoulder',
    budget: 'Medium',
    pace: 'Balanced',
    specificCities: '',
    notes: '',
    numCities: null,
    roundTrip: true,
    routeLock: false,
    travelerSetup: 'solo',
    tripStyleMask: 'everything_except_remote_work',
    transportMask: 'automatic',
};

const SYSTEM_PRESET_SEED: Array<{
    id: string;
    name: string;
    description: string;
    scenario: Partial<BenchmarkMaskScenario>;
}> = [
    {
        id: 'system-southeast-asia-loop',
        name: 'Southeast Asia Loop',
        description: 'Backpacking loop: Thailand -> Cambodia -> Vietnam -> Laos -> Thailand.',
        scenario: {
            destinations: 'Thailand, Cambodia, Vietnam, Laos, Thailand',
            dateInputMode: 'flex',
            flexWeeks: 4,
            flexWindow: 'shoulder',
            budget: 'Medium',
            pace: 'Balanced',
            notes: 'street food, hostels, temples, overnight buses',
            roundTrip: true,
            routeLock: false,
        },
    },
    {
        id: 'system-northern-germany',
        name: 'Northern Germany',
        description: 'Short north test route: Hamburg, Husum, Flensburg.',
        scenario: {
            destinations: 'Hamburg, Husum, Flensburg',
            dateInputMode: 'flex',
            flexWeeks: 1,
            flexWindow: 'summer',
            budget: 'Medium',
            pace: 'Relaxed',
            notes: 'harbor walks, coastal towns, train routes',
            roundTrip: true,
            routeLock: false,
        },
    },
    {
        id: 'system-japan-classic',
        name: 'Japan Classic',
        description: 'Compact single-country baseline for quick model comparison.',
        scenario: {
            destinations: 'Japan',
            dateInputMode: 'flex',
            flexWeeks: 2,
            flexWindow: 'shoulder',
            budget: 'Medium',
            pace: 'Balanced',
            notes: '',
            roundTrip: true,
            routeLock: false,
        },
    },
];

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const FLEX_WINDOWS: BenchmarkFlexWindow[] = ['spring', 'summer', 'autumn', 'winter', 'shoulder'];
const TRAVELER_SETUPS: BenchmarkTravelerSetup[] = ['solo', 'couple', 'friends', 'family'];
const TRIP_STYLE_MASKS: BenchmarkTripStyleMask[] = ['everything_except_remote_work', 'culture_focused', 'food_focused'];
const TRANSPORT_MASKS: BenchmarkTransportMask[] = ['automatic', 'plane', 'train', 'camper'];
const DATE_INPUT_MODES: BenchmarkDateInputMode[] = ['exact', 'flex'];

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeDateOrNull = (value: unknown): string | null => {
    const dateValue = normalizeText(value);
    return DATE_ONLY_REGEX.test(dateValue) ? dateValue : null;
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => (
    typeof value === 'boolean' ? value : fallback
);

const normalizeNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const rounded = Math.round(parsed);
    return rounded > 0 ? rounded : null;
};

const normalizeFlexWeeks = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(12, Math.round(parsed)));
};

const normalizeAllowed = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
    const token = normalizeText(value) as T;
    return allowed.includes(token) ? token : fallback;
};

export const withScenarioDates = (
    scenario: BenchmarkMaskScenario,
    defaultStartDate?: string | null,
    defaultEndDate?: string | null,
): BenchmarkMaskScenario => {
    const startDate = normalizeDateOrNull(scenario.startDate) || normalizeDateOrNull(defaultStartDate);
    const endDate = normalizeDateOrNull(scenario.endDate) || normalizeDateOrNull(defaultEndDate);
    return {
        ...scenario,
        startDate,
        endDate,
    };
};

export const createSystemBenchmarkPresets = (
    defaultStartDate?: string | null,
    defaultEndDate?: string | null,
): BenchmarkPresetConfig[] => {
    return SYSTEM_PRESET_SEED.map((seed) => ({
        id: seed.id,
        name: seed.name,
        description: seed.description,
        kind: 'system',
        scenario: withScenarioDates(
            {
                ...DEFAULT_BENCHMARK_MASK_SCENARIO,
                ...seed.scenario,
            },
            defaultStartDate,
            defaultEndDate,
        ),
    }));
};

export const normalizeModelTargetIds = (
    value: unknown,
    options?: {
        allowedModelIds?: Set<string>;
        fallbackModelIds?: string[];
    },
): string[] => {
    const list = Array.isArray(value) ? value : [];
    const deduped = list
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
        .filter((entry, index, array) => array.indexOf(entry) === index);

    const filtered = options?.allowedModelIds
        ? deduped.filter((entry) => options.allowedModelIds?.has(entry))
        : deduped;

    if (filtered.length > 0) return filtered;
    const fallback = options?.fallbackModelIds?.filter(Boolean) || BENCHMARK_DEFAULT_MODEL_IDS;
    if (options?.allowedModelIds) {
        const allowedFallback = fallback.filter((entry) => options.allowedModelIds?.has(entry));
        if (allowedFallback.length > 0) return allowedFallback;
    }
    return fallback.length > 0 ? fallback : [...BENCHMARK_DEFAULT_MODEL_IDS];
};

export const normalizeBenchmarkMaskScenario = (
    value: unknown,
    options?: { fallback?: BenchmarkMaskScenario; defaultStartDate?: string | null; defaultEndDate?: string | null },
): BenchmarkMaskScenario => {
    const fallback = options?.fallback || DEFAULT_BENCHMARK_MASK_SCENARIO;
    const typed = isRecord(value) ? value : {};

    const normalized: BenchmarkMaskScenario = {
        destinations: normalizeText(typed.destinations) || fallback.destinations,
        dateInputMode: normalizeAllowed(typed.dateInputMode, DATE_INPUT_MODES, fallback.dateInputMode),
        startDate: normalizeDateOrNull(typed.startDate) || fallback.startDate,
        endDate: normalizeDateOrNull(typed.endDate) || fallback.endDate,
        flexWeeks: normalizeFlexWeeks(typed.flexWeeks, fallback.flexWeeks),
        flexWindow: normalizeAllowed(typed.flexWindow, FLEX_WINDOWS, fallback.flexWindow),
        budget: normalizeText(typed.budget) || fallback.budget,
        pace: normalizeText(typed.pace) || fallback.pace,
        specificCities: normalizeText(typed.specificCities),
        notes: normalizeText(typed.notes),
        numCities: normalizeNumberOrNull(typed.numCities),
        roundTrip: normalizeBoolean(typed.roundTrip, fallback.roundTrip),
        routeLock: normalizeBoolean(typed.routeLock, fallback.routeLock),
        travelerSetup: normalizeAllowed(typed.travelerSetup, TRAVELER_SETUPS, fallback.travelerSetup),
        tripStyleMask: normalizeAllowed(typed.tripStyleMask, TRIP_STYLE_MASKS, fallback.tripStyleMask),
        transportMask: normalizeAllowed(typed.transportMask, TRANSPORT_MASKS, fallback.transportMask),
    };

    return withScenarioDates(normalized, options?.defaultStartDate, options?.defaultEndDate);
};

export const normalizeBenchmarkPresetConfigs = (
    value: unknown,
    options?: {
        fallbackPresets?: BenchmarkPresetConfig[];
        defaultStartDate?: string | null;
        defaultEndDate?: string | null;
    },
): BenchmarkPresetConfig[] => {
    const fallbackPresets = options?.fallbackPresets || createSystemBenchmarkPresets(options?.defaultStartDate, options?.defaultEndDate);
    const list = Array.isArray(value) ? value : [];

    const parsed = list
        .map((entry): BenchmarkPresetConfig | null => {
            if (!isRecord(entry)) return null;
            const id = normalizeText(entry.id);
            const name = normalizeText(entry.name);
            if (!id || !name) return null;
            const kind = normalizeAllowed(entry.kind, ['system', 'custom'], 'custom');
            const fallbackScenario = fallbackPresets.find((preset) => preset.id === id)?.scenario || DEFAULT_BENCHMARK_MASK_SCENARIO;
            const scenario = normalizeBenchmarkMaskScenario(entry.scenario, {
                fallback: fallbackScenario,
                defaultStartDate: options?.defaultStartDate,
                defaultEndDate: options?.defaultEndDate,
            });
            return {
                id,
                name,
                description: normalizeText(entry.description),
                kind,
                scenario,
            };
        })
        .filter((entry): entry is BenchmarkPresetConfig => Boolean(entry))
        .filter((entry, index, array) => array.findIndex((candidate) => candidate.id === entry.id) === index);

    return parsed.length > 0 ? parsed : fallbackPresets;
};

export const normalizeBenchmarkPreferencesPayload = (
    value: unknown,
    options?: {
        fallbackModelIds?: string[];
        fallbackPresets?: BenchmarkPresetConfig[];
        defaultStartDate?: string | null;
        defaultEndDate?: string | null;
        allowedModelIds?: Set<string>;
    },
): BenchmarkPreferencesPayload => {
    const typed = isRecord(value) ? value : {};
    const fallbackPresets = options?.fallbackPresets || createSystemBenchmarkPresets(options?.defaultStartDate, options?.defaultEndDate);
    const fallbackModelIds = options?.fallbackModelIds || BENCHMARK_DEFAULT_MODEL_IDS;
    const presets = normalizeBenchmarkPresetConfigs(typed.presets, {
        fallbackPresets,
        defaultStartDate: options?.defaultStartDate,
        defaultEndDate: options?.defaultEndDate,
    });
    const modelTargets = normalizeModelTargetIds(typed.modelTargets, {
        allowedModelIds: options?.allowedModelIds,
        fallbackModelIds,
    });
    const selectedPresetIdRaw = normalizeText(typed.selectedPresetId);
    const selectedPresetId = presets.some((preset) => preset.id === selectedPresetIdRaw)
        ? selectedPresetIdRaw
        : presets[0]?.id || fallbackPresets[0]?.id || '';

    return {
        modelTargets,
        presets,
        selectedPresetId,
    };
};
