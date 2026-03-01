import { DB_ENABLED } from '../config/db';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from './browserStorageService';
import { getEffectiveBrowserOnlineState, subscribeBrowserConnectivityStatus } from './networkStatus';
import { supabase } from './supabaseClient';

export type ConnectivityState = 'online' | 'degraded' | 'offline';

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  reason: string | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  consecutiveFailures: number;
  isForced: boolean;
  forcedState: ConnectivityState | null;
}

export type ConnectivityFailureContext = {
  source?: string;
  operation?: string;
  tripId?: string;
};

export const CONNECTIVITY_DEBUG_EVENT = 'tf:supabase-connectivity-debug';
export const CONNECTIVITY_STATUS_EVENT = 'tf:supabase-connectivity-status';
export const CONNECTIVITY_OVERRIDE_STORAGE_KEY = 'tf_debug_supabase_connectivity_override';

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 8_000;
const OFFLINE_FAILURE_THRESHOLD = 3;

type ConnectivityListener = (snapshot: ConnectivitySnapshot) => void;

let snapshot: ConnectivitySnapshot = {
  state: 'online',
  reason: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  isForced: false,
  forcedState: null,
};

const listeners = new Set<ConnectivityListener>();
let initialized = false;
let healthTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightProbe: Promise<ConnectivitySnapshot> | null = null;

const isBrowser = (): boolean => typeof window !== 'undefined';

const browserOnline = (): boolean => {
  if (!isBrowser()) return true;
  return getEffectiveBrowserOnlineState(window.navigator);
};

const normalizeOverride = (value: unknown): ConnectivityState | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'offline' || normalized === 'true') return 'offline';
  if (normalized === 'degraded') return 'degraded';
  if (normalized === 'online' || normalized === 'false') return 'online';
  return null;
};

const readStoredOverride = (): ConnectivityState | null => {
  if (!isBrowser()) return null;
  return normalizeOverride(readLocalStorageItem(CONNECTIVITY_OVERRIDE_STORAGE_KEY));
};

const resolveState = (
  next: Pick<ConnectivitySnapshot, 'consecutiveFailures' | 'isForced' | 'forcedState'>,
): ConnectivityState => {
  if (next.isForced && next.forcedState) return next.forcedState;
  if (!browserOnline()) return 'offline';
  if (next.consecutiveFailures >= OFFLINE_FAILURE_THRESHOLD) return 'offline';
  if (next.consecutiveFailures > 0) return 'degraded';
  return 'online';
};

const snapshotsEqual = (a: ConnectivitySnapshot, b: ConnectivitySnapshot): boolean => (
  a.state === b.state
  && a.reason === b.reason
  && a.lastSuccessAt === b.lastSuccessAt
  && a.lastFailureAt === b.lastFailureAt
  && a.consecutiveFailures === b.consecutiveFailures
  && a.isForced === b.isForced
  && a.forcedState === b.forcedState
);

const emitSnapshot = (nextSnapshot: ConnectivitySnapshot) => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<ConnectivitySnapshot>(CONNECTIVITY_STATUS_EVENT, {
    detail: nextSnapshot,
  }));
  window.dispatchEvent(new CustomEvent<ConnectivitySnapshot>(CONNECTIVITY_DEBUG_EVENT, {
    detail: nextSnapshot,
  }));
};

const setSnapshot = (
  updater: (previous: ConnectivitySnapshot) => ConnectivitySnapshot,
): ConnectivitySnapshot => {
  const next = updater(snapshot);
  if (snapshotsEqual(snapshot, next)) {
    return snapshot;
  }
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
  emitSnapshot(snapshot);
  return snapshot;
};

const clearHealthTimer = () => {
  if (!healthTimer) return;
  clearTimeout(healthTimer);
  healthTimer = null;
};

const scheduleHealthCheck = () => {
  if (!isBrowser()) return;
  clearHealthTimer();
  if (document.hidden) return;
  healthTimer = setTimeout(() => {
    void probeSupabaseHealth();
  }, HEALTH_CHECK_INTERVAL_MS);
};

const applyForcedState = (mode: ConnectivityState | null): ConnectivitySnapshot => {
  const isForced = Boolean(mode);
  return setSnapshot((prev) => {
    const nextForcedState = mode;
    const nextConsecutiveFailures = isForced
      ? prev.consecutiveFailures
      : (browserOnline() ? prev.consecutiveFailures : Math.max(prev.consecutiveFailures, OFFLINE_FAILURE_THRESHOLD));

    return {
      ...prev,
      isForced,
      forcedState: nextForcedState,
      state: resolveState({
        consecutiveFailures: nextConsecutiveFailures,
        isForced,
        forcedState: nextForcedState,
      }),
      reason: isForced
        ? `forced_${mode}`
        : (browserOnline() ? prev.reason : 'browser_offline'),
    };
  });
};

