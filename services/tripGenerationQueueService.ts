import type { ITrip } from '../types';
import {
    generateItinerary,
    generateSurpriseItinerary,
    generateWizardItinerary,
    type GenerateOptions,
    type SurpriseGenerateOptions,
    type WizardGenerateOptions,
} from './aiService';
import { dbCreateTripVersion, dbUpsertTrip, ensureDbSession } from './dbService';
import { supabase } from './supabaseClient';

export type TripGenerationFlow = 'classic' | 'wizard' | 'surprise';

interface BaseQueuedPayload {
    version: 1;
    destinationLabel: string;
    startDate: string;
    endDate: string;
}

interface QueuedClassicPayload extends BaseQueuedPayload {
    flow: 'classic';
    destinationPrompt: string;
    options: GenerateOptions;
}

interface QueuedWizardPayload extends BaseQueuedPayload {
    flow: 'wizard';
    options: WizardGenerateOptions;
}

interface QueuedSurprisePayload extends BaseQueuedPayload {
    flow: 'surprise';
    options: SurpriseGenerateOptions;
}

export type QueuedTripGenerationPayload =
    | QueuedClassicPayload
    | QueuedWizardPayload
    | QueuedSurprisePayload;

interface TripGenerationRequestRow {
    request_id: string;
    flow: TripGenerationFlow;
    payload: unknown;
    status: string;
    owner_user_id: string | null;
    expires_at: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const next = value.trim();
    return next || fallback;
};

const parseQueuedPayload = (flow: TripGenerationFlow, payload: unknown): QueuedTripGenerationPayload => {
    if (!isRecord(payload)) {
        throw new Error('Queued request payload is invalid.');
    }

    const version = Number(payload.version);
    if (!Number.isFinite(version) || version < 1) {
        throw new Error('Queued request payload version is invalid.');
    }

    const destinationLabel = asText(payload.destinationLabel, 'Trip');
    const startDate = asText(payload.startDate);
    const endDate = asText(payload.endDate);

    if (!startDate || !endDate) {
        throw new Error('Queued request date payload is missing.');
    }

    if (flow === 'classic') {
        const destinationPrompt = asText(payload.destinationPrompt);
        if (!destinationPrompt) {
            throw new Error('Queued classic request is missing destination prompt.');
        }
        return {
            version: 1,
            flow,
            destinationLabel,
            startDate,
            endDate,
            destinationPrompt,
            options: isRecord(payload.options) ? payload.options as GenerateOptions : {},
        };
    }

    if (flow === 'wizard') {
        return {
            version: 1,
            flow,
            destinationLabel,
            startDate,
            endDate,
            options: isRecord(payload.options) ? payload.options as WizardGenerateOptions : { countries: [] },
        };
    }

    return {
        version: 1,
        flow: 'surprise',
        destinationLabel,
        startDate,
        endDate,
        options: isRecord(payload.options) ? payload.options as SurpriseGenerateOptions : { country: destinationLabel },
    };
};

const applyTripDefaults = (trip: ITrip): ITrip => {
    const now = Date.now();
    return {
        ...trip,
        createdAt: typeof trip.createdAt === 'number' ? trip.createdAt : now,
        updatedAt: now,
        status: trip.status || 'active',
        tripExpiresAt: trip.tripExpiresAt ?? null,
        sourceKind: trip.sourceKind || 'created',
    };
};

const truncateError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message.slice(0, 400);
    }
    return 'Unknown queue processing error';
};

const updateQueuedRequestStatus = async (
    requestId: string,
    patch: Record<string, unknown>
): Promise<void> => {
    if (!supabase) return;
    await supabase
        .from('trip_generation_requests')
        .update(patch)
        .eq('id', requestId);
};

const runQueuedGeneration = async (payload: QueuedTripGenerationPayload): Promise<ITrip> => {
    if (payload.flow === 'classic') {
        return generateItinerary(payload.destinationPrompt, payload.startDate, payload.options);
    }
    if (payload.flow === 'wizard') {
        return generateWizardItinerary(payload.options);
    }
    return generateSurpriseItinerary(payload.options);
};

export const runOpportunisticTripQueueCleanup = async (): Promise<void> => {
    if (!supabase) return;
    try {
        await supabase.rpc('expire_stale_trip_generation_requests');
    } catch {
        // non-blocking maintenance
    }
};

export const createTripGenerationRequest = async (
    flow: TripGenerationFlow,
    payload: QueuedTripGenerationPayload,
    expiresInDays = 14
): Promise<{ requestId: string; expiresAt: string }> => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    await ensureDbSession();
    const { data, error } = await supabase.rpc('create_trip_generation_request', {
        p_flow: flow,
        p_payload: payload,
        p_expires_in_days: expiresInDays,
    });
    if (error) {
        throw new Error(error.message || 'Could not queue trip request.');
    }

    const row = (Array.isArray(data) ? data[0] : data) as { request_id?: string; expires_at?: string } | null;
    const requestId = row?.request_id || '';
    const expiresAt = row?.expires_at || '';
    if (!requestId || !expiresAt) {
        throw new Error('Queue request was created but response payload is invalid.');
    }

    return { requestId, expiresAt };
};

export const processQueuedTripGenerationAfterAuth = async (
    requestId: string
): Promise<{ tripId: string; trip: ITrip }> => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }

    await ensureDbSession();
    const { data, error } = await supabase.rpc('claim_trip_generation_request', {
        p_request_id: requestId,
    });
    if (error) {
        throw new Error(error.message || 'Could not claim queued trip request.');
    }

    const row = (Array.isArray(data) ? data[0] : data) as TripGenerationRequestRow | null;
    if (!row?.request_id) {
        throw new Error('Queued request is missing, expired, or already processed.');
    }

    const flow = row.flow;
    if (flow !== 'classic' && flow !== 'wizard' && flow !== 'surprise') {
        throw new Error('Queued request flow is invalid.');
    }

    const parsedPayload = parseQueuedPayload(flow, row.payload);

    await updateQueuedRequestStatus(requestId, {
        status: 'running',
        updated_at: new Date().toISOString(),
    });

    try {
        const generated = await runQueuedGeneration(parsedPayload);
        const preparedTrip = applyTripDefaults(generated);

        await ensureDbSession();
        await dbUpsertTrip(preparedTrip, undefined);
        await dbCreateTripVersion(preparedTrip, undefined, 'Data: Created trip');

        await updateQueuedRequestStatus(requestId, {
            status: 'completed',
            result_trip_id: preparedTrip.id,
            completed_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
        });

        return {
            tripId: preparedTrip.id,
            trip: preparedTrip,
        };
    } catch (error) {
        await updateQueuedRequestStatus(requestId, {
            status: 'failed',
            error_message: truncateError(error),
            updated_at: new Date().toISOString(),
        });
        throw error;
    }
};
