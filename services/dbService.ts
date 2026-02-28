import { ISharedTripResult, ISharedTripVersionResult, ITrip, ITripShareRecord, ITimelineItem, IViewSettings, IUserSettings, ShareMode } from '../types';
import { isUuid } from '../utils';
import { supabase, isSupabaseEnabled } from './supabaseClient';
import {
    readLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';
import { getAllTrips, setAllTrips } from './storageService';
import { ANONYMOUS_TRIP_LIMIT, isTripExpiredByTimestamp } from '../config/productLimits';
import { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin } from './simulatedLoginService';

export const DB_ENABLED = isSupabaseEnabled;
export { isSimulatedLoggedIn, setSimulatedLoggedIn, toggleSimulatedLogin };

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

export interface DbAnonymousAssetClaimResult {
    claimId: string;
    status: 'pending' | 'claimed' | 'expired' | 'failed' | 'revoked';
    expiresAtIso: string;
}

export interface DbClaimAnonymousAssetsResult {
    claimId: string;
    status: string;
    targetUserId: string | null;
    anonUserId: string | null;
    transferredTrips: number;
    transferredTripEvents: number;
    transferredProfileEvents: number;
    transferredTripVersions: number;
    transferredTripShares: number;
    transferredCollaborators: number;
    deduplicatedCollaborators: number;
}

let cachedUserId: string | null = null;
let sessionPromise: Promise<string | null> | null = null;
let lastAuthAttemptAt = 0;
let debugAuthChecked = false;
let authBlockedUntil = 0;

const AUTH_COOLDOWN_MS = 3000;
const SESSION_POLL_MS = 200;
const SESSION_POLL_ATTEMPTS = 6;

const isDebugEnabled = () => {
    if (typeof window === 'undefined') return false;
    try {
        if (readLocalStorageItem('tf_debug_db') === '1') return true;
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

const normalizeUsernameHandle = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/^@+/, '');
};

type SessionUserLike = {
    email?: string | null;
    phone?: string | null;
    is_anonymous?: boolean;
    app_metadata?: Record<string, unknown>;
    identities?: Array<{ provider?: string | null }>;
};

const isAnonymousSessionUser = (user: SessionUserLike | null | undefined): boolean => {
    if (!user) return true;
    if ((typeof user.email === 'string' && user.email.trim()) || (typeof user.phone === 'string' && user.phone.trim())) {
        return false;
    }
    const metadata = user.app_metadata;
    const provider = typeof metadata?.provider === 'string' ? metadata.provider.trim().toLowerCase() : '';
    const providersFromMetadata = Array.isArray(metadata?.providers)
        ? metadata.providers
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim().toLowerCase())
        : [];
    const providersFromIdentities = Array.isArray(user.identities)
        ? user.identities
            .map((identity) => (typeof identity?.provider === 'string' ? identity.provider.trim().toLowerCase() : ''))
            .filter(Boolean)
        : [];
    const providers = Array.from(new Set([provider, ...providersFromMetadata, ...providersFromIdentities].filter(Boolean)));
    const hasNonAnonymousProvider = providers.some((entry) => entry !== 'anonymous');
    if (hasNonAnonymousProvider) return false;
    if (user.is_anonymous === true) return true;
    if (metadata?.is_anonymous === true) return true;
    return providers.includes('anonymous');
};

const maybeDisableSimulatedLoginForRealSession = (sessionUser: SessionUserLike | null | undefined): void => {
    if (!import.meta.env.DEV) return;
    if (!isSimulatedLoggedIn()) return;
    if (isAnonymousSessionUser(sessionUser ?? null)) return;
    setSimulatedLoggedIn(false);
    debugLog('simulatedLogin:autoDisabledForRealSession');
};

const pollForSessionUserId = async (
    client: ReturnType<typeof requireSupabase>
): Promise<string | null> => {
    for (let i = 0; i < SESSION_POLL_ATTEMPTS; i += 1) {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) {
            console.warn('Supabase session error', sessionError);
        }
        const sessionUserId = sessionData?.session?.user?.id ?? null;
        if (sessionUserId) {
            maybeDisableSimulatedLoginForRealSession(sessionData?.session?.user as SessionUserLike | undefined);
            debugLog('ensureDbSession:session', { userId: sessionUserId, expiresAt: sessionData?.session?.expires_at });
            return sessionUserId;
        }
        if (i < SESSION_POLL_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, SESSION_POLL_MS));
        }
    }
    return null;
};

