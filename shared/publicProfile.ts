import type { ITrip } from '../types';

/**
 * The public profile contract shared by the server loader, the route head and
 * the page. Everything here is safe to put in a CDN-cached document: it is the
 * data a signed-out visitor could already read through the public Supabase
 * policies, and nothing else (no email, settings, gender, language, account
 * status or timestamps).
 *
 * This module is imported by the route `head`, which ships in the entry
 * bundle, so it must stay dependency-free. Row mapping that needs country data
 * lives in `publicProfileRows.ts`.
 */

export const PUBLIC_PROFILE_TRIPS_PAGE_SIZE = 9;

const PUBLIC_PROFILE_HANDLE_PATTERN = /^[a-z0-9_-]{3,40}$/;

/** Lowercase, trimmed and `@`-free handle, or `null` when it can never match a profile. */
export const normalizePublicProfileHandle = (value: unknown): string | null => {
    if (typeof value !== 'string' || value.length > 256) return null;
    const handle = value.trim().toLowerCase().replace(/^@+/, '');
    return PUBLIC_PROFILE_HANDLE_PATTERN.test(handle) ? handle : null;
};

export interface PublicProfileView {
    id: string;
    username: string;
    usernameDisplay: string;
    displayName: string | null;
    firstName: string;
    lastName: string;
    bio: string;
    country: string;
    city: string;
}

/** What a visitor sees of a private profile: a first name, a last initial and the handle. */
export interface PrivateProfilePreview {
    username: string;
    usernameDisplay: string;
    displayName: string;
    firstName: string;
    lastInitial: string;
}

export interface PublicProfileTripsPage {
    trips: ITrip[];
    hasMore: boolean;
    nextOffset: number;
}

export type PublicProfilePageData =
    | { status: 'found'; profile: PublicProfileView; tripsPage: PublicProfileTripsPage; tripsFailed: boolean }
    | { status: 'redirect'; canonicalUsername: string }
    | { status: 'private'; preview: PrivateProfilePreview }
    | { status: 'not_found' }
    /** The profile backend failed; rendered like `not_found` but never cached. */
    | { status: 'unavailable' };

export const resolvePublicProfileDisplayName = (profile: PublicProfileView, fallback: string): string => (
    profile.displayName
    || [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || profile.usernameDisplay
    || profile.username
    || fallback
);

const PAGE_STATUSES = new Set(['found', 'redirect', 'private', 'not_found', 'unavailable']);

/** Reads the server function's JSON payload; anything malformed counts as a backend failure. */
export const parsePublicProfilePageData = (json: unknown): PublicProfilePageData => {
    try {
        const value = typeof json === 'string' ? JSON.parse(json) as { status?: unknown } : null;
        return value && typeof value.status === 'string' && PAGE_STATUSES.has(value.status)
            ? value as PublicProfilePageData
            : { status: 'unavailable' };
    } catch {
        return { status: 'unavailable' };
    }
};
