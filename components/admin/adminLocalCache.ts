import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

export const readAdminCache = <T>(key: string, fallbackValue: T): T => {
    if (typeof window === 'undefined') return fallbackValue;
    try {
        const rawValue = readLocalStorageItem(key);
        if (!rawValue) return fallbackValue;
        return JSON.parse(rawValue) as T;
    } catch {
        return fallbackValue;
    }
};

export const writeAdminCache = (key: string, value: unknown): void => {
    if (typeof window === 'undefined') return;
    try {
        writeLocalStorageItem(key, JSON.stringify(value));
    } catch {
        // ignore cache write errors (quota/private mode), UI still works from live fetches
    }
};
