import { ISharedTripResult, ISharedTripVersionResult, ITrip, ITripShareRecord, IViewSettings, IUserSettings, ShareMode } from '../types';
import { isUuid } from '../utils';
import { supabase, isSupabaseEnabled } from './supabaseClient';
import { getAllTrips, setAllTrips } from './storageService';
import { ANONYMOUS_TRIP_LIMIT, isTripExpiredByTimestamp } from '../config/productLimits';
import { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin } from './simulatedLoginService';

export const DB_ENABLED = isSupabaseEnabled;
export { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin };

let cachedUserId: string | null = null;
let isReauthInFlight = false;
let sessionPromise: Promise<string | null> | null = null;
let lastAuthAttemptAt = 0;
let lastReauthAt = 0;
let debugAuthChecked = false;
let authBlockedUntil = 0;

const AUTH_COOLDOWN_MS = 3000;
const SESSION_POLL_MS = 200;
const SESSION_POLL_ATTEMPTS = 6;

const isDebugEnabled = () => {
    if (typeof window === 'undefined') return false;
    try {
        if (window.localStorage.getItem('tf_debug_db') === '1') return true;
    } catch {
        // ignore
    }
    return import.meta.env.VITE_DEBUG_DB === 'true';
};

const debugLog = (...args: unknown[]) => {
    if (!isDebugEnabled()) return;
    console.log('[db]', ...args);
};

const maybeLogAuthContext = async () => {
    if (!isDebugEnabled()) return;
    if (debugAuthChecked) return;
    debugAuthChecked = true;
    try {
        const client = requireSupabase();
        const { data, error } = await client.rpc('debug_auth_context');
        if (error) {
            debugLog('debug_auth_context:missing', { message: error.message });
            return;
        }
        debugLog('debug_auth_context', data);
    } catch (e) {
        debugLog('debug_auth_context:error', e);
    }
};

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase client not configured');
    }
    return supabase;
};

export const ensureDbSession = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    if (sessionPromise) return sessionPromise;
    const client = requireSupabase();
    sessionPromise = (async () => {
        try {
            debugLog('ensureDbSession:start');
            const pollForSession = async () => {
                for (let i = 0; i < SESSION_POLL_ATTEMPTS; i += 1) {
                    const { data: sessionData, error: sessionError } = await client.auth.getSession();
                    if (sessionError) {
                        console.warn('Supabase session error', sessionError);
                    }
                    const sessionUserId = sessionData?.session?.user?.id ?? null;
                    if (sessionUserId) {
                        debugLog('ensureDbSession:session', { userId: sessionUserId, expiresAt: sessionData?.session?.expires_at });
                        return sessionUserId;
                    }
                    if (i < SESSION_POLL_ATTEMPTS - 1) {
                        await new Promise(resolve => setTimeout(resolve, SESSION_POLL_MS));
                    }
                }
                return null;
            };

            const existingSessionUserId = await pollForSession();
            if (existingSessionUserId) {
                cachedUserId = existingSessionUserId;
                await maybeLogAuthContext();
                return cachedUserId;
            }

            cachedUserId = null;
            const now = Date.now();
            if (authBlockedUntil && now < authBlockedUntil) {
                debugLog('ensureDbSession:blocked', { until: authBlockedUntil });
                return null;
            }
            if (now - lastAuthAttemptAt < AUTH_COOLDOWN_MS) {
                return null;
            }
            lastAuthAttemptAt = now;

            const { data, error } = await client.auth.signInAnonymously();
            if (error) {
                console.error('Supabase anonymous sign-in failed', error);
                if (error.status === 429 || /rate limit/i.test(error.message || '')) {
                    authBlockedUntil = Date.now() + 60000;
                }
                return null;
            }
            if (data?.session) {
                try {
                    await client.auth.setSession({
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                    });
                } catch (e) {
                    console.warn('Supabase setSession failed after anonymous sign-in', e);
                }
                if (data.session.user?.id) {
                    debugLog('ensureDbSession:signIn', { userId: data.session.user.id });
                    cachedUserId = data.session.user.id;
                    await maybeLogAuthContext();
                    return cachedUserId;
                }
            }
            const sessionAfterSignIn = await pollForSession();
            if (sessionAfterSignIn) {
                cachedUserId = sessionAfterSignIn;
                await maybeLogAuthContext();
                return cachedUserId;
            }
            return null;
        } finally {
            sessionPromise = null;
        }
    })();

    return sessionPromise;
};

