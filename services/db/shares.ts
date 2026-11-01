import type { ISharedTripResult, ISharedTripVersionResult, ITrip, ITripShareRecord, IViewSettings, ShareMode } from '../../types';
import { isUuid } from '../../utils';
import {
    applyTripAccessFields,
    DB_ENABLED,
    debugLog,
    normalizeTripForStorage,
    normalizeViewSettingsPayload,
    requireSupabase,
} from './internal';
import { ensureDbSession, ensureExistingDbSession } from './session';
import { createEventCorrelationId, writeTripEventFallback } from './tripEvents';

const TRIP_SHARE_VIEW_METADATA_KEY = 'shared_view_v1';

const extractShareViewSettingsPayload = (row: Record<string, unknown>): IViewSettings | null => {
    const directPayload = normalizeViewSettingsPayload(row.share_view_settings);
    if (directPayload) return directPayload;

    const metadata = row.share_metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

    const sharedViewEntry = (metadata as Record<string, unknown>)[TRIP_SHARE_VIEW_METADATA_KEY];
    if (!sharedViewEntry || typeof sharedViewEntry !== 'object' || Array.isArray(sharedViewEntry)) return null;

    return normalizeViewSettingsPayload((sharedViewEntry as Record<string, unknown>).view);
};

export const dbCreateShareLink = async (tripId: string, mode: ShareMode): Promise<{ token?: string; error?: string }> => {
    if (!DB_ENABLED) return { error: 'Database disabled' };
    const client = requireSupabase();
    const sessionId = await ensureExistingDbSession();
    if (!sessionId) {
        return { error: 'No authenticated session available' };
    }

    const { data, error } = await client
        .rpc('create_share_token', {
            p_trip_id: tripId,
            p_mode: mode,
            p_allow_copy: true
        });

    if (error) {
        console.error('Failed to create share link', error);
        return { error: error.message || 'Unknown error' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: 'No share token returned' };
    const token = row.token as string | undefined;
    if (token) {
        const correlationId = createEventCorrelationId();
        await writeTripEventFallback(client, {
            ownerId: sessionId,
            tripId,
            action: 'trip.share_created',
            source: 'trip.share_modal',
            correlationId,
            metadata: {
                trip_id: tripId,
                token,
                mode,
                allow_copy: true,
            },
        });
    }
    return token ? { token } : { error: 'Invalid share token' };
};

export const dbUpdateTripShareViewSettings = async (
    tripId: string,
    view: IViewSettings,
): Promise<boolean> => {
    if (!DB_ENABLED) return false;

    const normalizedView = normalizeViewSettingsPayload(view);
    if (!normalizedView) return false;

    const client = requireSupabase();
    const sessionId = await ensureExistingDbSession();
    if (!sessionId) return false;

    const { error } = await client.rpc('update_trip_share_view_settings', {
        p_trip_id: tripId,
        p_view: normalizedView,
    });

    if (error) {
        if (/update_trip_share_view_settings/i.test(error.message || '') && /function/i.test(error.message || '')) {
            debugLog('dbUpdateTripShareViewSettings:missingFunction', { message: error.message });
            return false;
        }
        console.error('Failed to sync trip share view settings', error);
        return false;
    }

    return true;
};

export const dbGetSharedTrip = async (token: string): Promise<ISharedTripResult | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureExistingDbSession();

    const { data, error } = await client.rpc('get_shared_trip', { p_token: token });
    if (error) {
        console.error('Failed to load shared trip', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const trip = row.data as ITrip;
    const normalizedBase = trip && row.trip_id && trip.id !== row.trip_id ? { ...trip, id: row.trip_id } : trip;
    if (!normalizedBase) return null;
    const normalized = applyTripAccessFields(normalizedBase, row as Record<string, unknown>);
    return {
        trip: normalized,
        view: normalizeViewSettingsPayload(row.view_settings),
        shareView: extractShareViewSettingsPayload(row as Record<string, unknown>),
        mode: row.mode as ShareMode,
        allowCopy: Boolean(row.allow_copy),
        latestVersionId: (row.latest_version_id as string | null | undefined) ?? null,
    };
};

export const dbGetSharedTripVersion = async (
    token: string,
    versionId: string
): Promise<ISharedTripVersionResult | null> => {
    if (!isUuid(versionId)) return null;
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureExistingDbSession();

    const { data, error } = await client.rpc('get_shared_trip_version', {
        p_token: token,
        p_version_id: versionId,
    });
    if (error) {
        console.error('Failed to load shared trip version', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const trip = row.data as ITrip;
    const normalizedBase = trip && row.trip_id && trip.id !== row.trip_id ? { ...trip, id: row.trip_id } : trip;
    if (!normalizedBase) return null;
    const normalized = applyTripAccessFields(normalizedBase, row as Record<string, unknown>);
    const resolvedVersionId = (row.version_id as string | undefined) || versionId;

    return {
        trip: normalized,
        view: normalizeViewSettingsPayload(row.view_settings),
        shareView: extractShareViewSettingsPayload(row as Record<string, unknown>),
        mode: row.mode as ShareMode,
        allowCopy: Boolean(row.allow_copy),
        latestVersionId: (row.latest_version_id as string | null | undefined) ?? null,
        versionId: resolvedVersionId,
    };
};

export const dbUpdateSharedTrip = async (
    token: string,
    trip: ITrip,
    view: IViewSettings | undefined,
    label?: string | null
) => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();

    const normalizedTrip = normalizeTripForStorage(trip);
    const normalizedView = normalizeViewSettingsPayload(view ?? null);
    const { data, error } = await client.rpc('update_shared_trip', {
        p_token: token,
        p_data: normalizedTrip,
        p_view: normalizedView,
        p_label: label ?? null
    });

    if (error) {
        console.error('Failed to update shared trip', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return row.version_id as string | null;
};

export const dbListTripShares = async (tripId?: string): Promise<ITripShareRecord[]> => {
    if (!DB_ENABLED) return [];
    const client = requireSupabase();
    const sessionId = await ensureExistingDbSession();
    if (!sessionId) return [];

    let query = client
        .from('trip_shares')
        .select('id, trip_id, token, mode, allow_copy, created_at, expires_at, revoked_at')
        .order('created_at', { ascending: false });

    if (tripId) {
        query = query.eq('trip_id', tripId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Failed to list trip shares', error);
        return [];
    }

    const nowMs = Date.now();
    return (data || []).map((row) => {
        const expiresAt = row.expires_at as string | null | undefined;
        const revokedAt = row.revoked_at as string | null | undefined;
        const expiresMs = expiresAt ? Date.parse(expiresAt) : null;
        const isExpired = typeof expiresMs === 'number' && Number.isFinite(expiresMs) && expiresMs <= nowMs;
        const isActive = !revokedAt && !isExpired;

        return {
            id: row.id as string,
            tripId: row.trip_id as string,
            token: row.token as string,
            mode: row.mode as ShareMode,
            allowCopy: Boolean(row.allow_copy),
            createdAt: row.created_at as string,
            expiresAt: expiresAt ?? null,
            revokedAt: revokedAt ?? null,
            isActive,
        };
    });
};

export const dbSetTripSharingEnabled = async (tripId: string, enabled: boolean): Promise<boolean> => {
    if (!DB_ENABLED) return false;
    const client = requireSupabase();
    const sessionId = await ensureExistingDbSession();
    if (!sessionId) return false;

    const { error } = await client
        .from('trips')
        .update({ sharing_enabled: enabled })
        .eq('id', tripId);

    if (error) {
        if (/column/i.test(error.message || '') && /sharing_enabled/i.test(error.message || '')) {
            debugLog('dbSetTripSharingEnabled:missingColumn', { message: error.message });
            return false;
        }
        console.error('Failed to update trip sharing flag', error);
        return false;
    }

    return true;
};

export const dbRevokeTripShares = async (tripId: string): Promise<number> => {
    if (!DB_ENABLED) return 0;
    const client = requireSupabase();
    const sessionId = await ensureExistingDbSession();
    if (!sessionId) return 0;

    const { data, error } = await client
        .from('trip_shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('trip_id', tripId)
        .is('revoked_at', null)
        .select('id');

    if (error) {
        console.error('Failed to revoke trip share links', error);
        return 0;
    }

    return Array.isArray(data) ? data.length : 0;
};
