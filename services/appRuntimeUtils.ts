import { AppLanguage } from '../types';
import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import { readLocalStorageItem, writeLocalStorageItem } from './browserStorageService';

const APP_LANGUAGE_STORAGE_KEY = 'tf_app_language';
const DEFAULT_APP_LANGUAGE: AppLanguage = DEFAULT_LOCALE;

const normalizeAppLanguage = (value?: string | null): AppLanguage => {
    return normalizeLocale(value);
};

export const generateVersionId = (): string => {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildTripUrl = (tripId: string, versionId?: string | null): string => {
    const base = `/trip/${encodeURIComponent(tripId)}`;
    if (!versionId) return base;
    const params = new URLSearchParams();
    params.set('v', versionId);
    return `${base}?${params.toString()}`;
};

export const getStoredAppLanguage = (): AppLanguage => {
    if (typeof window === 'undefined') return DEFAULT_APP_LANGUAGE;
    return normalizeAppLanguage(readLocalStorageItem(APP_LANGUAGE_STORAGE_KEY));
};

export const setStoredAppLanguage = (language: AppLanguage): void => {
    if (typeof window === 'undefined') return;
    writeLocalStorageItem(APP_LANGUAGE_STORAGE_KEY, normalizeAppLanguage(language));
};