export const ensureExistingDbSession = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const sessionUserId = await pollForSessionUserId(client);
    if (sessionUserId) {
        cachedUserId = sessionUserId;
        await maybeLogAuthContext();
        return cachedUserId;
    }
    cachedUserId = null;
    return null;
};

export const ensureDbSession = async (): Promise<string | null> => {
    if (!DB_ENABLED) return null;
    if (sessionPromise) return sessionPromise;
    const client = requireSupabase();
    sessionPromise = (async () => {
        try {
            debugLog('ensureDbSession:start');
            const existingSessionUserId = await pollForSessionUserId(client);
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
            const sessionAfterSignIn = await pollForSessionUserId(client);
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
    await ensureExistingDbSession();
    const { data, error } = await client.auth.getSession();
    if (error) {
        console.error('Failed to read Supabase access token', error);
        return null;
    }
    return data?.session?.access_token ?? null;
};

type DbErrorLike = {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
    constraint?: string | null;
};

const isRlsViolation = (error: DbErrorLike | null) => {
    if (!error) return false;
    if (error.code === '42501') return true;
    return typeof error.message === 'string' && /row-level security/i.test(error.message);
};

const isMissingUserSettingsOwnerError = (error: DbErrorLike | null): boolean => {
    if (!error || error.code !== '23503') return false;
    const message = `${error.message || ''} ${error.details || ''} ${error.constraint || ''}`.toLowerCase();
    return message.includes('user_settings_user_id_fkey')
        || message.includes('key is not present in table \"users\"')
        || message.includes('references auth.users');
};

const isAnonymousAuthSession = (
    session: {
        user?: {
            email?: string | null;
            phone?: string | null;
            app_metadata?: Record<string, unknown> | null;
            identities?: Array<{ provider?: string | null }> | null;
        } | null;
    } | null | undefined
): boolean => {
    const user = session?.user;
    if (!user) return false;
    if (user.email || user.phone) return false;

    const metadata = user.app_metadata ?? {};
    const provider = typeof metadata.provider === 'string' ? metadata.provider.trim().toLowerCase() : '';
    const providersFromMetadata = Array.isArray(metadata.providers)
        ? metadata.providers
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase())
        : [];
    const providersFromIdentities = Array.isArray(user.identities)
        ? user.identities
            .map((identity) => (typeof identity?.provider === 'string' ? identity.provider.trim().toLowerCase() : ''))
            .filter(Boolean)
        : [];

    const providers = [provider, ...providersFromMetadata, ...providersFromIdentities].filter(Boolean);
    if (providers.some((value) => value !== 'anonymous')) return false;
    return Boolean(metadata.is_anonymous === true || providers.includes('anonymous'));
};

const getAuthenticatedNonAnonymousUserId = async (): Promise<string | null> => {
    const client = requireSupabase();
    const { data: sessionData, error } = await client.auth.getSession();
    if (error) {
        debugLog('getAuthenticatedNonAnonymousUserId:sessionError', {
            message: error.message,
        });
        return null;
    }
    const session = sessionData?.session ?? null;
    if (!session?.user?.id) return null;
    if (isAnonymousAuthSession(session)) return null;
    return session.user.id;
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
        show_on_public_profile: normalizedTrip.showOnPublicProfile !== false,
        forked_from_trip_id: normalizedTrip.forkedFromTripId ?? null,
        forked_from_share_token: normalizedTrip.forkedFromShareToken ?? null,
        status,
        trip_expires_at: normalizedTrip.tripExpiresAt ?? null,
        source_kind: normalizedTrip.sourceKind ?? null,
        source_template_id: normalizedTrip.sourceTemplateId ?? null,
    };
};

interface TripEventSnapshot {
    title: string;
    status: 'active' | 'archived' | 'expired';
    showOnPublicProfile: boolean;
    tripExpiresAt: string | null;
    sourceKind: string | null;
}

type TripVersionSnapshot = {
    versionId: string | null;
    label: string | null;
    trip: ITrip | null;
};

const MAX_TIMELINE_DIFF_ITEMS = 8;
const VISUAL_LABEL_PREFIX = /^\s*visual\s*:\s*/i;

interface TripTimelineDiffSummary {
    counts: {
        deleted_items: number;
        added_items: number;
        transport_mode_changes: number;
        updated_items: number;
    };
    deleted_items: Array<Record<string, unknown>>;
    added_items: Array<Record<string, unknown>>;
    transport_mode_changes: Array<Record<string, unknown>>;
    updated_items: Array<Record<string, unknown>>;
    truncated: boolean;
}

interface TripTimelineVisualChange {
    field: string;
    label: string;
    before_value: string | null;
    after_value: string | null;
    summary: string;
}

type TripSecondaryActionCode =
    | 'trip.city.updated'
    | 'trip.activity.updated'
    | 'trip.activity.deleted'
    | 'trip.transport.updated'
    | 'trip.segment.deleted'
    | 'trip.trip_dates.updated'
    | 'trip.visibility.updated';

const asTimelineDiffItems = (value: unknown): Array<Record<string, unknown>> => (
    Array.isArray(value)
        ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        : []
);

const readTimelineEntryItemType = (entry: Record<string, unknown>): string | null => {
    const direct = typeof entry.item_type === 'string' ? entry.item_type.trim().toLowerCase() : '';
    if (direct) return direct;
    const before = entry.before;
    if (before && typeof before === 'object' && !Array.isArray(before)) {
        const beforeType = typeof (before as Record<string, unknown>).type === 'string'
            ? (before as Record<string, unknown>).type.trim().toLowerCase()
            : '';
        if (beforeType) return beforeType;
    }
    const after = entry.after;
    if (after && typeof after === 'object' && !Array.isArray(after)) {
        const afterType = typeof (after as Record<string, unknown>).type === 'string'
            ? (after as Record<string, unknown>).type.trim().toLowerCase()
            : '';
        if (afterType) return afterType;
    }
    return null;
};

const hasTimelineDateFieldChange = (entry: Record<string, unknown>): boolean => {
    const changedFields = Array.isArray(entry.changed_fields)
        ? entry.changed_fields.filter((field): field is string => typeof field === 'string')
        : [];
    return changedFields.some((field) => (
        field === 'start_date_offset'
        || field === 'duration'
    ));
};

const buildTripSecondaryActionCodes = (
    timelineDiffV1: Record<string, unknown> | null,
    options?: {
        previousTrip?: ITrip | null;
        nextTrip?: ITrip | null;
        visibilityChanged?: boolean;
    }
): TripSecondaryActionCode[] => {
    const codes = new Set<TripSecondaryActionCode>();

    if (timelineDiffV1) {
        const transportModeChanges = asTimelineDiffItems(timelineDiffV1.transport_mode_changes);
        if (transportModeChanges.length > 0) {
            codes.add('trip.transport.updated');
        }

        const deletedItems = asTimelineDiffItems(timelineDiffV1.deleted_items);
        deletedItems.forEach((entry) => {
            const itemType = readTimelineEntryItemType(entry);
            if (itemType === 'activity') {
                codes.add('trip.activity.deleted');
            }
            if (itemType === 'travel-empty' || itemType === 'travel') {
                codes.add('trip.segment.deleted');
            }
        });

        const updatedItems = asTimelineDiffItems(timelineDiffV1.updated_items);
        updatedItems.forEach((entry) => {
            const itemType = readTimelineEntryItemType(entry);
            if (itemType === 'activity') {
                codes.add('trip.activity.updated');
            }
            if (itemType === 'city') {
                codes.add('trip.city.updated');
            }
            if (itemType === 'travel' && hasTimelineDateFieldChange(entry)) {
                codes.add('trip.trip_dates.updated');
            }
            if (itemType === 'city' && hasTimelineDateFieldChange(entry)) {
                codes.add('trip.trip_dates.updated');
            }
        });
    }

    if (options?.previousTrip && options.nextTrip && options.previousTrip.startDate !== options.nextTrip.startDate) {
        codes.add('trip.trip_dates.updated');
    }

    if (options?.visibilityChanged) {
        codes.add('trip.visibility.updated');
    }

    return Array.from(codes).sort();
};

const createEventCorrelationId = (): string => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch {
        // fallback below
    }
    return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeCorrelationId = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 160);
};

