import {
    readLocalStorageItem,
    readSessionStorageItem,
    removeLocalStorageItem,
    removeSessionStorageItem,
    writeLocalStorageItem,
    writeSessionStorageItem,
} from './browserStorageService';

export type AuthSessionPersistence = 'persistent' | 'session';

const AUTH_SESSION_PERSISTENCE_KEY = 'tf_auth_session_persistence_v1';
const LOCALHOST_BRIDGE_COOKIE_ROOT = 'tf_localhost_supabase_auth_bridge_';
const LOCALHOST_BRIDGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const isBrowserRuntime = (): boolean =>
    typeof window !== 'undefined' && typeof document !== 'undefined';

const isLocalhostRuntime = (): boolean => {
    if (!isBrowserRuntime()) return false;
    const hostname = window.location.hostname.trim().toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
};

const normalizePersistenceMode = (value: unknown): AuthSessionPersistence => (
    value === 'session' ? 'session' : 'persistent'
);

const hashStorageKey = (keyName: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < keyName.length; index += 1) {
        hash ^= keyName.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
};

const getLocalhostBridgeCookieName = (keyName: string): string =>
    `${LOCALHOST_BRIDGE_COOKIE_ROOT}${hashStorageKey(keyName)}`;

const readCookie = (cookieName: string): string | null => {
    if (!isBrowserRuntime()) return null;
    const cookieParts = document.cookie ? document.cookie.split(';') : [];
    for (const cookiePart of cookieParts) {
        const [rawName, ...rawValueParts] = cookiePart.trim().split('=');
        if (!rawName || rawName !== cookieName) continue;
        const rawValue = rawValueParts.join('=');
        try {
            return decodeURIComponent(rawValue);
        } catch {
            return null;
        }
    }
    return null;
};

const writeCookie = (cookieName: string, value: string): void => {
    if (!isBrowserRuntime()) return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=${LOCALHOST_BRIDGE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
};

const removeCookie = (cookieName: string): void => {
    if (!isBrowserRuntime()) return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
};

const isSupabaseAuthTokenKey = (keyName: string): boolean =>
    keyName.startsWith('sb-') && keyName.includes('auth-token');

const readFromMedium = (medium: AuthSessionPersistence, keyName: string): string | null => (
    medium === 'session'
        ? readSessionStorageItem(keyName)
        : readLocalStorageItem(keyName)
);

const writeToMedium = (medium: AuthSessionPersistence, keyName: string, value: string): void => {
    if (medium === 'session') {
        writeSessionStorageItem(keyName, value);
        return;
    }
    writeLocalStorageItem(keyName, value);
};

const removeFromMedium = (medium: AuthSessionPersistence, keyName: string): void => {
    if (medium === 'session') {
        removeSessionStorageItem(keyName);
        return;
    }
    removeLocalStorageItem(keyName);
};

export const getAuthSessionPersistencePreference = (): AuthSessionPersistence => {
    if (!isBrowserRuntime()) return 'persistent';
    const raw = readLocalStorageItem(AUTH_SESSION_PERSISTENCE_KEY);
    return normalizePersistenceMode(raw);
};

export const setAuthSessionPersistencePreference = (mode: AuthSessionPersistence): void => {
    if (!isBrowserRuntime()) return;
    const normalizedMode = normalizePersistenceMode(mode);
    writeLocalStorageItem(AUTH_SESSION_PERSISTENCE_KEY, normalizedMode);
};

export const isRememberLoginEnabled = (): boolean =>
    getAuthSessionPersistencePreference() === 'persistent';

export const setRememberLoginEnabled = (rememberLogin: boolean): void => {
    setAuthSessionPersistencePreference(rememberLogin ? 'persistent' : 'session');
};

const syncLocalhostBridgeCookieFromStorage = (keyName: string, value: string): void => {
    if (!isLocalhostRuntime()) return;
    if (!isSupabaseAuthTokenKey(keyName)) return;
    writeCookie(getLocalhostBridgeCookieName(keyName), value);
};

const restorePersistentValueFromCookie = (keyName: string): string | null => {
    if (!isLocalhostRuntime()) return null;
    if (!isSupabaseAuthTokenKey(keyName)) return null;
    const cookieValue = readCookie(getLocalhostBridgeCookieName(keyName));
    if (!cookieValue) return null;
    writeToMedium('persistent', keyName, cookieValue);
    return cookieValue;
};

const clearLocalhostBridgeCookieForKey = (keyName: string): void => {
    if (!isLocalhostRuntime()) return;
    if (!isSupabaseAuthTokenKey(keyName)) return;
    removeCookie(getLocalhostBridgeCookieName(keyName));
};

export const clearLocalhostSupabaseBridgeCookies = (): void => {
    if (!isLocalhostRuntime()) return;
    const cookieParts = document.cookie ? document.cookie.split(';') : [];
    for (const cookiePart of cookieParts) {
        const [rawName] = cookiePart.trim().split('=');
        if (!rawName || !rawName.startsWith(LOCALHOST_BRIDGE_COOKIE_ROOT)) continue;
        removeCookie(rawName);
    }
};

interface SupabaseStorageAdapter {
    getItem: (keyName: string) => string | null;
    setItem: (keyName: string, value: string) => void;
    removeItem: (keyName: string) => void;
}

export const createSupabaseAuthStorageAdapter = (): SupabaseStorageAdapter => ({
    getItem: (keyName: string): string | null => {
        const persistenceMode = getAuthSessionPersistencePreference();
        const primaryValue = readFromMedium(persistenceMode, keyName);
        if (primaryValue) {
            if (persistenceMode === 'persistent') {
                syncLocalhostBridgeCookieFromStorage(keyName, primaryValue);
            }
            return primaryValue;
        }

        if (persistenceMode === 'persistent') {
            const bridgedCookieValue = restorePersistentValueFromCookie(keyName);
            if (bridgedCookieValue) return bridgedCookieValue;

            const legacySessionValue = readFromMedium('session', keyName);
            if (legacySessionValue) {
                writeToMedium('persistent', keyName, legacySessionValue);
                removeFromMedium('session', keyName);
                syncLocalhostBridgeCookieFromStorage(keyName, legacySessionValue);
                return legacySessionValue;
            }
        }

        return null;
    },
    setItem: (keyName: string, value: string): void => {
        const persistenceMode = getAuthSessionPersistencePreference();
        writeToMedium(persistenceMode, keyName, value);
        removeFromMedium(persistenceMode === 'persistent' ? 'session' : 'persistent', keyName);
        if (persistenceMode === 'persistent') {
            syncLocalhostBridgeCookieFromStorage(keyName, value);
            return;
        }
        clearLocalhostBridgeCookieForKey(keyName);
    },
    removeItem: (keyName: string): void => {
        removeFromMedium('persistent', keyName);
        removeFromMedium('session', keyName);
        clearLocalhostBridgeCookieForKey(keyName);
    },
});
