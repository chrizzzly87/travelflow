import type { ITrip } from '../types';
import { normalizeProfileCountryCode } from '../services/profileCountryService';
import type { PrivateProfilePreview, PublicProfileView } from './publicProfile';

/**
 * Copies the public fields out of profile and trip rows. Kept apart from
 * `publicProfile.ts` because country normalization pulls in the country data,
 * which must not reach the entry bundle through the route head.
 */

const USERNAME_DISPLAY_PATTERN = /^[A-Za-z0-9_-]{3,40}$/;
const MAX_TEXT_LENGTH = 600;

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
