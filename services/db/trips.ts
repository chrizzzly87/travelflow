import { enqueueTripVideoBestEffort } from '../tripOgVideoService';
import type { ITrip, IViewSettings } from '../../types';
import { isUuid } from '../../utils';
import { getAllTrips, setAllTrips } from '../storageService';
import { ANONYMOUS_TRIP_LIMIT } from '../../config/productLimits';
import { isSimulatedLoggedIn } from '../simulatedLoginService';
import {
    applyTripAccessFields,
    DB_ENABLED,
    debugLog,
    isAnonymousSessionUser,
    isPermissionLikeDbError,
    isRlsViolation,
    normalizeTripForStorage,
    normalizeViewSettingsPayload,
    requireSupabase,
    type DbErrorLike,
    type SessionUserLike,
} from './internal';
import { ensureDbSession, ensureExistingDbSession } from './session';
import {
    buildTripSecondaryActionCodes,
    buildTripTimelineDiffSummary,
    buildTripTimelineDiffV1,
    createDeterministicCorrelationId,
    createEventCorrelationId,
    createEventId,
    normalizeCorrelationId,
    parseVisualChangesFromLabel,
    readLatestTripVersionSnapshot,
    readOwnedTripEventSnapshot,
    toTripEventSnapshotFromTrip,
    toTripEventSource,
    writeTripEventFallback,
    writeTripLifecycleEventFallback,
} from './tripEvents';

export type DbTripAccessSource = 'owner' | 'admin_fallback' | 'public_read';

export interface DbTripAccessMetadata {
    source: DbTripAccessSource;
    ownerId: string | null;
    ownerEmail: string | null;
    ownerUsername: string | null;
    canAdminWrite: boolean;
    updatedAtIso: string | null;
}

export interface DbTripResult {
    trip: ITrip;
    view: IViewSettings | null;
    access: DbTripAccessMetadata;
}

export interface DbAdminOverrideCommitResult {
    tripId: string;
    versionId: string | null;
    updatedAtIso: string | null;
}

const normalizeUsernameHandle = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/^@+/, '');
};

const resolveExplicitGenerationState = (trip: ITrip | null | undefined): 'queued' | 'running' | 'failed' | 'succeeded' | null => {
    if (!trip) return null;
    const generation = (trip.aiMeta as Record<string, unknown> | undefined)?.generation as Record<string, unknown> | undefined;
    const explicitState = typeof generation?.state === 'string' ? generation.state.trim().toLowerCase() : '';
    if (explicitState === 'queued' || explicitState === 'running' || explicitState === 'failed' || explicitState === 'succeeded') {
        return explicitState;
    }
    const latestAttempt = generation?.latestAttempt as Record<string, unknown> | undefined;
    const latestAttemptState = typeof latestAttempt?.state === 'string' ? latestAttempt.state.trim().toLowerCase() : '';
    if (latestAttemptState === 'queued' || latestAttemptState === 'running' || latestAttemptState === 'failed' || latestAttemptState === 'succeeded') {
        return latestAttemptState;
    }
    return null;
};

const isInFlightGenerationState = (state: ReturnType<typeof resolveExplicitGenerationState>): boolean =>
    state === 'queued' || state === 'running';

const isTerminalGenerationState = (state: ReturnType<typeof resolveExplicitGenerationState>): boolean =>
    state === 'failed' || state === 'succeeded';

const parseUpdatedAtIsoToMs = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const __shouldUploadLocalTripSnapshot = (params: {
    localTrip: ITrip;
    remoteTrip?: ITrip | null;
    remoteUpdatedAtMs?: number | null;
}): boolean => {
    const localUpdatedAt = typeof params.localTrip.updatedAt === 'number' && Number.isFinite(params.localTrip.updatedAt)
        ? params.localTrip.updatedAt
        : 0;
    const remoteUpdatedAt = typeof params.remoteUpdatedAtMs === 'number' && Number.isFinite(params.remoteUpdatedAtMs)
        ? params.remoteUpdatedAtMs
        : 0;

    if (remoteUpdatedAt > localUpdatedAt) return false;

    const localGenerationState = resolveExplicitGenerationState(params.localTrip);
    const remoteGenerationState = resolveExplicitGenerationState(params.remoteTrip ?? undefined);
    if (isInFlightGenerationState(localGenerationState) && isTerminalGenerationState(remoteGenerationState)) {
        return false;
    }

    return localUpdatedAt > remoteUpdatedAt;
};

