import type { ITrip, IViewSettings } from '../../types';
import { supabase, isSupabaseEnabled } from '../supabaseClient';
import { readLocalStorageItem } from '../browserStorageService';
import { isTripExpiredByTimestamp } from '../../config/productLimits';

export const DB_ENABLED = isSupabaseEnabled;

export const isDebugEnabled = () => {
    if (typeof window === 'undefined') return false;
    try {
        if (readLocalStorageItem('tf_debug_db') === '1') return true;
    } catch {
        // ignore
    }
    return import.meta.env.VITE_DEBUG_DB === 'true';
};

export const debugLog = (...args: unknown[]) => {
    if (!isDebugEnabled()) return;
    console.log('[db]', ...args);
};

export const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase client not configured');
    }
    return supabase;
};

export type SessionUserLike = {
    email?: string | null;
    phone?: string | null;
    is_anonymous?: boolean;
    app_metadata?: Record<string, unknown>;
    identities?: Array<{ provider?: string | null }>;
};

export const isAnonymousSessionUser = (user: SessionUserLike | null | undefined): boolean => {
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

export type DbErrorLike = {
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
    constraint?: string | null;
};

export const isPermissionLikeDbError = (error: DbErrorLike | null): boolean => {
    if (!error) return false;
    const code = typeof error.code === 'string' ? error.code.trim().toUpperCase() : '';
    if (code === '42501' || code === 'P0001') return true;
    const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
    return message.includes('row-level security')
        || message.includes('not allowed')
        || message.includes('permission denied');
};

export const isRlsViolation = (error: DbErrorLike | null) => {
    if (!error) return false;
    if (error.code === '42501') return true;
    return typeof error.message === 'string' && /row-level security/i.test(error.message);
};

const isLayoutModeValue = (value: unknown): value is IViewSettings['layoutMode'] =>
    value === 'vertical' || value === 'horizontal';

const isTimelineModeValue = (value: unknown): value is NonNullable<IViewSettings['timelineMode']> =>
    value === 'calendar' || value === 'timeline';

const isTimelineViewValue = (value: unknown): value is IViewSettings['timelineView'] =>
    value === 'vertical' || value === 'horizontal';

const isMapStyleValue = (value: unknown): value is IViewSettings['mapStyle'] =>
    value === 'minimal' || value === 'standard' || value === 'dark' || value === 'satellite' || value === 'clean';

const isRouteModeValue = (value: unknown): value is NonNullable<IViewSettings['routeMode']> =>
    value === 'simple' || value === 'realistic';

const isMapDockModeValue = (value: unknown): value is NonNullable<IViewSettings['mapDockMode']> =>
    value === 'docked' || value === 'floating';

const isZoomBehaviorValue = (value: unknown): value is NonNullable<IViewSettings['zoomBehavior']> =>
    value === 'fit' || value === 'manual';

const normalizeFiniteNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;


export const normalizeViewSettingsPayload = (value: unknown): IViewSettings | null => {
    if (!value || typeof value !== 'object') return null;
    const view = value as Partial<IViewSettings>;
    return {
        layoutMode: isLayoutModeValue(view.layoutMode) ? view.layoutMode : 'horizontal',
        timelineMode: isTimelineModeValue(view.timelineMode) ? view.timelineMode : 'calendar',
        timelineView: isTimelineViewValue(view.timelineView) ? view.timelineView : 'horizontal',
        mapStyle: isMapStyleValue(view.mapStyle) ? view.mapStyle : 'standard',
        zoomLevel: normalizeFiniteNumber(view.zoomLevel) ?? 1,
        zoomBehavior: isZoomBehaviorValue(view.zoomBehavior) ? view.zoomBehavior : 'fit',
        mapDockMode: isMapDockModeValue(view.mapDockMode) ? view.mapDockMode : undefined,
        routeMode: isRouteModeValue(view.routeMode) ? view.routeMode : undefined,
        showCityNames: typeof view.showCityNames === 'boolean' ? view.showCityNames : undefined,
        sidebarWidth: normalizeFiniteNumber(view.sidebarWidth),
        detailsWidth: normalizeFiniteNumber(view.detailsWidth),
        timelineHeight: normalizeFiniteNumber(view.timelineHeight),
    };
};

export const normalizeTripForStorage = (trip: ITrip): ITrip => ({
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

const resolveTripStatus = (status: unknown, tripExpiresAt: string | null): ITrip['status'] => {
    if (status === 'archived') return 'archived';
    if (status === 'expired') return 'expired';
    if (isTripExpiredByTimestamp(tripExpiresAt)) return 'expired';
    return 'active';
};

export const applyTripAccessFields = (
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
