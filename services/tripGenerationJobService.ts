import type { TripGenerationJobState, TripGenerationJobSummary } from '../types';
import { ensureDbSession } from './dbService';
import { supabase } from './supabaseClient';

interface TripGenerationJobRow {
    id?: unknown;
    trip_id?: unknown;
    owner_id?: unknown;
    attempt_id?: unknown;
    state?: unknown;
    priority?: unknown;
    retry_count?: unknown;
    max_retries?: unknown;
    run_after?: unknown;
    lease_expires_at?: unknown;
    leased_by?: unknown;
    payload?: unknown;
    last_error_code?: unknown;
    last_error_message?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
}

const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const asNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const parseJobSummary = (value: unknown): TripGenerationJobSummary | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as TripGenerationJobRow;

    const id = asString(row.id);
    const tripId = asString(row.trip_id);
    const ownerId = asString(row.owner_id);
    const attemptId = asString(row.attempt_id);
    const state = asString(row.state);
    const runAfter = asString(row.run_after);
    const createdAt = asString(row.created_at);
    const updatedAt = asString(row.updated_at);

    if (!id || !tripId || !ownerId || !attemptId || !state || !runAfter || !createdAt || !updatedAt) return null;
    if (state !== 'queued' && state !== 'leased' && state !== 'completed' && state !== 'failed' && state !== 'dead') return null;

    return {
        id,
        tripId,
        ownerId,
        attemptId,
        state,
        priority: asNumber(row.priority, 100),
        retryCount: Math.max(0, asNumber(row.retry_count, 0)),
        maxRetries: Math.max(0, asNumber(row.max_retries, 0)),
        runAfter,
        leaseExpiresAt: asString(row.lease_expires_at),
        leasedBy: asString(row.leased_by),
        payload: asObject(row.payload),
        lastErrorCode: asString(row.last_error_code),
        lastErrorMessage: asString(row.last_error_message),
        createdAt,
        updatedAt,
    };
};

interface EnqueueTripGenerationJobInput {
    tripId: string;
    attemptId: string;
    payload?: Record<string, unknown> | null;
    priority?: number;
    runAfter?: string | null;
    maxRetries?: number;
}

export const enqueueTripGenerationJob = async (
    input: EnqueueTripGenerationJobInput,
): Promise<TripGenerationJobSummary | null> => {
    if (!supabase) return null;

    try {
        await ensureDbSession();
        const { data, error } = await supabase.rpc('trip_generation_job_enqueue', {
            p_trip_id: input.tripId,
            p_attempt_id: input.attemptId,
            p_payload: input.payload || null,
            p_priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : null,
            p_run_after: input.runAfter || null,
            p_max_retries: Number.isFinite(Number(input.maxRetries)) ? Number(input.maxRetries) : null,
        });
        if (error) return null;
        const row = Array.isArray(data) ? data[0] : data;
        return parseJobSummary(row);
    } catch {
        return null;
    }
};

export const claimTripGenerationJobs = async (
    workerId: string,
    options?: { limit?: number; leaseSeconds?: number },
): Promise<TripGenerationJobSummary[]> => {
    if (!supabase) return [];

    try {
        await ensureDbSession();
        const { data, error } = await supabase.rpc('trip_generation_job_claim', {
            p_worker_id: workerId,
            p_limit: options?.limit ?? 1,
            p_lease_seconds: options?.leaseSeconds ?? 120,
        });
        if (error) return [];
        const rows = Array.isArray(data) ? data : [];
        return rows
            .map((row) => parseJobSummary(row))
            .filter((row): row is TripGenerationJobSummary => Boolean(row));
    } catch {
        return [];
    }
};

export const listTripGenerationJobsByTrip = async (
    tripId: string,
    options?: { limit?: number; states?: TripGenerationJobState[] },
): Promise<TripGenerationJobSummary[]> => {
    if (!supabase) return [];
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) return [];

    try {
        await ensureDbSession();
        const requestedStates = Array.isArray(options?.states)
            ? options.states.filter((state) => (
                state === 'queued'
                || state === 'leased'
                || state === 'completed'
                || state === 'failed'
                || state === 'dead'
            ))
            : [];
        const limit = Math.max(1, Math.min(options?.limit ?? 20, 100));

        let query = supabase
            .from('trip_generation_jobs')
            .select('id,trip_id,owner_id,attempt_id,state,priority,retry_count,max_retries,run_after,lease_expires_at,leased_by,payload,last_error_code,last_error_message,created_at,updated_at')
            .eq('trip_id', normalizedTripId);

        if (requestedStates.length > 0) {
            query = query.in('state', requestedStates);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        const rows = Array.isArray(data) ? data : [];
        return rows
            .map((row) => parseJobSummary(row))
            .filter((row): row is TripGenerationJobSummary => Boolean(row));
    } catch {
        return [];
    }
};

export const requeueTripGenerationJob = async (
    jobId: string,
    options?: {
        reason?: string | null;
        runAfter?: string | null;
        resetRetryCount?: boolean;
    },
): Promise<boolean> => {
    if (!supabase) return false;
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) return false;

    try {
        await ensureDbSession();
        const { error } = await supabase.rpc('trip_generation_job_requeue', {
            p_job_id: normalizedJobId,
            p_reason: options?.reason || null,
            p_run_after: options?.runAfter || null,
            p_reset_retry_count: options?.resetRetryCount === true,
        });
        return !error;
    } catch {
        return false;
    }
};