export const parseConnectivityOverrideFromSearch = (search: string): ConnectivityState | 'clear' | null => {
  const params = new URLSearchParams(search);
  const raw = params.get('offline');
  if (raw === null) return null;
  const parsed = normalizeOverride(raw);
  if (parsed === null) return null;
  if (parsed === 'online') return 'clear';
  return parsed;
};

export const applyConnectivityOverrideFromSearch = (search: string): ConnectivitySnapshot | null => {
  const parsed = parseConnectivityOverrideFromSearch(search);
  if (parsed === null) return null;
  if (parsed === 'clear') {
    return clearConnectivityOverride();
  }
  return setConnectivityOverride(parsed);
};

const timeoutPromise = <T,>(ms: number, fallbackError: Error): Promise<T> => new Promise((_, reject) => {
  const timer = setTimeout(() => {
    clearTimeout(timer);
    reject(fallbackError);
  }, ms);
});

const isConnectivityFailureMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return normalized.includes('network')
    || normalized.includes('fetch failed')
    || normalized.includes('failed to fetch')
    || normalized.includes('timed out')
    || normalized.includes('timeout')
    || normalized.includes('offline');
};

export const describeConnectivityError = (
  error: unknown,
  context?: ConnectivityFailureContext,
): { reason: string; isNetworkLike: boolean } => {
  const typed = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const code = typeof typed?.code === 'string' ? typed.code.trim() : '';
  const status = typeof typed?.status === 'number' ? typed.status : null;
  const message = typeof typed?.message === 'string' ? typed.message.trim() : '';

  const reasonParts = [
    context?.source || null,
    context?.operation || null,
    context?.tripId ? `trip:${context.tripId}` : null,
    code ? `code:${code}` : null,
    status !== null ? `status:${status}` : null,
    message ? `msg:${message.slice(0, 120)}` : null,
  ].filter((part): part is string => Boolean(part));

  const reason = reasonParts.length > 0 ? reasonParts.join('|') : 'unknown_error';
  const isNetworkLike = (!browserOnline())
    || isConnectivityFailureMessage(message)
    || status === 408
    || status === 502
    || status === 503
    || status === 504;

  return {
    reason,
    isNetworkLike,
  };
};

export const markConnectivityFailure = (
  error: unknown,
  context?: ConnectivityFailureContext,
): ConnectivitySnapshot => {
  const now = Date.now();
  const details = describeConnectivityError(error, context);

  return setSnapshot((prev) => {
    const nextConsecutiveFailures = prev.isForced && prev.forcedState
      ? prev.consecutiveFailures
      : prev.consecutiveFailures + 1;

    let nextState = resolveState({
      consecutiveFailures: nextConsecutiveFailures,
      isForced: prev.isForced,
      forcedState: prev.forcedState,
    });

    if (!prev.isForced && details.isNetworkLike && nextConsecutiveFailures >= 2) {
      nextState = 'offline';
    }

    return {
      ...prev,
      state: nextState,
      reason: details.reason,
      lastFailureAt: now,
      consecutiveFailures: nextConsecutiveFailures,
    };
  });
};

export const markConnectivitySuccess = (reason = 'health_ok'): ConnectivitySnapshot => {
  const now = Date.now();
  return setSnapshot((prev) => ({
    ...prev,
    state: resolveState({
      consecutiveFailures: 0,
      isForced: prev.isForced,
      forcedState: prev.forcedState,
    }),
    reason: prev.isForced ? prev.reason : reason,
    lastSuccessAt: now,
    consecutiveFailures: 0,
  }));
};

export const probeSupabaseHealth = async (): Promise<ConnectivitySnapshot> => {
  if (!isBrowser()) return snapshot;
  if (inFlightProbe) return inFlightProbe;

  inFlightProbe = (async () => {
    try {
      if (snapshot.isForced && snapshot.forcedState) {
        return snapshot;
      }

      if (!browserOnline()) {
        return setSnapshot((prev) => ({
          ...prev,
          state: resolveState({
            consecutiveFailures: prev.consecutiveFailures,
            isForced: prev.isForced,
            forcedState: prev.forcedState,
          }),
          reason: 'browser_offline',
          lastFailureAt: Date.now(),
        }));
      }

      if (!DB_ENABLED || !supabase) {
        return markConnectivitySuccess('db_disabled');
      }

      const probe = supabase.auth.getSession();
      const timeoutError = new Error('Supabase health probe timed out');
      const result = await Promise.race([
        probe as Promise<unknown>,
        timeoutPromise<unknown>(HEALTH_CHECK_TIMEOUT_MS, timeoutError),
      ]);

      const probeError = (result as { error?: { message?: string } | null })?.error;
      if (probeError) {
        return markConnectivityFailure(probeError, {
          source: 'health_probe',
          operation: 'auth.getSession',
        });
      }

      return markConnectivitySuccess('health_probe_ok');
    } catch (error) {
      return markConnectivityFailure(error, {
        source: 'health_probe',
        operation: 'auth.getSession',
      });
    } finally {
      scheduleHealthCheck();
      inFlightProbe = null;
    }
  })();

  return inFlightProbe;
};

