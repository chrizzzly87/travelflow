import { readSessionStorageItem, writeSessionStorageItem } from './browserStorageService';

const NAVIGATION_CONTEXT_SESSION_STORAGE_KEY = 'tf_navigation_context_v1';
const MAX_PATH_LENGTH = 1024;

interface NavigationContextState {
  currentPath: string;
  previousPath: string | null;
  updatedAt: number;
}

const normalizeInternalPath = (path: string | null | undefined): string | null => {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  return trimmed.slice(0, MAX_PATH_LENGTH);
};

const parseNavigationContextState = (raw: string | null): NavigationContextState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NavigationContextState>;
    if (!parsed || typeof parsed !== 'object') return null;

    const currentPath = normalizeInternalPath(parsed.currentPath ?? null);
    if (!currentPath) return null;

    const previousPath = normalizeInternalPath(parsed.previousPath ?? null);
    const updatedAt = typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
      ? parsed.updatedAt
      : Date.now();

    return {
      currentPath,
      previousPath,
      updatedAt,
    };
  } catch {
    return null;
  }
};

const resolveSameOriginReferrerPath = (): string | null => {
  if (typeof window === 'undefined') return null;
  const referrer = document.referrer;
  if (!referrer) return null;

  try {
    const parsed = new URL(referrer);
    if (parsed.origin !== window.location.origin) return null;
    return normalizeInternalPath(`${parsed.pathname}${parsed.search}`);
  } catch {
    return null;
  }
};

export const rememberNavigationPath = (path: string): void => {
  if (typeof window === 'undefined') return;

  const normalizedPath = normalizeInternalPath(path);
  if (!normalizedPath) return;

  const previous = parseNavigationContextState(readSessionStorageItem(NAVIGATION_CONTEXT_SESSION_STORAGE_KEY));
  if (previous?.currentPath === normalizedPath) return;

  const nextState: NavigationContextState = {
    currentPath: normalizedPath,
    previousPath: previous?.currentPath && previous.currentPath !== normalizedPath
      ? previous.currentPath
      : previous?.previousPath ?? null,
    updatedAt: Date.now(),
  };

  writeSessionStorageItem(NAVIGATION_CONTEXT_SESSION_STORAGE_KEY, JSON.stringify(nextState));
};

export const getLastVisitedPath = (currentPath: string): string | null => {
  const normalizedCurrentPath = normalizeInternalPath(currentPath);
  if (!normalizedCurrentPath) return null;

  const storedContext = parseNavigationContextState(readSessionStorageItem(NAVIGATION_CONTEXT_SESSION_STORAGE_KEY));
  if (storedContext?.currentPath && storedContext.currentPath !== normalizedCurrentPath) {
    return storedContext.currentPath;
  }
  if (storedContext?.previousPath && storedContext.previousPath !== normalizedCurrentPath) {
    return storedContext.previousPath;
  }

  const referrerPath = resolveSameOriginReferrerPath();
  if (referrerPath && referrerPath !== normalizedCurrentPath) return referrerPath;

  return null;
};
