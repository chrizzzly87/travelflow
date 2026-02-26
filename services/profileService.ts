import type { AppLanguage, ITrip } from '../types';
import { normalizeLocale } from '../config/locales';
import { dbUpsertUserSettings } from './dbService';
import { normalizeProfileCountryCode } from './profileCountryService';
import { normalizePassportStickerSelection } from './passportService';
import { supabase } from './supabaseClient';

export type ProfileGender = '' | 'female' | 'male' | 'non-binary' | 'prefer-not';
export type ProfileAccountStatus = 'active' | 'disabled' | 'deleted';
export interface PassportStickerPosition {
    x: number;
    y: number;
}

export interface UserProfileRecord {
    id: string;
    email: string | null;
    displayName: string | null;
    firstName: string;
    lastName: string;
    username: string;
    bio: string;
    gender: ProfileGender;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
    onboardingCompletedAt: string | null;
    accountStatus: ProfileAccountStatus;
    publicProfileEnabled: boolean;
    defaultPublicTripVisibility: boolean;
    usernameChangedAt: string | null;
    passportStickerPositions: Record<string, PassportStickerPosition>;
    passportStickerSelection: string[];
}

export interface UpdateUserProfilePayload {
    firstName: string;
    lastName: string;
    username: string;
    bio?: string;
    gender: ProfileGender;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
    publicProfileEnabled?: boolean;
    defaultPublicTripVisibility?: boolean;
    markOnboardingComplete?: boolean;
}

export interface UsernameAvailabilityResult {
    normalizedUsername: string;
    availability: 'available' | 'taken' | 'reserved' | 'invalid' | 'unchanged' | 'cooldown';
    reason: string | null;
    cooldownEndsAt: string | null;
}

export interface PublicProfileResolveResult {
    status: 'found' | 'redirect' | 'not_found' | 'private';
    profile: UserProfileRecord | null;
    canonicalUsername: string | null;
    redirectFromUsername: string | null;
}