export const dbGetAccessToken = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();
    const { data, error } = await client.auth.getSession();
    if (error) {
        console.error('Failed to read Supabase access token', error);
        return null;
    }
    return data?.session?.access_token ?? null;
};

const isRlsViolation = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (error.code === '42501') return true;
    return typeof error.message === 'string' && /row-level security/i.test(error.message);
};

const forceAnonymousSession = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    if (isReauthInFlight) return cachedUserId;
    const now = Date.now();
    if (now - lastReauthAt < AUTH_COOLDOWN_MS) return cachedUserId;
    lastReauthAt = now;
    isReauthInFlight = true;
    const client = requireSupabase();
    try {
        await client.auth.signOut();
    } catch (e) {
        console.warn('Supabase signOut failed during reauth', e);
    }
    cachedUserId = null;
    const userId = await ensureDbSession();
    isReauthInFlight = false;
    return userId;
};

const isLayoutModeValue = (value: unknown): value is IViewSettings['layoutMode'] =>
    value === 'vertical' || value === 'horizontal';

const isTimelineViewValue = (value: unknown): value is IViewSettings['timelineView'] =>
    value === 'vertical' || value === 'horizontal';

const isMapStyleValue = (value: unknown): value is IViewSettings['mapStyle'] =>
    value === 'minimal' || value === 'standard' || value === 'dark' || value === 'satellite' || value === 'clean';

const isRouteModeValue = (value: unknown): value is NonNullable<IViewSettings['routeMode']> =>
    value === 'simple' || value === 'realistic';

const normalizeFiniteNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const normalizeViewSettingsPayload = (value: unknown): IViewSettings | null => {
    if (!value || typeof value !== 'object') return null;
    const view = value as Partial<IViewSettings>;
    return {
        layoutMode: isLayoutModeValue(view.layoutMode) ? view.layoutMode : 'horizontal',
        timelineView: isTimelineViewValue(view.timelineView) ? view.timelineView : 'horizontal',
        mapStyle: isMapStyleValue(view.mapStyle) ? view.mapStyle : 'standard',
        zoomLevel: normalizeFiniteNumber(view.zoomLevel) ?? 1,
        routeMode: isRouteModeValue(view.routeMode) ? view.routeMode : undefined,
        showCityNames: typeof view.showCityNames === 'boolean' ? view.showCityNames : undefined,
        sidebarWidth: normalizeFiniteNumber(view.sidebarWidth),
        timelineHeight: normalizeFiniteNumber(view.timelineHeight),
    };
};

const normalizeTripForStorage = (trip: ITrip): ITrip => ({
    ...trip,
    defaultView: normalizeViewSettingsPayload(trip.defaultView ?? null) ?? undefined,
});

const normalizeTripPayload = (trip: ITrip, view?: IViewSettings | null) => {
    const normalizedTrip = normalizeTripForStorage(trip);
    const normalizedView = normalizeViewSettingsPayload(view ?? null);
    const startDate = normalizedTrip.startDate ? normalizedTrip.startDate.split('T')[0] : null;
    const status = normalizedTrip.status && ['active', 'archived', 'expired'].includes(normalizedTrip.status)
        ? normalizedTrip.status
        : 'active';
    return {
        id: normalizedTrip.id,
        title: normalizedTrip.title || 'Untitled trip',
        start_date: startDate,
        data: normalizedTrip,
        view_settings: normalizedView,
        is_favorite: Boolean(normalizedTrip.isFavorite),
        forked_from_trip_id: normalizedTrip.forkedFromTripId ?? null,
        forked_from_share_token: normalizedTrip.forkedFromShareToken ?? null,
        status,
        trip_expires_at: normalizedTrip.tripExpiresAt ?? null,
        source_kind: normalizedTrip.sourceKind ?? null,
        source_template_id: normalizedTrip.sourceTemplateId ?? null,
    };
};

const resolveTripStatus = (status: unknown, tripExpiresAt: string | null): ITrip['status'] => {
    if (status === 'archived') return 'archived';
    if (status === 'expired') return 'expired';
    if (isTripExpiredByTimestamp(tripExpiresAt)) return 'expired';
    return 'active';
};