export const dbUpsertTrip = async (trip: ITrip, view?: IViewSettings | null) => {
    const result = await dbUpsertTripWithStatus(trip, view);
    return result.tripId;
};

export interface DbUpsertTripResult {
    tripId: string | null;
    error: DbErrorLike | null;
    isPermissionError: boolean;
}

export const dbUpsertTripWithStatus = async (
    trip: ITrip,
    view?: IViewSettings | null
): Promise<DbUpsertTripResult> => {
    if (!DB_ENABLED) {
        return {
            tripId: null,
            error: null,
            isPermissionError: false,
        };
    }
    const client = requireSupabase();
    const ownerId = await ensureDbSession();
    if (!ownerId) {
        return {
            tripId: null,
            error: null,
            isPermissionError: false,
        };
    }

    debugLog('dbUpsertTrip:start', { tripId: trip.id, ownerId });

    const normalizedTrip = normalizeTripForStorage(trip);
    const beforeSnapshot = await readOwnedTripEventSnapshot(client, ownerId, normalizedTrip.id);
    const normalizedView = normalizeViewSettingsPayload(view ?? null);
    const startDate = normalizedTrip.startDate ? normalizedTrip.startDate.split('T')[0] : null;
    const status = normalizedTrip.status && ['active', 'archived', 'expired'].includes(normalizedTrip.status)
        ? normalizedTrip.status
        : 'active';
    const extendedPayload = {
        p_id: normalizedTrip.id,
        p_data: normalizedTrip,
        p_view: normalizedView,
        p_title: normalizedTrip.title || 'Untitled trip',
        p_start_date: startDate,
        p_is_favorite: Boolean(normalizedTrip.isFavorite),
        p_show_on_public_profile: normalizedTrip.showOnPublicProfile !== false,
        p_forked_from_trip_id: normalizedTrip.forkedFromTripId ?? null,
        p_forked_from_share_token: normalizedTrip.forkedFromShareToken ?? null,
        p_status: status,
        p_trip_expires_at: normalizedTrip.tripExpiresAt ?? null,
        p_source_kind: normalizedTrip.sourceKind ?? null,
        p_source_template_id: normalizedTrip.sourceTemplateId ?? null,
    };

    let { data, error } = await client.rpc('upsert_trip', extendedPayload);
    if (error && /upsert_trip/i.test(error.message || '') && /function/i.test(error.message || '')) {
        debugLog('dbUpsertTrip:fallbackToExtendedSignatureWithoutVisibility', { message: error.message });
        const fallbackWithExtendedSignature = await client.rpc('upsert_trip', {
            p_id: normalizedTrip.id,
            p_data: normalizedTrip,
            p_view: normalizedView,
            p_title: normalizedTrip.title || 'Untitled trip',
            p_start_date: startDate,
            p_is_favorite: Boolean(normalizedTrip.isFavorite),
            p_forked_from_trip_id: normalizedTrip.forkedFromTripId ?? null,
            p_forked_from_share_token: normalizedTrip.forkedFromShareToken ?? null,
            p_status: status,
            p_trip_expires_at: normalizedTrip.tripExpiresAt ?? null,
            p_source_kind: normalizedTrip.sourceKind ?? null,
            p_source_template_id: normalizedTrip.sourceTemplateId ?? null,
        });
        data = fallbackWithExtendedSignature.data;
        error = fallbackWithExtendedSignature.error;
    }
    if (error && /upsert_trip/i.test(error.message || '') && /function/i.test(error.message || '')) {
        debugLog('dbUpsertTrip:fallbackToLegacySignature', { message: error.message });
        const legacyPayload = {
            p_id: normalizedTrip.id,
            p_data: normalizedTrip,
            p_view: normalizedView,
            p_title: normalizedTrip.title || 'Untitled trip',
            p_start_date: startDate,
            p_is_favorite: Boolean(normalizedTrip.isFavorite),
            p_forked_from_trip_id: normalizedTrip.forkedFromTripId ?? null,
            p_forked_from_share_token: normalizedTrip.forkedFromShareToken ?? null,
        };
        const fallback = await client.rpc('upsert_trip', legacyPayload);
        data = fallback.data;
        error = fallback.error;
    }

    if (error) {
        if (isSimulatedLoggedIn() && /trip limit reached/i.test(error.message || '')) {
            debugLog('dbUpsertTrip:simulatedLoginLocalFallback', { tripId: trip.id, message: error.message });
            return {
                tripId: trip.id,
                error: null,
                isPermissionError: false,
            };
        }
        if (isPermissionLikeDbError(error)) {
            debugLog('dbUpsertTrip:permissionDenied', { code: error.code, message: error.message });
            return {
                tripId: null,
                error,
                isPermissionError: true,
            };
        }
        if (isRlsViolation(error)) {
            debugLog('dbUpsertTrip:rls', { code: error.code, message: error.message });
        }
        console.error('Failed to upsert trip', error);
        return {
            tripId: null,
            error,
            isPermissionError: false,
        };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        debugLog('dbUpsertTrip:empty', { tripId: trip.id });
    }
    const afterSnapshot = await readOwnedTripEventSnapshot(client, ownerId, normalizedTrip.id);
    const correlationId = createDeterministicCorrelationId('trip-upsert', [
        normalizedTrip.id,
        normalizedTrip.updatedAt,
    ]);
    await writeTripLifecycleEventFallback(client, {
        ownerId,
        tripId: normalizedTrip.id,
        source: toTripEventSource(normalizedTrip.sourceKind ?? null),
        before: beforeSnapshot,
        after: afterSnapshot ?? toTripEventSnapshotFromTrip(normalizedTrip),
        correlationId,
    });
    if ((row?.trip_id ?? row?.id) && normalizedTrip.items?.some(item => item.type === 'city' && item.coordinates)
        && !['queued', 'running'].includes(resolveExplicitGenerationState(normalizedTrip) || '')) {
        enqueueTripVideoBestEffort(normalizedTrip.id);
    }
    return {
        tripId: (row?.trip_id ?? row?.id) ?? null,
        error: null,
        isPermissionError: false,
    };
};

