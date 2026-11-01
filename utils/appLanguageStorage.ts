import type { AppLanguage } from '../types';
import { APP_LANGUAGE_STORAGE_KEY, DEFAULT_APP_LANGUAGE, normalizeAppLanguage } from '../shared/appLanguage';

export const getStoredAppLanguage = (): AppLanguage => {
    if (typeof window === 'undefined') return DEFAULT_APP_LANGUAGE;
    return normalizeAppLanguage(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY));
};

export const setStoredAppLanguage = (language: AppLanguage): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, normalizeAppLanguage(language));
};
