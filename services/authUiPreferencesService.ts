import {
    readLocalStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';

export type OAuthProviderPreference = 'google' | 'apple' | 'facebook' | 'kakao';

interface StoredOAuthPreference {
    provider: OAuthProviderPreference;
    updatedAt: number;
}

const LAST_OAUTH_PROVIDER_STORAGE_KEY = 'tf_auth_last_oauth_provider_v1';
const PENDING_OAUTH_PROVIDER_STORAGE_KEY = 'tf_auth_pending_oauth_provider_v1';
const MAX_PENDING_OAUTH_AGE_MS = 1000 * 60 * 15;

const isValidProvider = (value: unknown): value is OAuthProviderPreference => {
    return value === 'google' || value === 'apple' || value === 'facebook' || value === 'kakao';
};

export const getLastUsedOAuthProvider = (): OAuthProviderPreference | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = readLocalStorageItem(LAST_OAUTH_PROVIDER_STORAGE_KEY);
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
    writeLocalStorageItem(LAST_OAUTH_PROVIDER_STORAGE_KEY, JSON.stringify(payload));
};

export const setPendingOAuthProvider = (provider: OAuthProviderPreference): void => {
    if (typeof window === 'undefined') return;
    const payload: StoredOAuthPreference = {
        provider,
        updatedAt: Date.now(),
    };
    writeLocalStorageItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY, JSON.stringify(payload));
};

export const clearPendingOAuthProvider = (): void => {
    if (typeof window === 'undefined') return;
    removeLocalStorageItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY);
};

export const consumePendingOAuthProvider = (): OAuthProviderPreference | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = readLocalStorageItem(PENDING_OAUTH_PROVIDER_STORAGE_KEY);
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