export const dbGetTrip = async (
    tripId: string,
    options?: {
        includeOwnerProfile?: boolean;
    },
): Promise<DbTripResult | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const currentUserId = await ensureExistingDbSession();
    let loadedViaAdminBypass = false;
    let ownerId: string | null = null;
    let ownerEmail: string | null = null;
    let ownerUsername: string | null = null;
    let canAdminWrite = false;
    let updatedAtIso: string | null = null;

    let { data, error } = await client
        .from('trips')
        .select('id, owner_id, data, view_settings, status, trip_expires_at, source_kind, source_template_id, show_on_public_profile, updated_at')
        .eq('id', tripId)
        .maybeSingle();

    if (error && /column/i.test(error.message || '') && /(status|trip_expires_at|source_kind|source_template_id|show_on_public_profile)/i.test(error.message || '')) {
        debugLog('dbGetTrip:fallbackLegacySelect', { message: error.message });
        const fallback = await client
            .from('trips')
            .select('id, data, view_settings')
            .eq('id', tripId)
            .maybeSingle();
        data = fallback.data as typeof data;
        error = fallback.error as typeof error;
    }

    if (error) {
        console.error('Failed to fetch trip', error);
        return null;
    }

    if (!data) {
        // Admin-only fallback for viewing non-owned trips.
        const { data: adminData, error: adminError } = await client.rpc('admin_get_trip_for_view', {
            p_trip_id: tripId,
        });
        if (!adminError) {
            const row = Array.isArray(adminData) ? adminData[0] : adminData;
            if (row) {
                data = {
                    id: row.trip_id,
                    owner_id: row.owner_id,
                    data: row.data,
                    view_settings: row.view_settings,
                    status: row.status,
                    trip_expires_at: row.trip_expires_at,
                    source_kind: row.source_kind,
                    source_template_id: row.source_template_id,
                    show_on_public_profile: row.show_on_public_profile,
                    updated_at: row.updated_at,
                };
                loadedViaAdminBypass = true;
                ownerId = typeof row.owner_id === 'string' ? row.owner_id : null;
                ownerEmail = typeof row.owner_email === 'string' ? row.owner_email : null;
                canAdminWrite = Boolean(row.can_write);
                updatedAtIso = typeof row.updated_at === 'string' ? row.updated_at : null;
            }
        } else if (!/not allowed/i.test(adminError.message || '')) {
            console.error('Failed admin trip-view fallback', adminError);
        }
    }

    if (!data) return null;
    const trip = data.data as ITrip;
    const normalizedBase = trip && trip.id !== data.id ? { ...trip, id: data.id } : trip;
    if (!normalizedBase) return null;
    const normalized = applyTripAccessFields(normalizedBase, data as Record<string, unknown>);
    if (normalized.status === 'archived' && !loadedViaAdminBypass) return null;
    if (!ownerId) {
        ownerId = typeof (data as { owner_id?: unknown }).owner_id === 'string'
            ? (data as { owner_id: string }).owner_id
            : null;
    }
    if (!updatedAtIso) {
        updatedAtIso = typeof (data as { updated_at?: unknown }).updated_at === 'string'
            ? (data as { updated_at: string }).updated_at
            : null;
    }
    if (ownerId && options?.includeOwnerProfile !== false) {
        const { data: ownerProfile, error: ownerProfileError } = await client
            .from('profiles')
            .select('username')
            .eq('id', ownerId)
            .maybeSingle();
        if (!ownerProfileError) {
            ownerUsername = normalizeUsernameHandle((ownerProfile as { username?: unknown } | null)?.username ?? null);
        }
    }
    const isPublicRead = !loadedViaAdminBypass
        && Boolean(ownerId)
        && (!currentUserId || ownerId !== currentUserId)
        && ((data as { show_on_public_profile?: unknown }).show_on_public_profile === true);
    return {
        trip: normalized,
        view: normalizeViewSettingsPayload(data.view_settings),
        access: {
            source: loadedViaAdminBypass ? 'admin_fallback' : (isPublicRead ? 'public_read' : 'owner'),
            ownerId,
            ownerEmail,
            ownerUsername,
            canAdminWrite: loadedViaAdminBypass ? canAdminWrite : false,
            updatedAtIso,
        },
    };
};

