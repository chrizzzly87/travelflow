import type { IUserSettings } from '../../types';
import { writeLocalStorageItem } from '../browserStorageService';
import {
    DB_ENABLED,
    debugLog,
    requireSupabase,
    type DbErrorLike,
} from './internal';

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
        timelineMode: data.timeline_mode ?? undefined,
        timelineView: data.timeline_view ?? undefined,
        showCityNames: data.show_city_names ?? undefined,
        zoomLevel: typeof data.zoom_level === 'number' ? data.zoom_level : undefined,
        sidebarWidth: typeof data.sidebar_width === 'number' ? data.sidebar_width : undefined,
        detailsWidth: typeof data.details_width === 'number' ? data.details_width : undefined,
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
        details_width: settings.detailsWidth,
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

export const applyUserSettingsToLocalStorage = (settings: IUserSettings | null) => {
    if (!settings || typeof window === 'undefined') return;
    if (settings.mapStyle) writeLocalStorageItem('tf_map_style', settings.mapStyle);
    if (settings.routeMode) writeLocalStorageItem('tf_route_mode', settings.routeMode);
    if (settings.layoutMode) writeLocalStorageItem('tf_layout_mode', settings.layoutMode);
    if (settings.timelineMode) writeLocalStorageItem('tf_timeline_mode', settings.timelineMode);
    if (settings.timelineView) writeLocalStorageItem('tf_timeline_view', settings.timelineView);
    if (typeof settings.showCityNames === 'boolean') writeLocalStorageItem('tf_city_names', String(settings.showCityNames));
    if (typeof settings.zoomLevel === 'number') writeLocalStorageItem('tf_zoom_level', settings.zoomLevel.toFixed(2));
    if (typeof settings.sidebarWidth === 'number') writeLocalStorageItem('tf_sidebar_width', String(settings.sidebarWidth));
    if (typeof settings.detailsWidth === 'number') writeLocalStorageItem('tf_details_width', String(settings.detailsWidth));
    if (typeof settings.timelineHeight === 'number') writeLocalStorageItem('tf_timeline_height', String(settings.timelineHeight));
};
