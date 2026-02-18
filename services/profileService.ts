import type { AppLanguage } from '../types';
import { dbUpsertUserSettings } from './dbService';
import { supabase } from './supabaseClient';

export type ProfileGender = '' | 'female' | 'male' | 'non-binary' | 'prefer-not';
export type ProfileAccountStatus = 'active' | 'disabled' | 'deleted';

export interface UserProfileRecord {
    id: string;
    email: string | null;
    displayName: string | null;
    firstName: string;
    lastName: string;
    username: string;
    gender: ProfileGender;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
    onboardingCompletedAt: string | null;
    accountStatus: ProfileAccountStatus;
}

export interface UpdateUserProfilePayload {
    firstName: string;
    lastName: string;
    username: string;
    gender: ProfileGender;
    country: string;
    city: string;
    preferredLanguage: AppLanguage;
    markOnboardingComplete?: boolean;
}

const normalizeLanguage = (value: unknown): AppLanguage => {
    if (
        value === 'en' || value === 'es' || value === 'de' || value === 'fr' || value === 'pt'
        || value === 'ru' || value === 'it' || value === 'pl' || value === 'ko'
    ) {
        return value;
    }
    return 'en';
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

const isProfileColumnMissing = (message: string): boolean =>
    /column/i.test(message) && /(first_name|last_name|username|gender|country|city|preferred_language|onboarding_completed_at|account_status)/i.test(message);

const mapProfileRow = (
    row: Record<string, unknown> | null,
    emailFallback: string | null
): UserProfileRecord => ({
    id: toSafeText(row?.id) || '',
    email: toSafeText(row?.email) || emailFallback,
    displayName: toSafeText(row?.display_name) || null,
    firstName: toSafeText(row?.first_name),
    lastName: toSafeText(row?.last_name),
    username: toSafeText(row?.username),
    gender: normalizeGender(row?.gender),
    country: toSafeText(row?.country),
    city: toSafeText(row?.city),
    preferredLanguage: normalizeLanguage(row?.preferred_language),
    onboardingCompletedAt: typeof row?.onboarding_completed_at === 'string' ? row.onboarding_completed_at : null,
    accountStatus: row?.account_status === 'disabled' || row?.account_status === 'deleted' ? row.account_status : 'active',
});

export const getCurrentUserProfile = async (): Promise<UserProfileRecord | null> => {
    if (!supabase) return null;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;
    const userId = authData.user.id;
    const emailFallback = authData.user.email ?? null;

    let { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name, username, gender, country, city, preferred_language, onboarding_completed_at, account_status')
        .eq('id', userId)
        .maybeSingle();

    if (error && isProfileColumnMissing(error.message || '')) {
        const fallback = await supabase
            .from('profiles')
            .select('id, display_name')
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
    const username = payload.username.trim();
    const country = payload.country.trim();
    const city = payload.city.trim();
    const preferredLanguage = normalizeLanguage(payload.preferredLanguage);

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || authData.user.email || 'Traveler';
    const patch = {
        first_name: firstName || null,
        last_name: lastName || null,
        username: username || null,
        gender: payload.gender || null,
        country: country || null,
        city: city || null,
        preferred_language: preferredLanguage,
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
