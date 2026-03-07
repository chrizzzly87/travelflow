import type { TripGenerationInputSnapshot } from '../types';
import {
    DEFAULT_BENCHMARK_MASK_SCENARIO,
    normalizeBenchmarkMaskScenario,
    type BenchmarkMaskScenario,
} from './aiBenchmarkPreferencesService';

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asDateOnly = (value: unknown): string | null => {
    const text = asText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const asBoolean = (value: unknown, fallback: boolean): boolean => (
    typeof value === 'boolean' ? value : fallback
);

const asRecord = (value: unknown): Record<string, unknown> | null => (
    isRecord(value) ? value : null
);

const asPositiveIntegerOrNull = (value: unknown): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const rounded = Math.round(parsed);
    return rounded > 0 ? rounded : null;
};

const normalizeDestinations = (value: string): string => (
    value
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((entry, index, entries) => entries.indexOf(entry) === index)
        .join(', ')
);

const encodeBase64Url = (value: string): string => {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
        const bytes = new TextEncoder().encode(value);
        let binary = '';
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
    const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding?: string) => { toString: (encoding?: string) => string } } }).Buffer;
    if (bufferCtor) {
        const buffer = bufferCtor.from(value, 'utf8');
        return buffer.toString('base64url');
    }
    return '';
};

const decodeBase64Url = (value: string): string | null => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    try {
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
            const binary = window.atob(padded);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        }
        const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding?: string) => { toString: (encoding?: string) => string } } }).Buffer;
        if (!bufferCtor) return null;
        return bufferCtor.from(value, 'base64url').toString('utf8');
    } catch {
        return null;
    }
};

const buildClassicScenario = (snapshot: TripGenerationInputSnapshot): BenchmarkMaskScenario => {
    const payload = isRecord(snapshot.payload) ? snapshot.payload : {};
    const options = isRecord(payload.options) ? payload.options : {};
    const destinationPrompt = asText(payload.destinationPrompt);
    const fallbackDestinations = asText(snapshot.destinationLabel) || destinationPrompt || DEFAULT_BENCHMARK_MASK_SCENARIO.destinations;
    return normalizeBenchmarkMaskScenario({
        ...DEFAULT_BENCHMARK_MASK_SCENARIO,
        destinations: normalizeDestinations(fallbackDestinations),
        startDate: asDateOnly(snapshot.startDate),
        endDate: asDateOnly(snapshot.endDate),
        budget: asText(options.budget) || DEFAULT_BENCHMARK_MASK_SCENARIO.budget,
        pace: asText(options.pace) || DEFAULT_BENCHMARK_MASK_SCENARIO.pace,
        specificCities: asText(options.specificCities),
        notes: asText(options.notes),
        numCities: asPositiveIntegerOrNull(options.numCities),
        roundTrip: asBoolean(options.roundTrip, true),
    });
};

const buildWizardScenario = (snapshot: TripGenerationInputSnapshot): BenchmarkMaskScenario => {
    const payload = isRecord(snapshot.payload) ? snapshot.payload : {};
    const options = isRecord(payload.options) ? payload.options : {};
    const countries = Array.isArray(options.countries)
        ? options.countries.map((entry) => asText(entry)).filter(Boolean)
        : [];
    const destinations = countries.join(', ') || asText(snapshot.destinationLabel) || DEFAULT_BENCHMARK_MASK_SCENARIO.destinations;
    return normalizeBenchmarkMaskScenario({
        ...DEFAULT_BENCHMARK_MASK_SCENARIO,
        destinations: normalizeDestinations(destinations),
        startDate: asDateOnly(snapshot.startDate),
        endDate: asDateOnly(snapshot.endDate),
        budget: asText(options.budget) || DEFAULT_BENCHMARK_MASK_SCENARIO.budget,
        pace: asText(options.pace) || DEFAULT_BENCHMARK_MASK_SCENARIO.pace,
        notes: asText(options.notes),
        roundTrip: asBoolean(options.roundTrip, true),
    });
};

const buildSurpriseScenario = (snapshot: TripGenerationInputSnapshot): BenchmarkMaskScenario => {
    const payload = isRecord(snapshot.payload) ? snapshot.payload : {};
    const options = isRecord(payload.options) ? payload.options : {};
    const destination = asText(options.country) || asText(snapshot.destinationLabel) || DEFAULT_BENCHMARK_MASK_SCENARIO.destinations;
    return normalizeBenchmarkMaskScenario({
        ...DEFAULT_BENCHMARK_MASK_SCENARIO,
        destinations: normalizeDestinations(destination),
        startDate: asDateOnly(snapshot.startDate),
        endDate: asDateOnly(snapshot.endDate),
        notes: asText(options.notes),
        roundTrip: asBoolean(options.roundTrip, true),
    });
};

