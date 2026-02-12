import { AppLanguage } from '../types';

export const SUPPORTED_LOCALES: AppLanguage[] = ['en', 'de', 'fr', 'it', 'ru'];
export const DEFAULT_LOCALE: AppLanguage = 'en';

const HTML_LANG_MAP: Record<AppLanguage, string> = {
    en: 'en',
    de: 'de',
    fr: 'fr',
    it: 'it',
    ru: 'ru',
};

const INTL_LOCALE_MAP: Record<AppLanguage, string> = {
    en: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
    ru: 'ru-RU',
};

const DIR_MAP: Record<AppLanguage, 'ltr' | 'rtl'> = {
    en: 'ltr',
    de: 'ltr',
    fr: 'ltr',
    it: 'ltr',
    ru: 'ltr',
};

export const isLocale = (value?: string | null): value is AppLanguage => {
    if (!value) return false;
    return SUPPORTED_LOCALES.includes(value as AppLanguage);
};

export const normalizeLocale = (value?: string | null): AppLanguage => {
    return isLocale(value) ? value : DEFAULT_LOCALE;
};

export const localeToHtmlLang = (locale: AppLanguage): string => HTML_LANG_MAP[locale];

export const localeToIntlLocale = (locale: AppLanguage): string => INTL_LOCALE_MAP[locale];

export const localeToDir = (locale: AppLanguage): 'ltr' | 'rtl' => DIR_MAP[locale];

export const LOCALE_LABELS: Record<AppLanguage, string> = {
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    it: 'Italiano',
    ru: 'Русский',
};

export const LOCALE_FLAGS: Record<AppLanguage, string> = {
    en: '🇬🇧',
    de: '🇩🇪',
    fr: '🇫🇷',
    it: '🇮🇹',
    ru: '🇷🇺',
};

export const formatLocaleOptionLabel = (locale: AppLanguage): string => {
    return `${LOCALE_FLAGS[locale]} ${LOCALE_LABELS[locale]}`;
};
