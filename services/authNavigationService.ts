import { stripLocalePrefix } from '../config/routes';

const AUTH_RETURN_PATH_STORAGE_KEY = 'tf_auth_return_path_v1';
const AUTH_PENDING_REDIRECT_STORAGE_KEY = 'tf_auth_pending_redirect_v1';
const AUTH_PENDING_REDIRECT_TTL_MS = 1000 * 60 * 30;

const normalizePathOnly = (path: string): string => {
    const [pathname = '/'] = path.split(/[?#]/);
    return pathname || '/';
};

export const buildPathFromLocationParts = (parts: {
    pathname: string;
    search?: string;
    hash?: string;
}): string => {
    const { pathname, search = '', hash = '' } = parts;
    return `${pathname || '/'}${search || ''}${hash || ''}`;
};

export const isLoginPathname = (pathname: string): boolean => {
    return stripLocalePrefix(pathname || '/') === '/login';
};

export const isSafeAuthReturnPath = (path: string | null | undefined): path is string => {
    if (!path || typeof path !== 'string') return false;
    if (!path.startsWith('/') || path.startsWith('//')) return false;
    return !isLoginPathname(normalizePathOnly(path));
};

export const rememberAuthReturnPath = (path: string | null | undefined): void => {
    if (typeof window === 'undefined') return;
    if (!isSafeAuthReturnPath(path)) return;
    window.localStorage.setItem(AUTH_RETURN_PATH_STORAGE_KEY, path);
};

export const getRememberedAuthReturnPath = (): string | null => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(AUTH_RETURN_PATH_STORAGE_KEY);
    if (!isSafeAuthReturnPath(stored)) return null;
    return stored;
};

export const clearRememberedAuthReturnPath = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AUTH_RETURN_PATH_STORAGE_KEY);
};

interface PendingAuthRedirect {
    nextPath: string;
    source: string;
    createdAt: number;
}

const parsePendingAuthRedirect = (raw: string | null): PendingAuthRedirect | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<PendingAuthRedirect>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!isSafeAuthReturnPath(parsed.nextPath)) return null;
        if (typeof parsed.source !== 'string' || !parsed.source.trim()) return null;
        if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)) return null;
        if ((Date.now() - parsed.createdAt) > AUTH_PENDING_REDIRECT_TTL_MS) return null;
        return {
            nextPath: parsed.nextPath,
            source: parsed.source,
            createdAt: parsed.createdAt,
        };
    } catch {
        return null;
    }
};

export const setPendingAuthRedirect = (nextPath: string, source: string): void => {
    if (typeof window === 'undefined') return;
    if (!isSafeAuthReturnPath(nextPath)) return;
    const payload: PendingAuthRedirect = {
        nextPath,
        source: source || 'unknown',
        createdAt: Date.now(),
    };
    window.localStorage.setItem(AUTH_PENDING_REDIRECT_STORAGE_KEY, JSON.stringify(payload));
};

export const getPendingAuthRedirect = (): PendingAuthRedirect | null => {
    if (typeof window === 'undefined') return null;
    const pending = parsePendingAuthRedirect(window.localStorage.getItem(AUTH_PENDING_REDIRECT_STORAGE_KEY));
    if (!pending) {
        window.localStorage.removeItem(AUTH_PENDING_REDIRECT_STORAGE_KEY);
        return null;
    }
    return pending;
};

export const clearPendingAuthRedirect = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AUTH_PENDING_REDIRECT_STORAGE_KEY);
};

export const resolvePreferredNextPath = (
    ...candidates: Array<string | null | undefined>
): string => {
    for (const candidate of candidates) {
        if (isSafeAuthReturnPath(candidate)) return candidate;
    }
    return '/create-trip';
};