const createDeterministicCorrelationId = (prefix: string, parts: Array<string | number | null | undefined>): string => {
    const normalizedParts = parts
        .map((part) => {
            if (part === null || part === undefined) return '';
            return String(part)
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
        })
        .filter(Boolean);
    if (normalizedParts.length === 0) return createEventCorrelationId();
    return `${prefix}-${normalizedParts.join('-')}`.slice(0, 180);
};

const toTripEventSnapshotFromTrip = (trip: ITrip): TripEventSnapshot => ({
    title: (trip.title || 'Untitled trip').trim() || 'Untitled trip',
    status: trip.status && ['active', 'archived', 'expired'].includes(trip.status)
        ? trip.status
        : 'active',
    showOnPublicProfile: trip.showOnPublicProfile !== false,
    tripExpiresAt: typeof trip.tripExpiresAt === 'string' ? trip.tripExpiresAt : null,
    sourceKind: typeof trip.sourceKind === 'string' && trip.sourceKind.trim()
        ? trip.sourceKind.trim()
        : null,
});

const toTripEventSource = (value: string | null | undefined): string => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return 'trip.editor';
    return normalized.slice(0, 120);
};

const readOwnedTripEventSnapshot = async (
    client: ReturnType<typeof requireSupabase>,
    ownerId: string,
    tripId: string
): Promise<TripEventSnapshot | null> => {
    const { data, error } = await client
        .from('trips')
        .select('title, status, show_on_public_profile, trip_expires_at, source_kind')
        .eq('id', tripId)
        .eq('owner_id', ownerId)
        .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const status = typeof data.status === 'string' && ['active', 'archived', 'expired'].includes(data.status)
        ? data.status as TripEventSnapshot['status']
        : 'active';
    return {
        title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Untitled trip',
        status,
        showOnPublicProfile: data.show_on_public_profile !== false,
        tripExpiresAt: typeof data.trip_expires_at === 'string' ? data.trip_expires_at : null,
        sourceKind: typeof data.source_kind === 'string' && data.source_kind.trim() ? data.source_kind.trim() : null,
    };
};

