import { stripLocalePrefix } from '../config/routes';

const AUTH_RETURN_PATH_STORAGE_KEY = 'tf_auth_return_path_v1';

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

export const resolvePreferredNextPath = (
    ...candidates: Array<string | null | undefined>
): string => {
    for (const candidate of candidates) {
        if (isSafeAuthReturnPath(candidate)) return candidate;
    }
    return '/create-trip';
};