export const buildBenchmarkMaskScenarioFromGenerationSnapshot = (
    snapshot: TripGenerationInputSnapshot | null | undefined,
): BenchmarkMaskScenario | null => {
    if (!snapshot) return null;
    if (snapshot.flow === 'classic') return buildClassicScenario(snapshot);
    if (snapshot.flow === 'wizard') return buildWizardScenario(snapshot);
    if (snapshot.flow === 'surprise') return buildSurpriseScenario(snapshot);
    return null;
};

export interface BenchmarkScenarioImportPayload {
    scenario: BenchmarkMaskScenario;
    flow: TripGenerationInputSnapshot['flow'];
    createdAt: string;
    source: 'trip_info' | 'admin_trip_drawer';
    tripId?: string | null;
    inputPayload?: Record<string, unknown> | null;
    inputSnapshot?: TripGenerationInputSnapshot | null;
}

export const encodeBenchmarkScenarioImportPayload = (
    payload: BenchmarkScenarioImportPayload,
): string => encodeBase64Url(JSON.stringify(payload));

export const decodeBenchmarkScenarioImportPayload = (
    encoded: string,
): BenchmarkScenarioImportPayload | null => {
    const decoded = decodeBase64Url(encoded.trim());
    if (!decoded) return null;
    try {
        const parsed = JSON.parse(decoded);
        if (!isRecord(parsed)) return null;
        if (!isRecord(parsed.scenario)) return null;
        const flow = asText(parsed.flow);
        if (flow !== 'classic' && flow !== 'wizard' && flow !== 'surprise') return null;
        const source = asText(parsed.source);
        if (source !== 'trip_info' && source !== 'admin_trip_drawer') return null;
        const rawInputSnapshot = asRecord(parsed.inputSnapshot);
        const parsedSnapshotPayload = rawInputSnapshot ? asRecord(rawInputSnapshot.payload) : null;
        const parsedSnapshotFlow = rawInputSnapshot ? asText(rawInputSnapshot.flow) : null;
        const parsedSnapshotCreatedAt = rawInputSnapshot ? asText(rawInputSnapshot.createdAt) : null;
        const parsedInputSnapshot: TripGenerationInputSnapshot | null = (
            parsedSnapshotPayload
            && (parsedSnapshotFlow === 'classic' || parsedSnapshotFlow === 'wizard' || parsedSnapshotFlow === 'surprise')
        ) ? {
            flow: parsedSnapshotFlow,
            destinationLabel: asText(rawInputSnapshot?.destinationLabel) || undefined,
            startDate: asDateOnly(rawInputSnapshot?.startDate) || undefined,
            endDate: asDateOnly(rawInputSnapshot?.endDate) || undefined,
            payload: parsedSnapshotPayload,
            createdAt: parsedSnapshotCreatedAt || new Date().toISOString(),
        } : null;
        return {
            scenario: normalizeBenchmarkMaskScenario(parsed.scenario),
            flow,
            createdAt: asText(parsed.createdAt) || new Date().toISOString(),
            source,
            tripId: asText(parsed.tripId) || null,
            inputPayload: asRecord(parsed.inputPayload) || null,
            inputSnapshot: parsedInputSnapshot,
        };
    } catch {
        return null;
    }
};

const SCENARIO_KEYS = new Set<keyof BenchmarkMaskScenario>([
    'destinations',
    'dateInputMode',
    'startDate',
    'endDate',
    'flexWeeks',
    'flexWindow',
    'budget',
    'pace',
    'specificCities',
    'notes',
    'numCities',
    'roundTrip',
    'routeLock',
    'travelerSetup',
    'tripStyleMask',
    'transportMask',
]);

const isGenerationFlow = (value: unknown): value is TripGenerationInputSnapshot['flow'] => (
    value === 'classic' || value === 'wizard' || value === 'surprise'
);

const hasScenarioKeys = (value: Record<string, unknown>): boolean => (
    Object.keys(value).some((key) => SCENARIO_KEYS.has(key as keyof BenchmarkMaskScenario))
);

const hasGenerationPayloadShape = (value: Record<string, unknown>): boolean => {
    if (isRecord(value.options)) return true;
    if (asText(value.destinationPrompt)) return true;
    if (Array.isArray(value.countries)) return true;
    if (asText(value.country)) return true;
    return false;
};