export const dbGetTripVersion = async (tripId: string, versionId: string) => {
    if (!isUuid(versionId)) return null;
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureExistingDbSession();

    const { data, error } = await client
        .from('trip_versions')
        .select('id, data, view_settings, label')
        .eq('id', versionId)
        .eq('trip_id', tripId)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch trip version', error);
        return null;
    }

    if (!data) return null;
    const trip = data.data as ITrip;
    const normalized = trip && trip.id !== tripId ? { ...trip, id: tripId } : trip;
    return {
        trip: normalized,
        view: normalizeViewSettingsPayload(data.view_settings),
        label: data.label as string | null,
        versionId: data.id as string
    };
};

export const dbCreateTripVersion = async (
    trip: ITrip,
    view: IViewSettings | undefined,
    label?: string | null
) => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const ownerId = await ensureDbSession();
    if (!ownerId) return null;

    const normalizedTrip = normalizeTripForStorage(trip);
    const previousVersionSnapshot = await readLatestTripVersionSnapshot(client, normalizedTrip.id);
    const normalizedView = normalizeViewSettingsPayload(view ?? null);
    const payload = {
        p_trip_id: normalizedTrip.id,
        p_data: normalizedTrip,
        p_view: normalizedView,
        p_label: label ?? null,
    };

    const { data, error } = await client.rpc('add_trip_version', payload);

    if (error) {
        if (isSimulatedLoggedIn() && /trip limit reached|not allowed/i.test(error.message || '')) {
            debugLog('dbCreateTripVersion:simulatedLoginLocalFallback', { tripId: trip.id, message: error.message });
            return `simulated-local-${trip.id}`;
        }
        if (isRlsViolation(error)) {
            debugLog('dbCreateTripVersion:rls', { code: error.code, message: error.message });
        }
        console.error('Failed to create trip version', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const versionId = (row?.version_id ?? row?.id) as string | null;
    const normalizedLabel = (label || '').trim().toLowerCase();
    const shouldLogVersionUpdate = normalizedLabel.length > 0
        && !/(^|[\s:])(created|copied|archived)([\s:]|$)/i.test(normalizedLabel);

    if (shouldLogVersionUpdate) {
        const timelineDiff = buildTripTimelineDiffSummary(previousVersionSnapshot?.trip ?? null, normalizedTrip);
        const visualChanges = parseVisualChangesFromLabel(label ?? null);
        const timelineDiffV1 = buildTripTimelineDiffV1(timelineDiff, visualChanges);
        const secondaryActionCodes = buildTripSecondaryActionCodes(timelineDiffV1, {
            previousTrip: previousVersionSnapshot?.trip ?? null,
            nextTrip: normalizedTrip,
        });
        const correlationId = createDeterministicCorrelationId('trip-version', [
            normalizedTrip.id,
            versionId ?? normalizedTrip.updatedAt,
        ]);
        await writeTripEventFallback(client, {
            ownerId,
            tripId: normalizedTrip.id,
            action: 'trip.updated',
            source: toTripEventSource(normalizedTrip.sourceKind ?? null),
            correlationId,
            metadata: {
                trip_id: normalizedTrip.id,
                version_id: versionId,
                previous_version_id: previousVersionSnapshot?.versionId ?? null,
                previous_version_label: previousVersionSnapshot?.label ?? null,
                version_label: label ?? null,
                source_kind_after: normalizedTrip.sourceKind ?? null,
                status_after: normalizedTrip.status ?? 'active',
                updated_at_after: normalizedTrip.updatedAt,
                timeline_diff_v1: timelineDiffV1,
                secondary_action_codes: secondaryActionCodes,
            },
            dedupeWindowMs: 0,
        });
    }

    return versionId;
};

export const dbAdminOverrideTripCommit = async (
    trip: ITrip,
    view: IViewSettings | undefined,
    label?: string | null
): Promise<DbAdminOverrideCommitResult | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();

    const normalizedTrip = normalizeTripForStorage(trip);
    const normalizedView = normalizeViewSettingsPayload(view ?? null);
    const payload = {
        p_trip_id: normalizedTrip.id,
        p_data: normalizedTrip,
        p_view: normalizedView,
        p_title: normalizedTrip.title || 'Untitled trip',
        p_start_date: normalizedTrip.startDate ? normalizedTrip.startDate.split('T')[0] : null,
        p_is_favorite: Boolean(normalizedTrip.isFavorite),
        p_label: label ?? null,
    };

    const { data, error } = await client.rpc('admin_override_trip_commit', payload);
    if (error) {
        console.error('Failed admin override trip commit', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.trip_id !== 'string') return null;

    return {
        tripId: row.trip_id as string,
        versionId: typeof row.version_id === 'string' ? row.version_id : null,
        updatedAtIso: typeof row.updated_at === 'string' ? row.updated_at : null,
    };
};

export const dbListTrips = async (): Promise<ITrip[]> => {
    if (!DB_ENABLED) return [];
    const client = requireSupabase();
    const currentUserId = await ensureExistingDbSession();
    if (!currentUserId) return [];

    let { data, error } = await client
        .from('trips')
        .select('id, data, status, trip_expires_at, source_kind, source_template_id, show_on_public_profile')
        .eq('owner_id', currentUserId)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });

    if (error && /column/i.test(error.message || '') && /(status|trip_expires_at|source_kind|source_template_id|show_on_public_profile)/i.test(error.message || '')) {
        debugLog('dbListTrips:fallbackLegacySelect', { message: error.message });
        const fallback = await client
            .from('trips')
            .select('data')
            .eq('owner_id', currentUserId)
            .order('updated_at', { ascending: false });
        data = fallback.data as typeof data;
        error = fallback.error as typeof error;
    }

    if (error) {
        console.error('Failed to list trips', error);
        return [];
    }

    return (data || [])
        .map((row) => {
            const trip = row.data as ITrip;
            const rowId = (row as { id?: string }).id;
            const normalizedBase = trip && rowId && trip.id !== rowId ? { ...trip, id: rowId } : trip;
            if (!normalizedBase) return null;
            return applyTripAccessFields(normalizedBase, row as Record<string, unknown>);
        })
        .filter((trip): trip is ITrip => Boolean(trip && trip.status !== 'archived'));
};

