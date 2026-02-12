import { getIdleWarmupPaths, resolvePrefetchTargets } from '../config/prefetchTargets';

export type PrefetchReason = 'hover' | 'focus' | 'pointerdown' | 'touchstart' | 'viewport' | 'idle' | 'manual';

export interface PrefetchStats {
    attempts: number;
    completed: number;
    skippedDisabled: number;
    skippedNetwork: number;
    skippedBudget: number;
    skippedUnsupportedPath: number;
    reasons: Record<PrefetchReason, number>;
}

export const PREFETCH_STATS_DEBUG_EVENT = 'tf:prefetch-stats-debug';

const MAX_CONCURRENT_LOADS = 2;
const MAX_SESSION_WARMUPS = 12;
const MAX_IDLE_WARMUPS_PER_VIEW = 2;
const HOVER_INTENT_DELAY_MS = 65;

const isProd = import.meta.env.PROD;
const navPrefetchEnabledByEnv = import.meta.env.VITE_NAV_PREFETCH_ENABLED;
const debugPrefetch = import.meta.env.VITE_PREFETCH_DEBUG === 'true';

export const isNavPrefetchEnabled = (): boolean => {
    if (navPrefetchEnabledByEnv === 'true') return true;
    if (navPrefetchEnabledByEnv === 'false') return false;
    return isProd;
};

const defaultStats = (): PrefetchStats => ({
    attempts: 0,
    completed: 0,
    skippedDisabled: 0,
    skippedNetwork: 0,
    skippedBudget: 0,
    skippedUnsupportedPath: 0,
    reasons: {
        hover: 0,
        focus: 0,
        pointerdown: 0,
        touchstart: 0,
        viewport: 0,
        idle: 0,
        manual: 0,
    },
});

const stats: PrefetchStats = defaultStats();

const prefetchedTargetKeys = new Set<string>();
const queuedTargetKeys = new Set<string>();
const inFlightTargetKeys = new Set<string>();

const taskQueue: Array<() => void> = [];
let activeLoads = 0;
let sessionWarmups = 0;

const hoverTimers = new WeakMap<Element, number>();

const logDebug = (...args: unknown[]) => {
    if (!debugPrefetch) return;
    console.debug('[prefetch]', ...args);
};

const getConnection = (): (NetworkInformation & { saveData?: boolean; effectiveType?: string }) | null => {
    if (typeof navigator === 'undefined') return null;
    return (navigator as Navigator & {
        connection?: NetworkInformation & { saveData?: boolean; effectiveType?: string };
        mozConnection?: NetworkInformation & { saveData?: boolean; effectiveType?: string };
        webkitConnection?: NetworkInformation & { saveData?: boolean; effectiveType?: string };
    }).connection
        || (navigator as Navigator & {
            mozConnection?: NetworkInformation & { saveData?: boolean; effectiveType?: string };
        }).mozConnection
        || (navigator as Navigator & {
            webkitConnection?: NetworkInformation & { saveData?: boolean; effectiveType?: string };
        }).webkitConnection
        || null;
};

const isNetworkSuitable = (): boolean => {
    if (typeof document !== 'undefined' && document.hidden) return false;
    const connection = getConnection();
    if (!connection) return true;
    if (connection.saveData) return false;
    const effectiveType = connection.effectiveType || '';
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return false;
    return true;
};

const normalizePathname = (rawPath: string): string => {
    if (!rawPath) return '';
    try {
        const url = new URL(rawPath, window.location.origin);
        if (url.origin !== window.location.origin) return '';
        return url.pathname;
    } catch {
        return '';
    }
};

const drainQueue = () => {
    while (activeLoads < MAX_CONCURRENT_LOADS && taskQueue.length > 0) {
        const next = taskQueue.shift();
        if (!next) break;
        next();
    }
};

