export type OAuthProviderPreference = 'google' | 'apple' | 'facebook';

interface StoredOAuthPreference {
    provider: OAuthProviderPreference;
    updatedAt: number;
}

const LAST_OAUTH_PROVIDER_STORAGE_KEY = 'tf_auth_last_oauth_provider_v1';
const PENDING_OAUTH_PROVIDER_STORAGE_KEY = 'tf_auth_pending_oauth_provider_v1';
const MAX_PENDING_OAUTH_AGE_MS = 1000 * 60 * 15;

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

export const setPendingOAuthProvider = (provider: OAuthProviderPreference): void => {
    if (typeof window === 'undefined') return;
    const payload: StoredOAuthPreference = {
        provider,
        updatedAt: Date.now(),
    };
    window.localStorage.setItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY, JSON.stringify(payload));
};

export const clearPendingOAuthProvider = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY);
};

export const consumePendingOAuthProvider = (): OAuthProviderPreference | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredOAuthPreference>;
        if (!isValidProvider(parsed.provider)) {
            clearPendingOAuthProvider();
            return null;
        }
        if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) {
            clearPendingOAuthProvider();
            return null;
        }
        if ((Date.now() - parsed.updatedAt) > MAX_PENDING_OAUTH_AGE_MS) {
            clearPendingOAuthProvider();
            return null;
        }
        clearPendingOAuthProvider();
        return parsed.provider;
    } catch {
        clearPendingOAuthProvider();
        return null;
    }
};