export const uploadLocalTripsToDb = async () => {
    if (!DB_ENABLED) return;
    const trips = getAllTrips();
    if (trips.length === 0) return;
    const userId = await ensureDbSession();
    if (!userId) return;
    const client = requireSupabase();
    const remoteRowsById = new Map<string, {
        updatedAtMs: number | null;
        trip: ITrip | null;
    }>();

    const { data: remoteRows, error: remoteRowsError } = await client
        .from('trips')
        .select('id, updated_at, data')
        .eq('owner_id', userId);

    if (remoteRowsError) {
        console.error('Failed to read remote trips before local upload sync', remoteRowsError);
    } else if (Array.isArray(remoteRows)) {
        for (const row of remoteRows) {
            const rowId = typeof (row as { id?: unknown }).id === 'string'
                ? (row as { id: string }).id
                : null;
            if (!rowId) continue;
            const rowData = (row as { data?: unknown }).data;
            const rowTrip = rowData && typeof rowData === 'object' ? rowData as ITrip : null;
            const normalizedRowTrip = rowTrip
                ? (rowTrip.id === rowId ? rowTrip : { ...rowTrip, id: rowId })
                : null;
            remoteRowsById.set(rowId, {
                updatedAtMs: parseUpdatedAtIsoToMs((row as { updated_at?: unknown }).updated_at),
                trip: normalizedRowTrip,
            });
        }
    }

    for (const trip of trips) {
        const remoteRow = remoteRowsById.get(trip.id);
        if (remoteRow && !__shouldUploadLocalTripSnapshot({
            localTrip: trip,
            remoteTrip: remoteRow.trip,
            remoteUpdatedAtMs: remoteRow.updatedAtMs,
        })) {
            continue;
        }
        await dbUpsertTrip(trip);
    }
};

