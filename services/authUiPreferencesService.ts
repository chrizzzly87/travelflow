export type OAuthProviderPreference = 'google' | 'apple' | 'facebook';

interface StoredOAuthPreference {
    provider: OAuthProviderPreference;
    updatedAt: number;
}

const LAST_OAUTH_PROVIDER_STORAGE_KEY = 'tf_auth_last_oauth_provider_v1';

const isValidProvider = (value: unknown): value is OAuthProviderPreference => {
    return value === 'google' || value === 'apple' || value === 'facebook';
};

export const getLastUsedOAuthProvider = (): OAuthProviderPreference | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(LAST_OAUTH_PROVIDER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredOAuthPreference>;
        if (!isValidProvider(parsed.provider)) return null;
        return parsed.provider;
    } catch {
        return null;
    }
};

export const setLastUsedOAuthProvider = (provider: OAuthProviderPreference): void => {
    if (typeof window === 'undefined') return;
    const payload: StoredOAuthPreference = {
        provider,
        updatedAt: Date.now(),
    };
    window.localStorage.setItem(LAST_OAUTH_PROVIDER_STORAGE_KEY, JSON.stringify(payload));
};