const toTimelineDiffItemSnapshot = (item: ITimelineItem): Record<string, unknown> => ({
    id: item.id,
    type: item.type,
    title: item.title,
    start_date_offset: item.startDateOffset,
    duration: item.duration,
    location: item.location ?? null,
    description: item.description ?? null,
    transport_mode: item.transportMode ?? null,
    activity_type: Array.isArray(item.activityType) ? item.activityType : [],
});

const arraysEqual = (left: string[], right: string[]): boolean => (
    left.length === right.length && left.every((value, index) => value === right[index])
);

const buildTripTimelineDiffSummary = (
    previousTrip: ITrip | null,
    nextTrip: ITrip
): TripTimelineDiffSummary | null => {
    if (!previousTrip) return null;
    const previousItems = Array.isArray(previousTrip.items) ? previousTrip.items : [];
    const nextItems = Array.isArray(nextTrip.items) ? nextTrip.items : [];
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    const nextById = new Map(nextItems.map((item) => [item.id, item]));

    const deletedItems: Array<Record<string, unknown>> = [];
    const addedItems: Array<Record<string, unknown>> = [];
    const transportModeChanges: Array<Record<string, unknown>> = [];
    const updatedItems: Array<Record<string, unknown>> = [];

    previousItems.forEach((beforeItem) => {
        const afterItem = nextById.get(beforeItem.id);
        if (!afterItem) {
            deletedItems.push({
                item_id: beforeItem.id,
                item_type: beforeItem.type,
                before: toTimelineDiffItemSnapshot(beforeItem),
                after: null,
            });
            return;
        }

        const beforeActivities = Array.isArray(beforeItem.activityType) ? beforeItem.activityType : [];
        const afterActivities = Array.isArray(afterItem.activityType) ? afterItem.activityType : [];
        const changedFields: string[] = [];

        if (beforeItem.title !== afterItem.title) changedFields.push('title');
        if (beforeItem.startDateOffset !== afterItem.startDateOffset) changedFields.push('start_date_offset');
        if (beforeItem.duration !== afterItem.duration) changedFields.push('duration');
        if ((beforeItem.location ?? null) !== (afterItem.location ?? null)) changedFields.push('location');
        if ((beforeItem.description ?? null) !== (afterItem.description ?? null)) changedFields.push('description');
        if (!arraysEqual(beforeActivities, afterActivities)) changedFields.push('activity_type');

        const transportChanged = (beforeItem.transportMode ?? null) !== (afterItem.transportMode ?? null);
        if (transportChanged) {
            transportModeChanges.push({
                item_id: afterItem.id,
                item_type: afterItem.type,
                title: afterItem.title || beforeItem.title || 'Untitled segment',
                before_mode: beforeItem.transportMode ?? null,
                after_mode: afterItem.transportMode ?? null,
            });
            changedFields.push('transport_mode');
        }

        if (changedFields.length > 0) {
            updatedItems.push({
                item_id: afterItem.id,
                item_type: afterItem.type,
                changed_fields: changedFields,
                before: toTimelineDiffItemSnapshot(beforeItem),
                after: toTimelineDiffItemSnapshot(afterItem),
            });
        }
    });

    nextItems.forEach((afterItem) => {
        if (previousById.has(afterItem.id)) return;
        addedItems.push({
            item_id: afterItem.id,
            item_type: afterItem.type,
            before: null,
            after: toTimelineDiffItemSnapshot(afterItem),
        });
    });

    if (
        deletedItems.length === 0
        && addedItems.length === 0
        && transportModeChanges.length === 0
        && updatedItems.length === 0
    ) {
        return null;
    }

    return {
        counts: {
            deleted_items: deletedItems.length,
            added_items: addedItems.length,
            transport_mode_changes: transportModeChanges.length,
            updated_items: updatedItems.length,
        },
        deleted_items: deletedItems.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        added_items: addedItems.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        transport_mode_changes: transportModeChanges.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        updated_items: updatedItems.slice(0, MAX_TIMELINE_DIFF_ITEMS),
        truncated: (
            deletedItems.length > MAX_TIMELINE_DIFF_ITEMS
            || addedItems.length > MAX_TIMELINE_DIFF_ITEMS
            || transportModeChanges.length > MAX_TIMELINE_DIFF_ITEMS
            || updatedItems.length > MAX_TIMELINE_DIFF_ITEMS
        ),
    };
};