const applyTripAccessFields = (
    trip: ITrip,
    row: {
        status?: unknown;
        trip_expires_at?: unknown;
        source_kind?: unknown;
        source_template_id?: unknown;
    }
): ITrip => {
    const tripExpiresAt = typeof row.trip_expires_at === 'string'
        ? row.trip_expires_at
        : (typeof trip.tripExpiresAt === 'string' ? trip.tripExpiresAt : null);
    const sourceTemplateId = typeof row.source_template_id === 'string'
        ? row.source_template_id
        : (typeof trip.sourceTemplateId === 'string' ? trip.sourceTemplateId : null);
    return {
        ...trip,
        status: resolveTripStatus(row.status, tripExpiresAt),
        tripExpiresAt,
        sourceKind: typeof row.source_kind === 'string' ? row.source_kind as ITrip['sourceKind'] : trip.sourceKind,
        sourceTemplateId,
    };
};

export const dbUpsertTrip = async (trip: ITrip, view?: IViewSettings | null) => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const ownerId = await ensureDbSession();
    if (!ownerId) return null;

    debugLog('dbUpsertTrip:start', { tripId: trip.id, ownerId });

    const normalizedTrip = normalizeTripForStorage(trip);
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
        p_forked_from_trip_id: normalizedTrip.forkedFromTripId ?? null,
        p_forked_from_share_token: normalizedTrip.forkedFromShareToken ?? null,
        p_status: status,
        p_trip_expires_at: normalizedTrip.tripExpiresAt ?? null,
        p_source_kind: normalizedTrip.sourceKind ?? null,
        p_source_template_id: normalizedTrip.sourceTemplateId ?? null,
    };

    let { data, error } = await client.rpc('upsert_trip', extendedPayload);
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
            return trip.id;
        }
        if (isRlsViolation(error)) {
            debugLog('dbUpsertTrip:rls', { code: error.code, message: error.message });
        }
        console.error('Failed to upsert trip', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        debugLog('dbUpsertTrip:empty', { tripId: trip.id });
    }
    return (row?.trip_id ?? row?.id) ?? null;
};

export const dbGetTrip = async (tripId: string) => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();

    let { data, error } = await client
        .from('trips')
        .select('id, data, view_settings, status, trip_expires_at, source_kind, source_template_id')
        .eq('id', tripId)
        .maybeSingle();

    if (error && /column/i.test(error.message || '') && /(status|trip_expires_at|source_kind|source_template_id)/i.test(error.message || '')) {
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

    if (!data) return null;
    const trip = data.data as ITrip;
    const normalizedBase = trip && trip.id !== data.id ? { ...trip, id: data.id } : trip;
    if (!normalizedBase) return null;
    const normalized = applyTripAccessFields(normalizedBase, data as Record<string, unknown>);
    if (normalized.status === 'archived') return null;
    return { trip: normalized, view: normalizeViewSettingsPayload(data.view_settings) };
};

export const dbGetTripVersion = async (tripId: string, versionId: string) => {
    if (!isUuid(versionId)) return null;
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();

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
    await ensureDbSession();

    const normalizedTrip = normalizeTripForStorage(trip);
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
    return (row?.trip_id ?? row?.id) ?? null;
};

