import type { AppLanguage } from '../types';
import { DEFAULT_LOCALE, localeToIntlLocale, normalizeLocale } from '../config/locales';

export const APP_LANGUAGE_STORAGE_KEY = 'tf_app_language';
export const DEFAULT_APP_LANGUAGE: AppLanguage = DEFAULT_LOCALE;

export const normalizeAppLanguage = (value?: string | null): AppLanguage => {
    return normalizeLocale(value);
};

export const getIntlLocaleForAppLanguage = (language: AppLanguage): string => {
    return localeToIntlLocale(normalizeAppLanguage(language));
};