export const syncTripsFromDb = async () => {
    if (!DB_ENABLED) return;
    const trips = await dbListTrips();
    const shouldUseSimulatedMerge = import.meta.env.DEV && isSimulatedLoggedIn();
    if (shouldUseSimulatedMerge) {
        let shouldMergeLocalTrips = false;
        try {
            const client = requireSupabase();
            const { data: sessionData, error } = await client.auth.getSession();
            if (!error) {
                const sessionUser = sessionData?.session?.user as SessionUserLike | undefined;
                shouldMergeLocalTrips = isAnonymousSessionUser(sessionUser ?? null);
            }
        } catch {
            shouldMergeLocalTrips = false;
        }

        if (!shouldMergeLocalTrips) {
            setAllTrips(trips);
            return;
        }

        const localTrips = getAllTrips().filter((trip) => (trip.status || 'active') !== 'archived');
        const dbIds = new Set(trips.map((trip) => trip.id));
        const localOnlyTrips = localTrips.filter((trip) => !dbIds.has(trip.id));
        const merged = [...trips, ...localOnlyTrips]
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setAllTrips(merged);
        return;
    }
    setAllTrips(trips);
};

export interface DbArchiveTripOptions {
    source?: string;
    metadata?: Record<string, unknown>;
}

const normalizeArchiveSource = (source: string | undefined): string | null => {
    if (typeof source !== 'string') return null;
    const normalized = source.trim();
    return normalized ? normalized.slice(0, 120) : null;
};

const normalizeFailureText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 400) : null;
};

