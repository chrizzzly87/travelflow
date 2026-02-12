import { AppLanguage } from '../types';

export const SUPPORTED_LOCALES: AppLanguage[] = ['en', 'es', 'de', 'fr', 'pt', 'ru', 'it'];
export const DEFAULT_LOCALE: AppLanguage = 'en';

const HTML_LANG_MAP: Record<AppLanguage, string> = {
    en: 'en',
    es: 'es',
    de: 'de',
    fr: 'fr',
    pt: 'pt',
    ru: 'ru',
    it: 'it',
};

const INTL_LOCALE_MAP: Record<AppLanguage, string> = {
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    fr: 'fr-FR',
    pt: 'pt-PT',
    ru: 'ru-RU',
    it: 'it-IT',
};

const DIR_MAP: Record<AppLanguage, 'ltr' | 'rtl'> = {
    en: 'ltr',
    es: 'ltr',
    de: 'ltr',
    fr: 'ltr',
    pt: 'ltr',
    ru: 'ltr',
    it: 'ltr',
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
    es: 'Español',
    de: 'Deutsch',
    fr: 'Français',
    pt: 'Português',
    ru: 'Русский',
    it: 'Italiano',
};

export const LOCALE_FLAGS: Record<AppLanguage, string> = {
    en: '🇬🇧',
    es: '🇪🇸',
    de: '🇩🇪',
    fr: '🇫🇷',
    pt: '🇵🇹',
    ru: '🇷🇺',
    it: '🇮🇹',
};

export const formatLocaleOptionLabel = (locale: AppLanguage): string => {
    return `${LOCALE_FLAGS[locale]} ${LOCALE_LABELS[locale]}`;
};