const VISUAL_FIELD_KEY_MAP: Record<string, string> = {
    'map view': 'map_view',
    'route view': 'route_view',
    'city names': 'city_names',
    'map layout': 'map_layout',
    'timeline layout': 'timeline_layout',
    zoom: 'zoom_level',
    'zoom level': 'zoom_level',
};

const normalizeVisualFieldKey = (value: string): string => {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return 'change';
    if (VISUAL_FIELD_KEY_MAP[normalized]) return VISUAL_FIELD_KEY_MAP[normalized];
    return normalized
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        || 'change';
};

const normalizeVisualValue = (value: string): string | null => {
    const normalized = value.trim();
    if (!normalized || normalized === '—') return null;
    return normalized;
};

const parseVisualChangesFromLabel = (label: string | null | undefined): TripTimelineVisualChange[] => {
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    if (!normalizedLabel || !VISUAL_LABEL_PREFIX.test(normalizedLabel)) return [];

    const body = normalizedLabel.replace(VISUAL_LABEL_PREFIX, '').trim();
    if (!body) return [];

    return body
        .split('·')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => {
            const directionalMatch = segment.match(/^([^:]+):\s*(.*?)\s*→\s*(.*)$/);
            if (directionalMatch) {
                const labelName = directionalMatch[1].trim() || 'Visual change';
                const beforeValue = normalizeVisualValue(directionalMatch[2] ?? '');
                const afterValue = normalizeVisualValue(directionalMatch[3] ?? '');
                return {
                    field: normalizeVisualFieldKey(labelName),
                    label: labelName,
                    before_value: beforeValue,
                    after_value: afterValue,
                    summary: segment,
                };
            }

            const colonMatch = segment.match(/^([^:]+):\s*(.*)$/);
            if (colonMatch) {
                const labelName = colonMatch[1].trim() || 'Visual change';
                const afterValue = normalizeVisualValue(colonMatch[2] ?? '');
                return {
                    field: normalizeVisualFieldKey(labelName),
                    label: labelName,
                    before_value: null,
                    after_value: afterValue ?? segment,
                    summary: segment,
                };
            }

            const lowerSegment = segment.toLowerCase();
            const isZoom = lowerSegment === 'zoomed in' || lowerSegment === 'zoomed out';
            return {
                field: isZoom ? 'zoom_level' : normalizeVisualFieldKey(segment),
                label: isZoom ? 'Zoom level' : 'Visual change',
                before_value: null,
                after_value: segment,
                summary: segment,
            };
        });
};