const inferFlowFromPayload = (
    payload: Record<string, unknown>,
    flowHint?: TripGenerationInputSnapshot['flow'] | 'unknown',
): TripGenerationInputSnapshot['flow'] => {
    if (isGenerationFlow(flowHint)) return flowHint;
    const directFlow = asText(payload.flow);
    if (isGenerationFlow(directFlow)) return directFlow;
    const options = isRecord(payload.options) ? payload.options : payload;
    if (Array.isArray(options.countries) && options.countries.some((entry) => asText(entry))) {
        return 'wizard';
    }
    if (asText(options.country)) {
        return 'surprise';
    }
    if (Array.isArray(payload.countries) && payload.countries.some((entry) => asText(entry))) {
        return 'wizard';
    }
    if (asText(payload.country)) {
        return 'surprise';
    }
    return 'classic';
};

const asSnapshotDate = (...candidates: unknown[]): string | undefined => {
    for (const candidate of candidates) {
        const normalized = asDateOnly(candidate);
        if (normalized) return normalized;
    }
    return undefined;
};

export const buildBenchmarkMaskScenarioFromImportedJson = (
    value: unknown,
    options?: {
        flowHint?: TripGenerationInputSnapshot['flow'] | 'unknown';
        defaultStartDate?: string | null;
        defaultEndDate?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        destinationLabel?: string | null;
    },
): {
    scenario: BenchmarkMaskScenario | null;
    flow: TripGenerationInputSnapshot['flow'] | 'unknown';
} => {
    const defaultFlow = isGenerationFlow(options?.flowHint) ? options.flowHint : 'unknown';
    if (!isRecord(value)) {
        return { scenario: null, flow: defaultFlow };
    }

    const wrappedScenario = asRecord(value.scenario);
    if (wrappedScenario) {
        const wrappedFlow = asText(value.flow);
        return {
            scenario: normalizeBenchmarkMaskScenario(wrappedScenario, {
                defaultStartDate: options?.defaultStartDate,
                defaultEndDate: options?.defaultEndDate,
            }),
            flow: isGenerationFlow(wrappedFlow) ? wrappedFlow : defaultFlow,
        };
    }

    const payload = asRecord(value.payload) || value;
    if (!hasGenerationPayloadShape(payload) && !hasScenarioKeys(payload)) {
        return { scenario: null, flow: defaultFlow };
    }

    if (hasScenarioKeys(payload) && !hasGenerationPayloadShape(payload) && !asRecord(value.payload)) {
        return {
            scenario: normalizeBenchmarkMaskScenario(payload, {
                defaultStartDate: options?.defaultStartDate,
                defaultEndDate: options?.defaultEndDate,
            }),
            flow: defaultFlow,
        };
    }

    const directFlow = asText(value.flow);
    const flow = inferFlowFromPayload(payload, isGenerationFlow(directFlow) ? directFlow : options?.flowHint);
    const payloadOptions = asRecord(payload.options);
    const snapshot: TripGenerationInputSnapshot = {
        flow,
        destinationLabel: asText(value.destinationLabel)
            || asText(payload.destinationPrompt)
            || asText(payload.country)
            || options?.destinationLabel
            || undefined,
        startDate: asSnapshotDate(
            value.startDate,
            payload.startDate,
            payloadOptions?.startDate,
            options?.startDate,
            options?.defaultStartDate,
        ),
        endDate: asSnapshotDate(
            value.endDate,
            payload.endDate,
            payloadOptions?.endDate,
            options?.endDate,
            options?.defaultEndDate,
        ),
        payload,
        createdAt: asText(value.createdAt) || new Date().toISOString(),
    };

    const scenario = buildBenchmarkMaskScenarioFromGenerationSnapshot(snapshot);
    return {
        scenario: scenario
            ? normalizeBenchmarkMaskScenario(scenario, {
                defaultStartDate: options?.defaultStartDate,
                defaultEndDate: options?.defaultEndDate,
            })
            : null,
        flow,
    };
};

export const buildBenchmarkScenarioImportUrl = (params: {
    snapshot: TripGenerationInputSnapshot | null | undefined;
    source: 'trip_info' | 'admin_trip_drawer';
    tripId?: string | null;
    basePath?: string;
}): string | null => {
    const scenario = buildBenchmarkMaskScenarioFromGenerationSnapshot(params.snapshot);
    if (!scenario) return null;
    const payload = encodeBenchmarkScenarioImportPayload({
        scenario,
        flow: params.snapshot?.flow || 'classic',
        createdAt: params.snapshot?.createdAt || new Date().toISOString(),
        source: params.source,
        tripId: params.tripId || null,
        inputPayload: isRecord(params.snapshot?.payload) ? params.snapshot.payload : null,
        inputSnapshot: params.snapshot || null,
    });
    const basePath = params.basePath || '/admin/ai-benchmark';
    return `${basePath}?import=${encodeURIComponent(payload)}`;
};