const logUserActionFailure = async (
    client: ReturnType<typeof requireSupabase>,
    payload: {
        action: string;
        targetType: string;
        targetId: string | null;
        actorUserId?: string | null;
        source: string | null;
        correlationId?: string | null;
        errorCode?: string | null;
        errorMessage?: string | null;
        metadata?: Record<string, unknown>;
    }
) => {
    try {
        const metadataWithCorrelation: Record<string, unknown> = {
            ...(payload.metadata ?? {}),
        };
        const existingCorrelationId = typeof metadataWithCorrelation.correlation_id === 'string'
            ? metadataWithCorrelation.correlation_id.trim()
            : '';
        const correlationId = existingCorrelationId || payload.correlationId || createEventCorrelationId();
        const existingEventId = typeof metadataWithCorrelation.event_id === 'string'
            ? metadataWithCorrelation.event_id.trim()
            : '';
        const existingEventKind = typeof metadataWithCorrelation.event_kind === 'string'
            ? metadataWithCorrelation.event_kind.trim()
            : '';
        const existingCausationId = typeof metadataWithCorrelation.causation_id === 'string'
            ? metadataWithCorrelation.causation_id.trim()
            : '';
        const existingSourceSurface = typeof metadataWithCorrelation.source_surface === 'string'
            ? metadataWithCorrelation.source_surface.trim()
            : '';
        const existingSchemaVersion = typeof metadataWithCorrelation.event_schema_version === 'number'
            ? metadataWithCorrelation.event_schema_version
            : 1;

        metadataWithCorrelation.event_schema_version = Number.isFinite(existingSchemaVersion)
            ? Math.max(1, Math.trunc(existingSchemaVersion))
            : 1;
        metadataWithCorrelation.event_id = existingEventId || createEventId();
        metadataWithCorrelation.event_kind = existingEventKind || payload.action;
        metadataWithCorrelation.correlation_id = correlationId;
        metadataWithCorrelation.causation_id = existingCausationId || correlationId;
        metadataWithCorrelation.source_surface = existingSourceSurface || payload.source;
        metadataWithCorrelation.actor_user_id = payload.actorUserId ?? null;
        metadataWithCorrelation.actor_type = 'user';
        metadataWithCorrelation.target_type = payload.targetType;
        metadataWithCorrelation.target_id = payload.targetId;
        metadataWithCorrelation.redaction_policy = 'error_safe_v1';

        await client.rpc('log_user_action_failure', {
            p_action: payload.action,
            p_target_type: payload.targetType,
            p_target_id: payload.targetId,
            p_source: payload.source,
            p_error_code: normalizeFailureText(payload.errorCode),
            p_error_message: normalizeFailureText(payload.errorMessage),
            p_metadata: metadataWithCorrelation,
        });
    } catch {
        // best effort failure logging only
    }
};