const buildTripTimelineDiffV1 = (
    timelineDiff: TripTimelineDiffSummary | null,
    visualChanges: TripTimelineVisualChange[]
): Record<string, unknown> | null => {
    if (!timelineDiff && visualChanges.length === 0) return null;

    return {
        schema: 'timeline_diff_v1',
        version: 1,
        counts: {
            deleted_items: timelineDiff?.counts.deleted_items ?? 0,
            added_items: timelineDiff?.counts.added_items ?? 0,
            transport_mode_changes: timelineDiff?.counts.transport_mode_changes ?? 0,
            updated_items: timelineDiff?.counts.updated_items ?? 0,
            visual_changes: visualChanges.length,
        },
        deleted_items: timelineDiff?.deleted_items ?? [],
        added_items: timelineDiff?.added_items ?? [],
        transport_mode_changes: timelineDiff?.transport_mode_changes ?? [],
        updated_items: timelineDiff?.updated_items ?? [],
        visual_changes: visualChanges,
        truncated: timelineDiff?.truncated ?? false,
    };
};

const readLatestTripVersionSnapshot = async (
    client: ReturnType<typeof requireSupabase>,
    tripId: string
): Promise<TripVersionSnapshot | null> => {
    const { data, error } = await client
        .from('trip_versions')
        .select('id, data, label')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    const rawTrip = data.data as ITrip | null;
    const trip = rawTrip && rawTrip.id !== tripId ? { ...rawTrip, id: tripId } : rawTrip;
    return {
        versionId: typeof data.id === 'string' ? data.id : null,
        label: typeof data.label === 'string' ? data.label : null,
        trip,
    };
};

