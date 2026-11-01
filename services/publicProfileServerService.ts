import { createClient } from '@supabase/supabase-js';
import {
    isPubliclyVisibleTrip,
    mapProfileTripRow,
    PUBLIC_PROFILE_TRIPS_PAGE_SIZE,
    toPrivateProfilePreview,
    toPublicProfileView,
    type PublicProfilePageData,
    type PublicProfileTripsPage,
} from '../shared/publicProfile';

/**
 * Server-side public profile reads for the server-rendered `/u/$username`
 * document. They run as an anonymous visitor: a fresh client with no session,
 * no cookies and no request headers, so the result is the same for everyone
 * and safe to cache on the CDN. Row-level security and the security-definer
 * handle resolver decide what is public; this module then copies only the
 * public fields out of the rows.
 */

const REQUEST_TIMEOUT_MS = 5_000;

interface PublicProfileQueryResult {
    data: unknown;
    error: { message?: string } | null;
}

/** The two reads this module needs, so tests can supply a fake without Supabase. */
export interface PublicProfileReader {
    resolveHandle: (handle: string) => PromiseLike<PublicProfileQueryResult>;
    listPublicTrips: (ownerId: string, offset: number, limit: number) => PromiseLike<PublicProfileQueryResult>;
}

const readEnv = (key: string): string => {
    const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    const value = viteEnv?.[key] ?? processEnv?.[key];
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed === 'undefined' || trimmed === 'null' ? '' : trimmed;
};

const toHttpUrl = (value: string): string | null => {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
};

const withTimeout: typeof fetch = (input, init) => fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
});

/** An anonymous reader, or `null` when Supabase is not configured (the page then shows "not found", as before). */
export const createAnonymousPublicProfileReader = (): PublicProfileReader | null => {
    const url = toHttpUrl(readEnv('VITE_SUPABASE_URL'));
    const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
    if (!url || !anonKey) return null;
    const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: withTimeout },
    });
    return {
        resolveHandle: handle => client.rpc('profile_resolve_public_handle', { p_handle: handle }),
        listPublicTrips: (ownerId, offset, limit) => client
            .from('trips')
            .select('id, data, status, trip_expires_at, source_kind, source_template_id, show_on_public_profile')
            .eq('owner_id', ownerId)
            .neq('status', 'archived')
            .eq('show_on_public_profile', true)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1),
    };
};

const firstRow = (data: unknown): Record<string, unknown> | null => {
    const row = Array.isArray(data) ? data[0] : data;
    return row && typeof row === 'object' ? row as Record<string, unknown> : null;
};

const loadFirstTripsPage = async (reader: PublicProfileReader, ownerId: string): Promise<PublicProfileTripsPage | null> => {
    try {
        const { data, error } = await reader.listPublicTrips(ownerId, 0, PUBLIC_PROFILE_TRIPS_PAGE_SIZE);
        if (error) return null;
        const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
        return {
            trips: rows.map(mapProfileTripRow).filter(isPubliclyVisibleTrip),
            hasMore: rows.length >= PUBLIC_PROFILE_TRIPS_PAGE_SIZE,
            nextOffset: rows.length,
        };
    } catch {
        return null;
    }
};

/**
 * Resolves a normalized handle (see `normalizePublicProfileHandle`) to the
 * page data. `null` is an invalid handle and never reaches the database.
 */
export const loadPublicProfilePageData = async (
    handle: string | null,
    reader: PublicProfileReader | null = createAnonymousPublicProfileReader(),
): Promise<PublicProfilePageData> => {
    if (!handle || !reader) return { status: 'not_found' };

    let row: Record<string, unknown> | null;
    try {
        const result = await reader.resolveHandle(handle);
        if (result.error) return { status: 'unavailable' };
        row = firstRow(result.data);
    } catch {
        return { status: 'unavailable' };
    }

    const status = typeof row?.status === 'string' ? row.status : 'not_found';
    if (!row || !row.id || (status !== 'found' && status !== 'redirect' && status !== 'private')) {
        return { status: 'not_found' };
    }

    if (status === 'private') {
        return { status: 'private', preview: toPrivateProfilePreview(row) };
    }

    const profile = toPublicProfileView(row);
    const canonicalUsername = profile.username;
    if (status === 'redirect' || (canonicalUsername && canonicalUsername !== handle)) {
        return canonicalUsername ? { status: 'redirect', canonicalUsername } : { status: 'not_found' };
    }

    const tripsPage = await loadFirstTripsPage(reader, profile.id);
    return {
        status: 'found',
        profile,
        tripsPage: tripsPage ?? { trips: [], hasMore: false, nextOffset: 0 },
        tripsFailed: tripsPage === null,
    };
};