export interface PublicTripsPageResult {
    trips: ITrip[];
    hasMore: boolean;
    nextOffset: number;
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
const USERNAME_RESERVED = new Set([
    'admin',
    'support',
    'settings',
    'profile',
    'profiles',
    'login',
    'logout',
    'signup',
    'api',
    'trip',
    'trips',
    'create',
    'privacy',
    'terms',
    'cookies',
    'imprint',
    'u',
]);
const USERNAME_COOLDOWN_DAYS = 90;
const DEFAULT_PUBLIC_TRIPS_PAGE_LIMIT = 12;
const PROFILE_SELECT_FULL = 'id, email, display_name, first_name, last_name, username, bio, gender, country, city, preferred_language, onboarding_completed_at, account_status, public_profile_enabled, default_public_trip_visibility, username_changed_at, passport_sticker_positions, passport_sticker_selection';
const PROFILE_SELECT_LEGACY = 'id, email, display_name, first_name, last_name, username, bio, gender, country, city, preferred_language, onboarding_completed_at, account_status, username_changed_at';

const normalizeLanguage = (value: unknown): AppLanguage => {
    return normalizeLocale(typeof value === 'string' ? value : null);
};

const normalizeGender = (value: unknown): ProfileGender => {
    if (
        value === 'female'
        || value === 'male'
        || value === 'non-binary'
        || value === 'prefer-not'
    ) {
        return value;
    }
    return '';
};

const toSafeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const toBooleanWithDefault = (value: unknown, fallback: boolean): boolean => (
    typeof value === 'boolean' ? value : fallback
);

const normalizeUsername = (value: unknown): string => (
    typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const isProfileColumnMissing = (message: string): boolean =>
    /column/i.test(message) && /(first_name|last_name|username|bio|gender|country|city|preferred_language|onboarding_completed_at|account_status|public_profile_enabled|default_public_trip_visibility|username_changed_at|passport_sticker_positions|passport_sticker_selection)/i.test(message);

const toPassportStickerPosition = (value: unknown): PassportStickerPosition | null => {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as { x?: unknown; y?: unknown };
    const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? candidate.x : null;
    const y = typeof candidate.y === 'number' && Number.isFinite(candidate.y) ? candidate.y : null;
    if (x === null || y === null) return null;
    return {
        x: Math.round(x),
        y: Math.round(y),
    };
};

const normalizePassportStickerPositions = (value: unknown): Record<string, PassportStickerPosition> => {
    if (!value || typeof value !== 'object') return {};
    const entries = Object.entries(value as Record<string, unknown>);
    const normalizedEntries = entries
        .map(([stampId, rawPosition]) => {
            const normalizedStampId = typeof stampId === 'string' ? stampId.trim() : '';
            if (!normalizedStampId) return null;
            const position = toPassportStickerPosition(rawPosition);
            if (!position) return null;
            return [normalizedStampId, position] as const;
        })
        .filter((entry): entry is readonly [string, PassportStickerPosition] => Array.isArray(entry));
    return Object.fromEntries(normalizedEntries);
};

const mapProfileRow = (
    row: Record<string, unknown> | null,
    emailFallback: string | null
): UserProfileRecord => ({
    id: toSafeText(row?.id) || '',
    email: toSafeText(row?.email) || emailFallback,
    displayName: toSafeText(row?.display_name) || null,
    firstName: toSafeText(row?.first_name),
    lastName: toSafeText(row?.last_name),
    username: normalizeUsername(row?.username),
    bio: toSafeText(row?.bio),
    gender: normalizeGender(row?.gender),
    country: normalizeProfileCountryCode(row?.country),
    city: toSafeText(row?.city),
    preferredLanguage: normalizeLanguage(row?.preferred_language),
    onboardingCompletedAt: typeof row?.onboarding_completed_at === 'string' ? row.onboarding_completed_at : null,
    accountStatus: row?.account_status === 'disabled' || row?.account_status === 'deleted' ? row.account_status : 'active',
    publicProfileEnabled: toBooleanWithDefault(row?.public_profile_enabled, true),
    defaultPublicTripVisibility: toBooleanWithDefault(row?.default_public_trip_visibility, true),
    usernameChangedAt: typeof row?.username_changed_at === 'string' ? row.username_changed_at : null,
    passportStickerPositions: normalizePassportStickerPositions(row?.passport_sticker_positions),
    passportStickerSelection: normalizePassportStickerSelection(row?.passport_sticker_selection),
});

const mapTripRow = (row: Record<string, unknown>): ITrip | null => {
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

const parseRpcSingle = <T = Record<string, unknown>>(data: unknown): T | null => {
    if (Array.isArray(data)) {
        if (data.length === 0) return null;
        const first = data[0];
        return (first && typeof first === 'object') ? first as T : null;
    }
    if (data && typeof data === 'object') return data as T;
    return null;
};

const computeCooldownEnd = (changedAtIso: string | null): string | null => {
    if (!changedAtIso) return null;
    const changedAtMs = Date.parse(changedAtIso);
    if (!Number.isFinite(changedAtMs)) return null;
    return new Date(changedAtMs + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
};

const isOnCooldown = (changedAtIso: string | null): { active: boolean; endsAt: string | null } => {
    const endsAt = computeCooldownEnd(changedAtIso);
    if (!endsAt) return { active: false, endsAt: null };
    const endsMs = Date.parse(endsAt);
    if (!Number.isFinite(endsMs)) return { active: false, endsAt: null };
    return {
        active: Date.now() < endsMs,
        endsAt,
    };
};

const validateUsername = (candidate: string): UsernameAvailabilityResult | null => {
    if (!candidate) {
        return {
            normalizedUsername: '',
            availability: 'invalid',
            reason: 'empty',
            cooldownEndsAt: null,
        };
    }

    if (!USERNAME_PATTERN.test(candidate)) {
        return {
            normalizedUsername: candidate,
            availability: 'invalid',
            reason: 'format',
            cooldownEndsAt: null,
        };
    }

    if (USERNAME_RESERVED.has(candidate)) {
        return {
            normalizedUsername: candidate,
            availability: 'reserved',
            reason: 'reserved',
            cooldownEndsAt: null,
        };
    }

    return null;
};

const loadProfileByQuery = async (
    queryFactory: () => any
): Promise<UserProfileRecord | null> => {
    if (!supabase) return null;

    let { data, error } = await queryFactory()
        .select(PROFILE_SELECT_FULL)
        .maybeSingle();

    if (error && isProfileColumnMissing(error.message || '')) {
        const fallback = await queryFactory()
            .select(PROFILE_SELECT_LEGACY)
            .maybeSingle();
        data = fallback.data as typeof data;
        error = fallback.error as typeof error;
    }

    if (error) {
        if (/row-level security|permission denied/i.test(error.message || '')) return null;
        throw new Error(error.message || 'Could not load profile.');
    }

    if (!data) return null;
    return mapProfileRow(data as Record<string, unknown>, null);
};

const isCurrentViewerAdmin = async (): Promise<boolean> => {
    if (!supabase) return false;
    try {
        const accessAttempt = await supabase.rpc('get_current_user_access');
        if (accessAttempt.error) return false;
        const row = parseRpcSingle<Record<string, unknown>>(accessAttempt.data);
        return row?.system_role === 'admin';
    } catch {
        return false;
    }
};

export const getCurrentUserProfile = async (): Promise<UserProfileRecord | null> => {
    if (!supabase) return null;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;
    const userId = authData.user.id;
    const emailFallback = authData.user.email ?? null;

    let { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name, username, bio, gender, country, city, preferred_language, onboarding_completed_at, account_status, public_profile_enabled, default_public_trip_visibility, username_changed_at, passport_sticker_positions, passport_sticker_selection')
        .eq('id', userId)
        .maybeSingle();

    if (error && isProfileColumnMissing(error.message || '')) {
        const fallback = await supabase
            .from('profiles')
            .select('id, display_name, first_name, last_name, username, gender, country, city, preferred_language, onboarding_completed_at, account_status')
            .eq('id', userId)
            .maybeSingle();
        data = fallback.data as typeof data;
        error = fallback.error as typeof error;
    }

    if (error) {
        throw new Error(error.message || 'Could not load profile.');
    }
    if (!data) return null;
    return mapProfileRow(data as Record<string, unknown>, emailFallback);
};

export const isProfileOnboardingComplete = (profile: UserProfileRecord | null): boolean => {
    if (!profile) return true;
    return Boolean(
        profile.firstName
        && profile.lastName
        && profile.country
        && profile.city
        && profile.preferredLanguage
        && profile.onboardingCompletedAt
    );
};

export const updateCurrentUserProfile = async (
    payload: UpdateUserProfilePayload
): Promise<UserProfileRecord> => {
    if (!supabase) {
        throw new Error('Supabase is not configured.');
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
        throw new Error('Not authenticated.');
    }

    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const username = normalizeUsername(payload.username);
    const bio = toSafeText(payload.bio);
    const rawCountry = typeof payload.country === 'string' ? payload.country.trim() : '';
    const country = normalizeProfileCountryCode(rawCountry);
    if (rawCountry && !country) {
        throw new Error('Country/Region must be a valid ISO 3166-1 alpha-2 country code.');
    }
    const city = payload.city.trim();
    const preferredLanguage = normalizeLanguage(payload.preferredLanguage);

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || authData.user.email || 'Traveler';
    const patch = {
        first_name: firstName || null,
        last_name: lastName || null,
        username: username || null,
        bio: bio || null,
        gender: payload.gender || null,
        country: country || null,
        city: city || null,
        preferred_language: preferredLanguage,
        public_profile_enabled: typeof payload.publicProfileEnabled === 'boolean' ? payload.publicProfileEnabled : undefined,
        default_public_trip_visibility: typeof payload.defaultPublicTripVisibility === 'boolean' ? payload.defaultPublicTripVisibility : undefined,
        display_name: displayName,
        onboarding_completed_at: payload.markOnboardingComplete ? new Date().toISOString() : undefined,
    };

    const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', authData.user.id);
    if (error) {
        throw new Error(error.message || 'Could not update profile.');
    }

    await dbUpsertUserSettings({ language: preferredLanguage });

    const nextProfile = await getCurrentUserProfile();
    if (!nextProfile) {
        throw new Error('Profile updated but could not be reloaded.');
    }
    return nextProfile;
};

export const updateCurrentUserPassportStickerPositions = async (
    positions: Record<string, PassportStickerPosition>
): Promise<void> => {
    if (!supabase) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;

    const normalizedPositions = normalizePassportStickerPositions(positions);
    const { error } = await supabase
        .from('profiles')
        .update({
            passport_sticker_positions: normalizedPositions,
        })
        .eq('id', authData.user.id);

    if (error) {
        const message = error.message || '';
        if (/column/i.test(message) && /passport_sticker_positions/i.test(message)) {
            return;
        }
        throw new Error(error.message || 'Could not update passport sticker positions.');
    }
};

export const updateCurrentUserPassportStickerSelection = async (
    selection: string[]
): Promise<void> => {
    if (!supabase) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return;

    const normalizedSelection = normalizePassportStickerSelection(selection);
    const { error } = await supabase
        .from('profiles')
        .update({
            passport_sticker_selection: normalizedSelection,
        })
        .eq('id', authData.user.id);

    if (error) {
        const message = error.message || '';
        if (/column/i.test(message) && /passport_sticker_selection/i.test(message)) {
            return;
        }
        throw new Error(error.message || 'Could not update passport sticker selection.');
    }
};

export const checkUsernameAvailability = async (candidateRaw: string): Promise<UsernameAvailabilityResult> => {
    const normalizedUsername = normalizeUsername(candidateRaw);
    const validationFailure = validateUsername(normalizedUsername);
    if (validationFailure) return validationFailure;

    if (!supabase) {
        return {
            normalizedUsername,
            availability: 'available',
            reason: null,
            cooldownEndsAt: null,
        };
    }

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id || null;
    const currentProfile = currentUserId ? await getCurrentUserProfile() : null;

    if (currentProfile?.username && normalizeUsername(currentProfile.username) === normalizedUsername) {
        return {
            normalizedUsername,
            availability: 'unchanged',
            reason: null,
            cooldownEndsAt: null,
        };
    }

    const cooldown = isOnCooldown(currentProfile?.usernameChangedAt || null);
    if (currentUserId && cooldown.active) {
        return {
            normalizedUsername,
            availability: 'cooldown',
            reason: 'cooldown',
            cooldownEndsAt: cooldown.endsAt,
        };
    }

    const rpcAttempt = await supabase.rpc('profile_check_username_availability', {
        p_username: normalizedUsername,
    });

    if (!rpcAttempt.error) {
        const row = parseRpcSingle<Record<string, unknown>>(rpcAttempt.data);
        if (row) {
            const state = typeof row.availability === 'string' ? row.availability : '';
            const allowedStates: Array<UsernameAvailabilityResult['availability']> = [
                'available',
                'taken',
                'reserved',
                'invalid',
                'unchanged',
                'cooldown',
            ];
            const availability = allowedStates.includes(state as UsernameAvailabilityResult['availability'])
                ? state as UsernameAvailabilityResult['availability']
                : 'available';
            return {
                normalizedUsername,
                availability,
                reason: typeof row.reason === 'string' ? row.reason : null,
                cooldownEndsAt: typeof row.cooldown_ends_at === 'string' ? row.cooldown_ends_at : null,
            };
        }
    }

    const { data: takenRow, error: takenError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', normalizedUsername)
        .maybeSingle();

    if (takenError && !/row-level security|permission denied/i.test(takenError.message || '')) {
        throw new Error(takenError.message || 'Could not validate username availability.');
    }

    if (takenRow && typeof takenRow.id === 'string' && takenRow.id !== currentUserId) {
        return {
            normalizedUsername,
            availability: 'taken',
            reason: null,
            cooldownEndsAt: null,
        };
    }

    return {
        normalizedUsername,
        availability: 'available',
        reason: null,
        cooldownEndsAt: null,
    };
};

const findProfileByUsername = async (username: string): Promise<UserProfileRecord | null> => {
    if (!supabase) return null;
    return loadProfileByQuery(() => (
        supabase
            .from('profiles')
            .ilike('username', username)
    ));
};

const findProfileByUserId = async (userId: string): Promise<UserProfileRecord | null> => {
    if (!supabase) return null;
    return loadProfileByQuery(() => (
        supabase
            .from('profiles')
            .eq('id', userId)
    ));
};

export const resolvePublicProfileByHandle = async (handleRaw: string): Promise<PublicProfileResolveResult> => {
    const normalized = normalizeUsername(handleRaw);
    const validationFailure = validateUsername(normalized);
    if (validationFailure) {
        return {
            status: 'not_found',
            profile: null,
            canonicalUsername: null,
            redirectFromUsername: null,
        };
    }

    if (!supabase) {
        return {
            status: 'not_found',
            profile: null,
            canonicalUsername: null,
            redirectFromUsername: null,
        };
    }

    const viewerIsAdmin = await isCurrentViewerAdmin();
    const canViewerAccessProfile = (profile: UserProfileRecord | null): profile is UserProfileRecord =>
        Boolean(profile && (profile.publicProfileEnabled || viewerIsAdmin));

    const rpcAttempt = await supabase.rpc('profile_resolve_public_handle', {
        p_handle: normalized,
    });

    if (!rpcAttempt.error) {
        const row = parseRpcSingle<Record<string, unknown>>(rpcAttempt.data);
        if (row) {
            const status = typeof row.status === 'string' ? row.status : 'not_found';
            const canonicalUsername = normalizeUsername(row.canonical_username);
            const hasSelectionField = Object.prototype.hasOwnProperty.call(row, 'passport_sticker_selection');
            const baseProfile = mapProfileRow(row, null);
            const profile = !hasSelectionField && baseProfile.username
                ? (await findProfileByUsername(baseProfile.username) || baseProfile)
                : baseProfile;

            if (status === 'found') {
                const canAccess = canViewerAccessProfile(profile);
                return {
                    status: canAccess ? 'found' : 'private',
                    profile: canAccess ? profile : null,
                    canonicalUsername: canonicalUsername || profile.username || null,
                    redirectFromUsername: null,
                };
            }

            if (status === 'redirect') {
                const canAccess = canViewerAccessProfile(profile);
                return {
                    status: canAccess ? 'redirect' : 'private',
                    profile: canAccess ? profile : null,
                    canonicalUsername: canonicalUsername || profile.username || null,
                    redirectFromUsername: normalized,
                };
            }

            if (status === 'private') {
                if (viewerIsAdmin) {
                    const usernameToLoad = canonicalUsername || profile.username || normalized;
                    const adminProfile = await findProfileByUsername(usernameToLoad);
                    if (adminProfile) {
                        return {
                            status: 'found',
                            profile: adminProfile,
                            canonicalUsername: adminProfile.username || usernameToLoad,
                            redirectFromUsername: null,
                        };
                    }
                }
                return {
                    status: 'private',
                    profile: null,
                    canonicalUsername: canonicalUsername || null,
                    redirectFromUsername: null,
                };
            }
        }
    }

    const directProfile = await findProfileByUsername(normalized);
    if (directProfile) {
        if (!canViewerAccessProfile(directProfile)) {
            return {
                status: 'private',
                profile: null,
                canonicalUsername: directProfile.username || normalized,
                redirectFromUsername: null,
            };
        }

        return {
            status: 'found',
            profile: directProfile,
            canonicalUsername: directProfile.username || normalized,
            redirectFromUsername: null,
        };
    }

    const redirectAttempt = await supabase
        .from('profile_handle_redirects')
        .select('user_id, expires_at')
        .eq('handle', normalized)
        .maybeSingle();

    if (!redirectAttempt.error && redirectAttempt.data) {
        const expiresAt = typeof redirectAttempt.data.expires_at === 'string'
            ? Date.parse(redirectAttempt.data.expires_at)
            : Number.NaN;

        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
            const targetUserId = toSafeText(redirectAttempt.data.user_id);
            if (targetUserId) {
                const targetProfile = await findProfileByUserId(targetUserId);
                if (targetProfile) {
                    if (!canViewerAccessProfile(targetProfile)) {
                        return {
                            status: 'private',
                            profile: null,
                            canonicalUsername: targetProfile.username || null,
                            redirectFromUsername: normalized,
                        };
                    }

                    return {
                        status: 'redirect',
                        profile: targetProfile,
                        canonicalUsername: targetProfile.username || null,
                        redirectFromUsername: normalized,
                    };
                }
            }
        }
    }

    return {
        status: 'not_found',
        profile: null,
        canonicalUsername: null,
        redirectFromUsername: null,
    };
};

export const getPublicTripsPageByUserId = async (
    userId: string,
    options?: { offset?: number; limit?: number }
): Promise<PublicTripsPageResult> => {
    if (!supabase || !userId) {
        return {
            trips: [],
            hasMore: false,
            nextOffset: 0,
        };
    }

    const offset = Number.isFinite(options?.offset)
        ? Math.max(0, Math.floor(options?.offset || 0))
        : 0;
    const limit = Number.isFinite(options?.limit)
        ? Math.max(1, Math.floor(options?.limit || DEFAULT_PUBLIC_TRIPS_PAGE_LIMIT))
        : DEFAULT_PUBLIC_TRIPS_PAGE_LIMIT;

    let { data, error } = await supabase
        .from('trips')
        .select('id, data, status, trip_expires_at, source_kind, source_template_id, show_on_public_profile')
        .eq('owner_id', userId)
        .neq('status', 'archived')
        .eq('show_on_public_profile', true)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error && /column/i.test(error.message || '') && /show_on_public_profile/i.test(error.message || '')) {
        const fallback = await supabase
            .from('trips')
            .select('id, data, status, trip_expires_at, source_kind, source_template_id')
            .eq('owner_id', userId)
            .neq('status', 'archived')
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);
        data = fallback.data as typeof data;
        error = fallback.error as typeof error;
    }

    if (error) {
        if (/row-level security|permission denied/i.test(error.message || '')) {
            return {
                trips: [],
                hasMore: false,
                nextOffset: offset,
            };
        }
        throw new Error(error.message || 'Could not load public trips.');
    }

    const mappedTrips = (data || [])
        .map((row) => mapTripRow(row as Record<string, unknown>))
        .filter((trip): trip is ITrip => Boolean(
            trip
            && trip.status !== 'archived'
            && trip.showOnPublicProfile !== false
        ));
    const rawCount = Array.isArray(data) ? data.length : 0;

    return {
        trips: mappedTrips,
        hasMore: rawCount >= limit,
        nextOffset: offset + rawCount,
    };
};

export const getPublicTripsByUserId = async (userId: string): Promise<ITrip[]> => {
    if (!supabase || !userId) return [];

    const trips: ITrip[] = [];
    let offset = 0;

    while (true) {
        const page = await getPublicTripsPageByUserId(userId, {
            offset,
            limit: 48,
        });
        trips.push(...page.trips);
        if (!page.hasMore) break;
        offset = page.nextOffset;
    }

    return trips;
};