export const dbListTrips = async (): Promise<ITrip[]> => {
    if (!DB_ENABLED) return [];
    const client = requireSupabase();
    await ensureDbSession();

    let { data, error } = await client
        .from('trips')
        .select('id, data, status, trip_expires_at, source_kind, source_template_id')
        .neq('status', 'archived')
        .order('updated_at', { ascending: false });

    if (error && /column/i.test(error.message || '') && /(status|trip_expires_at|source_kind|source_template_id)/i.test(error.message || '')) {
        debugLog('dbListTrips:fallbackLegacySelect', { message: error.message });
        const fallback = await client
            .from('trips')
            .select('data')
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
    for (const trip of trips) {
        await dbUpsertTrip(trip);
    }
};

export const syncTripsFromDb = async () => {
    if (!DB_ENABLED) return;
    const trips = await dbListTrips();
    if (isSimulatedLoggedIn()) {
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

export const dbDeleteTrip = async (tripId: string) => {
    if (!DB_ENABLED) return;
    const client = requireSupabase();
    await ensureDbSession();
    let { error } = await client
        .from('trips')
        .update({
            status: 'archived',
            archived_at: new Date().toISOString(),
        })
        .eq('id', tripId);
    if (error && /column/i.test(error.message || '') && /(status|archived_at)/i.test(error.message || '')) {
        debugLog('dbDeleteTrip:fallbackHardDelete', { message: error.message });
        const fallback = await client.from('trips').delete().eq('id', tripId);
        error = fallback.error;
    }
    if (error) {
        console.error('Failed to delete trip', error);
    }
};

export const dbGetUserSettings = async (): Promise<IUserSettings | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const userId = await ensureDbSession();
    if (!userId) return null;

    const { data, error } = await client
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch user settings', error);
        return null;
    }

    if (!data) return null;

    return {
        language: data.language ?? undefined,
        mapStyle: data.map_style ?? undefined,
        routeMode: data.route_mode ?? undefined,
        layoutMode: data.layout_mode ?? undefined,
        timelineView: data.timeline_view ?? undefined,
        showCityNames: data.show_city_names ?? undefined,
        zoomLevel: typeof data.zoom_level === 'number' ? data.zoom_level : undefined,
        sidebarWidth: typeof data.sidebar_width === 'number' ? data.sidebar_width : undefined,
        timelineHeight: typeof data.timeline_height === 'number' ? data.timeline_height : undefined,
    } as IUserSettings;
};

export const dbUpsertUserSettings = async (settings: IUserSettings) => {
    if (!DB_ENABLED) return;
    const client = requireSupabase();
    const userId = await ensureDbSession();
    if (!userId) return;

    const payload = {
        user_id: userId,
        language: settings.language,
        map_style: settings.mapStyle,
        route_mode: settings.routeMode,
        layout_mode: settings.layoutMode,
        timeline_view: settings.timelineView,
        show_city_names: settings.showCityNames,
        zoom_level: settings.zoomLevel,
        sidebar_width: settings.sidebarWidth,
        timeline_height: settings.timelineHeight,
    };

    const { error } = await client.from('user_settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
        console.error('Failed to save user settings', error);
    }
};

export const dbCreateShareLink = async (tripId: string, mode: ShareMode): Promise<{ token?: string; error?: string }> => {
    if (!DB_ENABLED) return { error: 'Database disabled' };
    const client = requireSupabase();
    const sessionId = await ensureDbSession();
    if (!sessionId) {
        return { error: 'Anonymous auth is disabled or failed to start' };
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
    return token ? { token } : { error: 'Invalid share token' };
};

export const dbGetSharedTrip = async (token: string): Promise<ISharedTripResult | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();

    const { data, error } = await client.rpc('get_shared_trip', { p_token: token });
    if (error) {
        console.error('Failed to load shared trip', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const trip = row.data as ITrip;
    const normalized = trip && row.trip_id && trip.id !== row.trip_id ? { ...trip, id: row.trip_id } : trip;
    return {
        trip: normalized,
        view: normalizeViewSettingsPayload(row.view_settings),
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
    await ensureDbSession();

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
    const normalized = trip && row.trip_id && trip.id !== row.trip_id ? { ...trip, id: row.trip_id } : trip;
    const resolvedVersionId = (row.version_id as string | undefined) || versionId;

    return {
        trip: normalized,
        view: normalizeViewSettingsPayload(row.view_settings),
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
    await ensureDbSession();

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
    await ensureDbSession();

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
    await ensureDbSession();

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
    await ensureDbSession();

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

export const applyUserSettingsToLocalStorage = (settings: IUserSettings | null) => {
    if (!settings || typeof window === 'undefined') return;
    if (settings.mapStyle) localStorage.setItem('tf_map_style', settings.mapStyle);
    if (settings.routeMode) localStorage.setItem('tf_route_mode', settings.routeMode);
    if (settings.layoutMode) localStorage.setItem('tf_layout_mode', settings.layoutMode);
    if (settings.timelineView) localStorage.setItem('tf_timeline_view', settings.timelineView);
    if (typeof settings.showCityNames === 'boolean') localStorage.setItem('tf_city_names', String(settings.showCityNames));
    if (typeof settings.zoomLevel === 'number') localStorage.setItem('tf_zoom_level', settings.zoomLevel.toFixed(2));
    if (typeof settings.sidebarWidth === 'number') localStorage.setItem('tf_sidebar_width', String(settings.sidebarWidth));
    if (typeof settings.timelineHeight === 'number') localStorage.setItem('tf_timeline_height', String(settings.timelineHeight));
};
