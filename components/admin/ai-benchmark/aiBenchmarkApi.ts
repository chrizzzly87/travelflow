import { AdminUserFacingError, toBenchmarkApiErrorSentence } from '../../../services/adminErrorMessages';
import type { BenchmarkPreferencesPayload } from '../../../services/aiBenchmarkPreferencesService';
import type { OpenRouterCatalogModel } from '../../../services/openRouterModelCatalogService';
import type { AiRuntimeSettings } from '../../../services/aiRuntimeSettingsService';
import type { BenchmarkRun, BenchmarkSummary } from '../aiBenchmarkRuns';

export interface BenchmarkSession {
    id: string;
    share_token: string;
    name: string | null;
    flow: string;
    scenario: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface BenchmarkApiResponse {
    ok: boolean;
    async?: boolean;
    cancelled?: number;
    session?: BenchmarkSession;
    runs?: BenchmarkRun[];
    run?: BenchmarkRun;
    summary?: BenchmarkSummary;
    sessions?: BenchmarkSession[];
    error?: string;
    code?: string;
    details?: string;
}

export interface AiTelemetrySummary {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
    averageCostUsd: number | null;
}

export interface AiTelemetryModelPoint {
    provider: string;
    model: string;
    key: string;
    total: number;
    success: number;
    failed: number;
    successRate: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
    averageCostUsd: number | null;
    costPerSecondUsd: number | null;
}

export interface AiTelemetryApiResponse {
    ok: boolean;
    error?: string;
    summary?: AiTelemetrySummary;
    rankings?: {
        fastest?: AiTelemetryModelPoint[];
        cheapest?: AiTelemetryModelPoint[];
        bestValue?: AiTelemetryModelPoint[];
    };
}

export interface BenchmarkPreferencesApiResponse extends BenchmarkApiResponse {
    preferences?: BenchmarkPreferencesPayload;
    updatedAt?: string | null;
}

export interface BenchmarkModelsApiResponse extends BenchmarkApiResponse {
    models?: OpenRouterCatalogModel[];
    settings?: AiRuntimeSettings;
}

export type FetchBenchmarkApi = (path: string, init?: RequestInit) => Promise<BenchmarkApiResponse>;

export const BENCHMARK_API_UNAVAILABLE_MESSAGE = 'AI Benchmark API is unavailable (404). Start the app with `pnpm dev:netlify` and open the benchmark from http://localhost:8888.';

const readBenchmarkPayload = async (response: Response): Promise<BenchmarkApiResponse> => {
    const raw = await response.text();
    try {
        return (raw ? JSON.parse(raw) : { ok: response.ok }) as BenchmarkApiResponse;
    } catch {
        // A non-JSON body is a gateway or timeout page, never an authored message.
        return { ok: response.ok };
    }
};

/**
 * One call to the internal benchmark API with the admin's bearer token. A
 * failed response becomes an authored sentence; a missing local API (404) says
 * how to start it.
 */
export const requestBenchmarkApi = async (
    accessToken: string | null,
    path: string,
    init?: RequestInit,
): Promise<BenchmarkApiResponse> => {
    if (!accessToken) {
        throw new Error('No Supabase session access token found. Refresh and try again.');
    }

    const headers = new Headers(init?.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await fetch(path, {
        ...init,
        headers,
    });

    if (!response.ok) {
        if (response.status === 404 && path.startsWith('/api/internal/ai/benchmark')) {
            throw new AdminUserFacingError(BENCHMARK_API_UNAVAILABLE_MESSAGE);
        }
        const failure = await readBenchmarkPayload(response);
        throw new AdminUserFacingError(toBenchmarkApiErrorSentence(failure.error, response.status));
    }

    return readBenchmarkPayload(response);
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};
