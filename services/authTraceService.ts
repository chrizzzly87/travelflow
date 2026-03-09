import {
    readLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';

const AUTH_TRACE_STORAGE_KEY = 'tf_auth_trace_v1';
const AUTH_TRACE_MAX_ENTRIES = 150;

export interface AuthTraceEntry {
    ts: string;
    flowId: string;
    attemptId: string;
    step: string;
    result: 'start' | 'success' | 'error';
    provider?: string | null;
    errorCode?: string | null;
    metadata?: Record<string, unknown>;
}

const isBrowser = () => typeof window !== 'undefined';

const readAuthTrace = (): AuthTraceEntry[] => {
    if (!isBrowser()) return [];
    try {
        const raw = readLocalStorageItem(AUTH_TRACE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed as AuthTraceEntry[] : [];
    } catch {
        return [];
    }
};

const writeAuthTrace = (entries: AuthTraceEntry[]) => {
    if (!isBrowser()) return;
    try {
        writeLocalStorageItem(AUTH_TRACE_STORAGE_KEY, JSON.stringify(entries.slice(-AUTH_TRACE_MAX_ENTRIES)));
    } catch {
        // ignore storage limits/errors
    }
};

export const appendAuthTraceEntry = (entry: AuthTraceEntry) => {
    const current = readAuthTrace();
    current.push(entry);
    writeAuthTrace(current);
};

export const getAuthTraceEntries = (): AuthTraceEntry[] => readAuthTrace();

export const clearAuthTraceEntries = () => writeAuthTrace([]);