const enqueueTargetLoad = (target: { key: string; load: () => Promise<unknown> }) => {
    if (prefetchedTargetKeys.has(target.key)) return;
    if (queuedTargetKeys.has(target.key)) return;
    if (inFlightTargetKeys.has(target.key)) return;
    if (sessionWarmups >= MAX_SESSION_WARMUPS) {
        stats.skippedBudget += 1;
        return;
    }

    queuedTargetKeys.add(target.key);
    taskQueue.push(() => {
        queuedTargetKeys.delete(target.key);
        if (prefetchedTargetKeys.has(target.key) || inFlightTargetKeys.has(target.key)) {
            drainQueue();
            return;
        }
        if (sessionWarmups >= MAX_SESSION_WARMUPS) {
            stats.skippedBudget += 1;
            drainQueue();
            return;
        }

        sessionWarmups += 1;
        activeLoads += 1;
        inFlightTargetKeys.add(target.key);

        target.load()
            .then(() => {
                prefetchedTargetKeys.add(target.key);
                stats.completed += 1;
                logDebug('prefetched', target.key);
            })
            .catch((error) => {
                logDebug('prefetch failed', target.key, error);
            })
            .finally(() => {
                inFlightTargetKeys.delete(target.key);
                activeLoads = Math.max(0, activeLoads - 1);
                drainQueue();
            });
    });

    drainQueue();
};

export const warmRouteAssets = async (pathOrUrl: string, reason: PrefetchReason = 'manual'): Promise<void> => {
    stats.attempts += 1;
    stats.reasons[reason] += 1;

    if (!isNavPrefetchEnabled()) {
        stats.skippedDisabled += 1;
        return;
    }

    if (typeof window === 'undefined') {
        stats.skippedUnsupportedPath += 1;
        return;
    }

    if (!isNetworkSuitable()) {
        stats.skippedNetwork += 1;
        return;
    }

    const pathname = normalizePathname(pathOrUrl);
    if (!pathname) {
        stats.skippedUnsupportedPath += 1;
        return;
    }

    const targets = resolvePrefetchTargets(pathname);
    if (targets.length === 0) {
        stats.skippedUnsupportedPath += 1;
        return;
    }

    targets.forEach((target) => enqueueTargetLoad(target));
};

export const scheduleIdleWarmups = (pathname: string, extraCandidates: string[] = []) => {
    if (!isNavPrefetchEnabled()) return;
    if (typeof window === 'undefined') return;

    const mergedCandidates: string[] = [];
    const seen = new Set<string>();
    [...getIdleWarmupPaths(pathname), ...extraCandidates].forEach((candidate) => {
        if (!candidate) return;
        if (seen.has(candidate)) return;
        seen.add(candidate);
        mergedCandidates.push(candidate);
    });

    const candidates = mergedCandidates.slice(0, MAX_IDLE_WARMUPS_PER_VIEW);
    if (candidates.length === 0) return;

    const run = () => {
        candidates.forEach((candidate) => {
            void warmRouteAssets(candidate, 'idle');
        });
    };

    if ('requestIdleCallback' in window) {
        (window as Window & {
            requestIdleCallback: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
        }).requestIdleCallback(() => run(), { timeout: 1800 });
        return;
    }

    window.setTimeout(run, 800);
};

export const clearHoverIntentTimer = (element: Element | null) => {
    if (!element) return;
    const timerId = hoverTimers.get(element);
    if (!timerId) return;
    window.clearTimeout(timerId);
    hoverTimers.delete(element);
};

export const scheduleHoverIntentWarmup = (element: Element, pathOrUrl: string) => {
    clearHoverIntentTimer(element);
    const timerId = window.setTimeout(() => {
        void warmRouteAssets(pathOrUrl, 'hover');
        hoverTimers.delete(element);
    }, HOVER_INTENT_DELAY_MS);
    hoverTimers.set(element, timerId);
};

export const getPrefetchStats = (): PrefetchStats => ({
    ...stats,
    reasons: { ...stats.reasons },
});

export const publishPrefetchStats = () => {
    if (typeof window === 'undefined') return;
    const snapshot = getPrefetchStats();
    (window as Window & { __tfPrefetchStats?: PrefetchStats }).__tfPrefetchStats = snapshot;
    window.dispatchEvent(new CustomEvent<PrefetchStats>(PREFETCH_STATS_DEBUG_EVENT, {
        detail: snapshot,
    }));
};
