import type { ITrip } from '../types';
import { normalizeProfileCountryCode } from '../services/profileCountryService';

/**
 * The public profile contract shared by the server loader, the route head and
 * the page. Everything here is safe to put in a CDN-cached document: it is the
 * data a signed-out visitor could already read through the public Supabase
 * policies, and nothing else (no email, settings, gender, language, account
 * status or timestamps).
 */

export const PUBLIC_PROFILE_TRIPS_PAGE_SIZE = 9;

const PUBLIC_PROFILE_HANDLE_PATTERN = /^[a-z0-9_-]{3,40}$/;
const USERNAME_DISPLAY_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;
const MAX_TEXT_LENGTH = 600;

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

const toText = (value: unknown): string => (
    typeof value === 'string' ? value.trim().slice(0, MAX_TEXT_LENGTH) : ''
);

const toHandle = (value: unknown): string => (
    typeof value === 'string' ? value.trim().toLowerCase().replace(/^@+/, '') : ''
);

const toHandleDisplay = (value: unknown, fallback: string): string => {
    const display = typeof value === 'string' ? value.trim().replace(/^@+/, '') : '';
    return USERNAME_DISPLAY_PATTERN.test(display) ? display : fallback;
};

type ProfileRowLike = Record<string, unknown>;

/** Accepts a database row (snake_case) or an already mapped profile record (camelCase). */
export const toPublicProfileView = (row: ProfileRowLike): PublicProfileView => {
    const username = toHandle(row.username);
    return {
        id: toText(row.id),
        username,
        usernameDisplay: toHandleDisplay(row.username_display ?? row.usernameDisplay, username),
        displayName: toText(row.display_name ?? row.displayName) || null,
        firstName: toText(row.first_name ?? row.firstName),
        lastName: toText(row.last_name ?? row.lastName),
        bio: toText(row.bio),
        country: normalizeProfileCountryCode(row.country),
        city: toText(row.city),
    };
};

/** Empty `displayName` means the page shows its translated fallback. */
export const toPrivateProfilePreview = (row: ProfileRowLike): PrivateProfilePreview => {
    const username = toHandle(row.username);
    const firstName = toText(row.first_name ?? row.firstName);
    const lastInitial = toText(row.last_name ?? row.lastName).charAt(0);
    const displayName = firstName
        ? `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`
        : (toText(row.display_name ?? row.displayName) || username);
    return {
        username,
        usernameDisplay: toHandleDisplay(row.username_display ?? row.usernameDisplay, username),
        displayName,
        firstName,
        lastInitial,
    };
};

export const resolvePublicProfileDisplayName = (profile: PublicProfileView, fallback: string): string => (
    profile.displayName
    || [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || profile.usernameDisplay
    || profile.username
    || fallback
);

/** Maps a `trips` row to the trip shape the profile cards render. */
export const mapProfileTripRow = (row: Record<string, unknown>): ITrip | null => {
    const rawTrip = row.data as ITrip | undefined;
    if (!rawTrip || typeof rawTrip !== 'object') return null;
    if (typeof rawTrip.id !== 'string') return null;

    const tripExpiresAt = typeof row.trip_expires_at === 'string'
        ? row.trip_expires_at
        : (typeof rawTrip.tripExpiresAt === 'string' ? rawTrip.tripExpiresAt : null);

    return {
        ...rawTrip,
        id: typeof row.id === 'string' ? row.id : rawTrip.id,
        showOnPublicProfile: row.show_on_public_profile !== false && rawTrip.showOnPublicProfile !== false,
        status: row.status === 'archived' || row.status === 'expired'
            ? row.status
            : (rawTrip.status || 'active'),
        tripExpiresAt,
        sourceKind: typeof row.source_kind === 'string' ? row.source_kind as ITrip['sourceKind'] : rawTrip.sourceKind,
        sourceTemplateId: typeof row.source_template_id === 'string'
            ? row.source_template_id
            : (rawTrip.sourceTemplateId ?? null),
    };
};

/** Only trips the owner shows on the public profile, never archived ones. */
export const isPubliclyVisibleTrip = (trip: ITrip | null): trip is ITrip => Boolean(
    trip
    && trip.status !== 'archived'
    && trip.showOnPublicProfile !== false
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