const hasRecentTripEvent = async (
    client: ReturnType<typeof requireSupabase>,
    tripId: string,
    action: string,
    withinMs = 15000
): Promise<boolean> => {
    const cutoffIso = new Date(Date.now() - withinMs).toISOString();
    const { data, error } = await client
        .from('trip_user_events')
        .select('id')
        .eq('trip_id', tripId)
        .eq('action', action)
        .gte('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
};

const writeTripEventFallback = async (
    client: ReturnType<typeof requireSupabase>,
    payload: {
        ownerId: string;
        tripId: string;
        action: 'trip.created' | 'trip.updated' | 'trip.archived' | 'trip.share_created';
        source: string;
        metadata: Record<string, unknown>;
        correlationId?: string;
        dedupeWindowMs?: number;
    }
): Promise<void> => {
    try {
        const dedupeWindowMs = typeof payload.dedupeWindowMs === 'number'
            ? payload.dedupeWindowMs
            : 15000;
        if (dedupeWindowMs > 0) {
            const alreadyLogged = await hasRecentTripEvent(client, payload.tripId, payload.action, dedupeWindowMs);
            if (alreadyLogged) return;
        }

        const existingCorrelationId = typeof payload.metadata.correlation_id === 'string'
            ? payload.metadata.correlation_id.trim()
            : '';
        const metadataWithCorrelation: Record<string, unknown> = {
            ...payload.metadata,
            correlation_id: existingCorrelationId || payload.correlationId || createEventCorrelationId(),
        };

        await client.from('trip_user_events').insert({
            trip_id: payload.tripId,
            owner_id: payload.ownerId,
            action: payload.action,
            source: payload.source,
            metadata: metadataWithCorrelation,
        });
    } catch {
        // best effort fallback logging only
    }
};

const writeTripLifecycleEventFallback = async (
    client: ReturnType<typeof requireSupabase>,
    payload: {
        ownerId: string;
        tripId: string;
        source: string;
        before: TripEventSnapshot | null;
        after: TripEventSnapshot;
        correlationId?: string;
    }
): Promise<void> => {
    const { before, after } = payload;
    if (!before) {
        await writeTripEventFallback(client, {
            ownerId: payload.ownerId,
            tripId: payload.tripId,
            action: 'trip.created',
            source: payload.source,
            correlationId: payload.correlationId,
            metadata: {
                trip_id: payload.tripId,
                status_after: after.status,
                title_after: after.title,
                show_on_public_profile_after: after.showOnPublicProfile,
                trip_expires_at_after: after.tripExpiresAt,
                source_kind_after: after.sourceKind,
            },
        });
        return;
    }

    const hasDiff = (
        before.status !== after.status
        || before.title !== after.title
        || before.showOnPublicProfile !== after.showOnPublicProfile
        || before.tripExpiresAt !== after.tripExpiresAt
        || before.sourceKind !== after.sourceKind
    );
    if (!hasDiff) return;

    const secondaryActionCodes = buildTripSecondaryActionCodes(null, {
        visibilityChanged: before.showOnPublicProfile !== after.showOnPublicProfile,
    });

    await writeTripEventFallback(client, {
        ownerId: payload.ownerId,
        tripId: payload.tripId,
        action: 'trip.updated',
        source: payload.source,
        correlationId: payload.correlationId,
        metadata: {
            trip_id: payload.tripId,
            status_before: before.status,
            status_after: after.status,
            title_before: before.title,
            title_after: after.title,
            show_on_public_profile_before: before.showOnPublicProfile,
            show_on_public_profile_after: after.showOnPublicProfile,
            trip_expires_at_before: before.tripExpiresAt,
            trip_expires_at_after: after.tripExpiresAt,
            source_kind_before: before.sourceKind,
            source_kind_after: after.sourceKind,
            secondary_action_codes: secondaryActionCodes,
        },
    });
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
        show_on_public_profile?: unknown;
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
        showOnPublicProfile: row.show_on_public_profile === false ? false : trip.showOnPublicProfile !== false,
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
    return (row?.trip_id ?? row?.id) ?? null;
};

export const dbGetTrip = async (tripId: string): Promise<DbTripResult | null> => {
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
    if (ownerId) {
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
    for (const trip of trips) {
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

const normalizeClaimStatus = (value: unknown): DbAnonymousAssetClaimResult['status'] => {
    if (value === 'claimed' || value === 'expired' || value === 'failed' || value === 'revoked') return value;
    return 'pending';
};

export const dbCreateAnonymousAssetClaim = async (
    expiresMinutes = 60
): Promise<DbAnonymousAssetClaimResult | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    await ensureDbSession();
    const { data, error } = await client.rpc('create_anonymous_asset_claim', {
        p_expires_minutes: Math.max(5, Math.floor(expiresMinutes)),
    });

    if (error) {
        console.error('Failed to create anonymous asset claim', error);
        return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const claimId = typeof row?.claim_id === 'string' ? row.claim_id : null;
    const expiresAtIso = typeof row?.expires_at === 'string' ? row.expires_at : null;
    if (!claimId || !expiresAtIso) return null;

    return {
        claimId,
        status: normalizeClaimStatus(row?.status),
        expiresAtIso,
    };
};

const asFiniteCount = (value: unknown): number => (
    typeof value === 'number' && Number.isFinite(value)
        ? value
        : (typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : 0)
);

export const dbClaimAnonymousAssets = async (
    claimId: string
): Promise<DbClaimAnonymousAssetsResult | null> => {
    if (!DB_ENABLED) return null;
    if (!isUuid(claimId)) return null;
    const client = requireSupabase();
    await ensureDbSession();
    const { data, error } = await client.rpc('claim_anonymous_assets', {
        p_claim_id: claimId,
    });

    if (error) {
        throw new Error(error.message || 'Could not claim anonymous assets.');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.claim_id !== 'string') return null;

    return {
        claimId: row.claim_id,
        status: typeof row.status === 'string' ? row.status : 'claimed',
        targetUserId: typeof row.target_user_id === 'string' ? row.target_user_id : null,
        anonUserId: typeof row.anon_user_id === 'string' ? row.anon_user_id : null,
        transferredTrips: asFiniteCount(row.transferred_trips),
        transferredTripEvents: asFiniteCount(row.transferred_trip_events),
        transferredProfileEvents: asFiniteCount(row.transferred_profile_events),
        transferredTripVersions: asFiniteCount(row.transferred_trip_versions),
        transferredTripShares: asFiniteCount(row.transferred_trip_shares),
        transferredCollaborators: asFiniteCount(row.transferred_collaborators),
        deduplicatedCollaborators: asFiniteCount(row.deduplicated_collaborators),
    };
};

export const dbExpireStaleAnonymousAssetClaims = async (): Promise<number> => {
    if (!DB_ENABLED) return 0;
    const client = requireSupabase();
    const { data, error } = await client.rpc('expire_stale_anonymous_asset_claims');
    if (error) {
        console.error('Failed to expire stale anonymous asset claims', error);
        return 0;
    }
    if (typeof data === 'number' && Number.isFinite(data)) return data;
    const row = Array.isArray(data) ? data[0] : data;
    if (typeof row === 'number' && Number.isFinite(row)) return row;
    if (row && typeof row.expire_stale_anonymous_asset_claims === 'number') {
        return row.expire_stale_anonymous_asset_claims;
    }
    return 0;
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
        metadataWithCorrelation.correlation_id = existingCorrelationId || payload.correlationId || createEventCorrelationId();

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

export const dbGetUserSettings = async (): Promise<IUserSettings | null> => {
    if (!DB_ENABLED) return null;
    const client = requireSupabase();
    const userId = await getAuthenticatedNonAnonymousUserId();
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
    const userId = await getAuthenticatedNonAnonymousUserId();
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
        if (isMissingUserSettingsOwnerError(error)) {
            const { data: sessionData } = await client.auth.getSession();
            const sessionUserId = sessionData?.session?.user?.id ?? null;
            const sessionIsAnonymous = isAnonymousAuthSession(sessionData?.session ?? null);
            debugLog('dbUpsertUserSettings:staleSessionRecover', {
                code: error.code,
                message: error.message,
                details: error.details,
                sessionUserId,
                sessionIsAnonymous,
            });
            // Avoid switching identity here. Missing owner references can happen
            // for stale/deleted accounts; auto-fallback to anonymous creates
            // confusing "unknown user" session flips while login is in flight.
            if (!sessionIsAnonymous) {
                console.error(
                    'Failed to save user settings: authenticated account has no matching user owner row.',
                    error
                );
            }
            return;
        }
        console.error('Failed to save user settings', error);
    }
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

export const applyUserSettingsToLocalStorage = (settings: IUserSettings | null) => {
    if (!settings || typeof window === 'undefined') return;
    if (settings.mapStyle) writeLocalStorageItem('tf_map_style', settings.mapStyle);
    if (settings.routeMode) writeLocalStorageItem('tf_route_mode', settings.routeMode);
    if (settings.layoutMode) writeLocalStorageItem('tf_layout_mode', settings.layoutMode);
    if (settings.timelineView) writeLocalStorageItem('tf_timeline_view', settings.timelineView);
    if (typeof settings.showCityNames === 'boolean') writeLocalStorageItem('tf_city_names', String(settings.showCityNames));
    if (typeof settings.zoomLevel === 'number') writeLocalStorageItem('tf_zoom_level', settings.zoomLevel.toFixed(2));
    if (typeof settings.sidebarWidth === 'number') writeLocalStorageItem('tf_sidebar_width', String(settings.sidebarWidth));
    if (typeof settings.timelineHeight === 'number') writeLocalStorageItem('tf_timeline_height', String(settings.timelineHeight));
};