const bootstrapInitialSnapshot = () => {
  const forcedState = readStoredOverride();
  snapshot = {
    ...snapshot,
    isForced: Boolean(forcedState),
    forcedState,
    state: resolveState({
      consecutiveFailures: browserOnline() ? 0 : OFFLINE_FAILURE_THRESHOLD,
      isForced: Boolean(forcedState),
      forcedState,
    }),
    reason: forcedState ? `forced_${forcedState}` : (!browserOnline() ? 'browser_offline' : null),
    consecutiveFailures: browserOnline() ? 0 : OFFLINE_FAILURE_THRESHOLD,
  };
};

export const startSupabaseHealthMonitor = (): void => {
  if (!isBrowser()) return;
  if (initialized) return;
  initialized = true;

  bootstrapInitialSnapshot();
  listeners.forEach((listener) => listener(snapshot));
  emitSnapshot(snapshot);

  window.addEventListener('online', () => {
    setSnapshot((prev) => ({
      ...prev,
      reason: prev.isForced ? prev.reason : 'browser_online',
      state: resolveState({
        consecutiveFailures: prev.consecutiveFailures,
        isForced: prev.isForced,
        forcedState: prev.forcedState,
      }),
    }));
    void probeSupabaseHealth();
  });

  window.addEventListener('offline', () => {
    setSnapshot((prev) => ({
      ...prev,
      state: resolveState({
        consecutiveFailures: Math.max(prev.consecutiveFailures, OFFLINE_FAILURE_THRESHOLD),
        isForced: prev.isForced,
        forcedState: prev.forcedState,
      }),
      reason: 'browser_offline',
      lastFailureAt: Date.now(),
      consecutiveFailures: Math.max(prev.consecutiveFailures, OFFLINE_FAILURE_THRESHOLD),
    }));
    clearHealthTimer();
  });

  subscribeBrowserConnectivityStatus((browserSnapshot) => {
    if (browserSnapshot.isOnline) {
      setSnapshot((prev) => ({
        ...prev,
        reason: prev.isForced ? prev.reason : 'browser_online',
        state: resolveState({
          consecutiveFailures: prev.consecutiveFailures,
          isForced: prev.isForced,
          forcedState: prev.forcedState,
        }),
      }));
      void probeSupabaseHealth();
      return;
    }

    setSnapshot((prev) => ({
      ...prev,
      state: resolveState({
        consecutiveFailures: Math.max(prev.consecutiveFailures, OFFLINE_FAILURE_THRESHOLD),
        isForced: prev.isForced,
        forcedState: prev.forcedState,
      }),
      reason: 'browser_offline',
      lastFailureAt: Date.now(),
      consecutiveFailures: Math.max(prev.consecutiveFailures, OFFLINE_FAILURE_THRESHOLD),
    }));
    clearHealthTimer();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearHealthTimer();
      return;
    }
    void probeSupabaseHealth();
  });

  void probeSupabaseHealth();
};

export const getConnectivitySnapshot = (): ConnectivitySnapshot => {
  return snapshot;
};

export const subscribeConnectivityStatus = (listener: ConnectivityListener): (() => void) => {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
};

export const setConnectivityOverride = (mode: ConnectivityState): ConnectivitySnapshot => {
  if (mode === 'online') {
    return clearConnectivityOverride();
  }

  if (isBrowser()) {
    writeLocalStorageItem(CONNECTIVITY_OVERRIDE_STORAGE_KEY, mode);
  }

  const next = applyForcedState(mode);
  clearHealthTimer();
  return next;
};

export const clearConnectivityOverride = (): ConnectivitySnapshot => {
  if (isBrowser()) {
    removeLocalStorageItem(CONNECTIVITY_OVERRIDE_STORAGE_KEY);
  }
  const next = applyForcedState(null);
  void probeSupabaseHealth();
  return next;
};

if (isBrowser()) {
  startSupabaseHealthMonitor();
}
