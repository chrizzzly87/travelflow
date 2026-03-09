import { readLocalStorageItem, writeLocalStorageItem } from './browserStorageService';
import { type ConnectivityState, getConnectivitySnapshot } from './supabaseHealthMonitor';

export const CLIENT_ERROR_BUFFER_STORAGE_KEY = 'tf_client_error_buffer_v1';
const MAX_CLIENT_ERRORS = 100;

export interface ClientErrorLogEntry {
  timestamp: string;
  errorType: string;
  message: string;
  route: string;
  tripId?: string;
  connectivityState: ConnectivityState;
}

const isValidEntry = (value: unknown): value is ClientErrorLogEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ClientErrorLogEntry>;
  return typeof entry.timestamp === 'string'
    && typeof entry.errorType === 'string'
    && typeof entry.message === 'string'
    && typeof entry.route === 'string'
    && (entry.connectivityState === 'online' || entry.connectivityState === 'degraded' || entry.connectivityState === 'offline');
};

const readBuffer = (): ClientErrorLogEntry[] => {
  try {
    const raw = readLocalStorageItem(CLIENT_ERROR_BUFFER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
};

const writeBuffer = (entries: ClientErrorLogEntry[]): void => {
  try {
    writeLocalStorageItem(CLIENT_ERROR_BUFFER_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_CLIENT_ERRORS)));
  } catch {
    // best effort only
  }
};

const normalizeMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const typed = error as { message?: unknown; code?: unknown; status?: unknown };
    const message = typeof typed.message === 'string' ? typed.message : '';
    const code = typeof typed.code === 'string' ? typed.code : '';
    const status = typeof typed.status === 'number' ? String(typed.status) : '';
    const parts = [code, status, message].filter(Boolean);
    if (parts.length > 0) return parts.join(' | ');
  }
  return 'Unknown client error';
};

export const appendClientErrorLog = (input: {
  errorType: string;
  error: unknown;
  route?: string;
  tripId?: string;
  connectivityState?: ConnectivityState;
}): void => {
  const connectivityState = input.connectivityState ?? getConnectivitySnapshot().state;
  const route = input.route
    ?? (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : 'unknown');

  const entry: ClientErrorLogEntry = {
    timestamp: new Date().toISOString(),
    errorType: input.errorType,
    message: normalizeMessage(input.error),
    route,
    tripId: input.tripId,
    connectivityState,
  };

  const current = readBuffer();
  writeBuffer([entry, ...current]);
};

export const getClientErrorLogBuffer = (): ClientErrorLogEntry[] => readBuffer();

export const clearClientErrorLogBuffer = (): void => {
  writeBuffer([]);
};
