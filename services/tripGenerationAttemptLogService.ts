import type { TripGenerationAttemptSummary, TripGenerationFlow } from '../types';
import { ensureExistingDbSession } from './dbService';
import { supabase } from './supabaseClient';

interface TripGenerationAttemptStartInput {
    tripId: string;
    flow: TripGenerationFlow;
    source: string;
    state: 'queued' | 'running';
    provider?: string | null;
    model?: string | null;
    providerModel?: string | null;
    requestId?: string | null;
    startedAt?: string;
    metadata?: Record<string, unknown> | null;
}

interface TripGenerationAttemptFinishInput {
    attemptId: string;
    state: 'succeeded' | 'failed';
    provider?: string | null;
    model?: string | null;
    providerModel?: string | null;
    requestId?: string | null;
    finishedAt?: string;
    durationMs?: number | null;
    statusCode?: number | null;
    failureKind?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
}

const parseAttemptSummary = (value: unknown): TripGenerationAttemptSummary | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const flow = row.flow;
    const state = row.state;
    if (!id || (flow !== 'classic' && flow !== 'wizard' && flow !== 'surprise')) return null;
    if (state !== 'queued' && state !== 'running' && state !== 'succeeded' && state !== 'failed') return null;
    return {
        id,
        flow,
        source: typeof row.source === 'string' ? row.source : 'unknown',
        state,
        startedAt: typeof row.started_at === 'string' ? row.started_at : new Date().toISOString(),
        finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
        durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : null,
        requestId: typeof row.request_id === 'string' ? row.request_id : null,
        provider: typeof row.provider === 'string' ? row.provider : null,
        model: typeof row.model === 'string' ? row.model : null,
        providerModel: typeof row.provider_model === 'string' ? row.provider_model : null,
        statusCode: typeof row.status_code === 'number' ? row.status_code : null,
        failureKind: typeof row.failure_kind === 'string' ? row.failure_kind as TripGenerationAttemptSummary['failureKind'] : null,
        errorCode: typeof row.error_code === 'string' ? row.error_code : null,
        errorMessage: typeof row.error_message === 'string' ? row.error_message : null,
        metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? row.metadata as Record<string, unknown>
            : null,
    };
};

export const startTripGenerationAttemptLog = async (
    input: TripGenerationAttemptStartInput,
): Promise<TripGenerationAttemptSummary | null> => {
    if (!supabase) return null;

    try {
        await ensureExistingDbSession();
        const { data, error } = await supabase.rpc('trip_generation_attempt_start', {
            p_trip_id: input.tripId,
            p_flow: input.flow,
            p_source: input.source,
            p_state: input.state,
            p_provider: input.provider || null,
            p_model: input.model || null,
            p_provider_model: input.providerModel || null,
            p_request_id: input.requestId || null,
            p_started_at: input.startedAt || null,
            p_metadata: input.metadata || null,
        });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        return parseAttemptSummary(row);
    } catch {
        return null;
    }
};

export const finishTripGenerationAttemptLog = async (input: TripGenerationAttemptFinishInput): Promise<void> => {
    if (!supabase) return;

    try {
        await ensureExistingDbSession();
        await supabase.rpc('trip_generation_attempt_finish', {
            p_attempt_id: input.attemptId,
            p_state: input.state,
            p_provider: input.provider || null,
            p_model: input.model || null,
            p_provider_model: input.providerModel || null,
            p_request_id: input.requestId || null,
            p_finished_at: input.finishedAt || null,
            p_duration_ms: input.durationMs ?? null,
            p_status_code: input.statusCode ?? null,
            p_failure_kind: input.failureKind || null,
            p_error_code: input.errorCode || null,
            p_error_message: input.errorMessage || null,
            p_metadata: input.metadata || null,
        });
    } catch {
        // best effort; diagnostics in trip.aiMeta stays primary source of truth
    }
};

export const listOwnerTripGenerationAttempts = async (
    tripId: string,
    limit = 20,
): Promise<TripGenerationAttemptSummary[]> => {
    if (!supabase) return [];

    try {
        await ensureExistingDbSession();
        const { data, error } = await supabase.rpc('trip_generation_attempt_list_owner', {
            p_trip_id: tripId,
            p_limit: Math.max(1, Math.min(limit, 100)),
        });
        if (error) return [];
        const rows = Array.isArray(data) ? data : [];
        return rows
            .map((row) => parseAttemptSummary(row))
            .filter((row): row is TripGenerationAttemptSummary => Boolean(row));
    } catch {
        return [];
    }
};

export const listAdminTripGenerationAttempts = async (
    tripId: string,
    limit = 30,
): Promise<TripGenerationAttemptSummary[]> => {
    if (!supabase) return [];

    try {
        await ensureExistingDbSession();
        const { data, error } = await supabase.rpc('trip_generation_attempt_list_admin', {
            p_trip_id: tripId,
            p_limit: Math.max(1, Math.min(limit, 200)),
        });
        if (error) return [];
        const rows = Array.isArray(data) ? data : [];
        return rows
            .map((row) => parseAttemptSummary(row))
            .filter((row): row is TripGenerationAttemptSummary => Boolean(row));
    } catch {
        return [];
    }
};