export const dbArchiveTrip = async (
    tripId: string,
    options?: DbArchiveTripOptions
): Promise<boolean> => {
    if (!DB_ENABLED) return true;
    const client = requireSupabase();
    const ownerId = await ensureExistingDbSession();
    if (!ownerId) return false;
    const beforeSnapshot = await readOwnedTripEventSnapshot(client, ownerId, tripId);
    const source = normalizeArchiveSource(options?.source);
    const metadata = options?.metadata && typeof options.metadata === 'object'
        ? options.metadata
        : {};
    const correlationId = normalizeCorrelationId(metadata.correlation_id) || createEventCorrelationId();
    const metadataWithCorrelation: Record<string, unknown> = {
        ...metadata,
        correlation_id: correlationId,
    };

    const rpcResult = await client.rpc('archive_trip_for_user', {
        p_trip_id: tripId,
        p_source: source,
        p_metadata: metadataWithCorrelation,
    });
    let error = rpcResult.error;
    let archived = false;

    if (!error) {
        const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
        archived = Boolean(
            row
            && typeof row.trip_id === 'string'
            && row.trip_id === tripId
            && (typeof row.status !== 'string' || row.status === 'archived')
        );
        if (!archived) {
            debugLog('dbArchiveTrip:rpcNoArchivedRow', { tripId, source });
        }
    }

    const isMissingArchiveFunction = Boolean(
        error
        && /function/i.test(error.message || '')
        && /archive_trip_for_user/i.test(error.message || '')
    );

    if (!archived && (isMissingArchiveFunction || !error)) {
        if (isMissingArchiveFunction) {
            debugLog('dbArchiveTrip:fallbackUpdate', { message: error?.message, tripId, source });
        } else {
            debugLog('dbArchiveTrip:fallbackAfterEmptyRpcResult', { tripId, source });
        }
        const fallbackUpdate = await client
            .from('trips')
            .update({
                status: 'archived',
                archived_at: new Date().toISOString(),
            })
            .eq('id', tripId)
            .select('id, status')
            .maybeSingle();
        error = fallbackUpdate.error;

        if (!error) {
            const row = fallbackUpdate.data as { id?: string; status?: string | null } | null;
            archived = Boolean(
                row
                && typeof row.id === 'string'
                && row.id === tripId
                && (row.status === null || row.status === undefined || row.status === 'archived')
            );
            if (!archived) {
                debugLog('dbArchiveTrip:fallbackNoArchivedRow', { tripId, source });
            }
        }
    }

    const normalizedErrorMessage = normalizeFailureText((error as DbErrorLike | null)?.message ?? null)?.toLowerCase() ?? '';
    const isServerLoggedOwnershipFailure = Boolean(
        error
        && !isMissingArchiveFunction
        && (
            (error as DbErrorLike).code === 'P0001'
            || normalizedErrorMessage.includes('not found or not owned')
        )
    );

    if (error || !archived) {
        if (!isServerLoggedOwnershipFailure) {
            await logUserActionFailure(client, {
                action: 'trip.archive_failed',
                targetType: 'trip',
                targetId: tripId,
                actorUserId: ownerId,
                source,
                correlationId,
                errorCode: normalizeFailureText((error as DbErrorLike | null)?.code ?? null),
                errorMessage: normalizeFailureText((error as DbErrorLike | null)?.message ?? 'Archive did not update any row'),
                metadata: {
                    correlation_id: correlationId,
                    trip_id: tripId,
                    source,
                    archive_metadata: metadata,
                },
            });
        }
        console.error('Failed to archive trip', error ?? { message: 'Archive did not update any row', tripId, source });
        return false;
    }
    await writeTripEventFallback(client, {
        ownerId,
        tripId,
        action: 'trip.archived',
        source: source || 'trip.archive',
        correlationId,
        metadata: {
            trip_id: tripId,
            status_before: beforeSnapshot?.status || 'active',
            status_after: 'archived',
        },
    });
    return true;
};

export const dbDeleteTrip = async (
    tripId: string,
    options?: DbArchiveTripOptions
): Promise<boolean> => {
    return dbArchiveTrip(tripId, {
        source: options?.source || 'legacy_delete',
        metadata: options?.metadata,
    });
};

export const dbCanCreateTrip = async (): Promise<{
    allowCreate: boolean;
    activeTripCount: number;
    maxTripCount: number;
}> => {
    const fallbackCount = getAllTrips().filter((trip) => (trip.status || 'active') !== 'archived').length;
    const fallbackMax = ANONYMOUS_TRIP_LIMIT;
    const fallbackResult = {
        allowCreate: fallbackCount < fallbackMax,
        activeTripCount: fallbackCount,
        maxTripCount: fallbackMax,
    };
    if (isSimulatedLoggedIn()) {
        return {
            allowCreate: true,
            activeTripCount: fallbackCount,
            maxTripCount: Number.MAX_SAFE_INTEGER,
        };
    }

    if (!DB_ENABLED) {
        return fallbackResult;
    }

    const client = requireSupabase();
    await ensureExistingDbSession();

    const { data, error } = await client.rpc('can_create_trip');
    if (error) {
        console.error('Failed to check trip creation limit', error);
        return fallbackResult;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const activeTripCountRaw = Number(row?.active_trip_count);
    const maxTripCountRaw = Number(row?.max_trip_count);
    const activeTripCount = Number.isFinite(activeTripCountRaw) ? activeTripCountRaw : fallbackCount;
    const maxTripCount = Number.isFinite(maxTripCountRaw) ? maxTripCountRaw : fallbackMax;
    const allowCreate = Boolean(row?.allow_create ?? activeTripCount < maxTripCount);

    return {
        allowCreate,
        activeTripCount,
        maxTripCount,
    };
};
