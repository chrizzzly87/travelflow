import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from './config/locales';
import { APP_NAME } from './config/appGlobals';
import { readLocalStorageItem, writeLocalStorageItem } from './services/browserStorageService';

const localeModules = import.meta.glob('./locales/*/*.json');
const preloadCache = new Set<string>();
const LOCALE_STORAGE_KEY = 'tf_app_language';

const normalizeDetectedLocale = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (isLocale(normalized)) return normalized;

    const baseLanguage = normalized.split('-')[0];
    if (isLocale(baseLanguage)) return baseLanguage;

    return null;
};

const detectLocaleFromPath = (): string | null => {
    if (typeof window === 'undefined') return null;

    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
    return normalizeDetectedLocale(firstSegment);
};

const detectLocaleFromLocalStorage = (): string | null => {
    if (typeof window === 'undefined') return null;

    try {
        return normalizeDetectedLocale(readLocalStorageItem(LOCALE_STORAGE_KEY));
    } catch {
        return null;
    }
};

const detectLocaleFromNavigator = (): string | null => {
    if (typeof navigator === 'undefined') return null;
    return normalizeDetectedLocale(navigator.language);
};

const detectLocaleFromHtmlTag = (): string | null => {
    if (typeof document === 'undefined') return null;
    return normalizeDetectedLocale(document.documentElement.lang);
};

const detectInitialLocale = (): string => {
    return (
        detectLocaleFromPath()
        || detectLocaleFromLocalStorage()
        || detectLocaleFromNavigator()
        || detectLocaleFromHtmlTag()
        || DEFAULT_LOCALE
    );
};

const loadLocaleNamespace = async (language: string, namespace: string) => {
    const normalizedLanguage = isLocale(language) ? language : DEFAULT_LOCALE;
    const preferredKey = `./locales/${normalizedLanguage}/${namespace}.json`;
    const fallbackKey = `./locales/${DEFAULT_LOCALE}/${namespace}.json`;

    const preferredLoader = localeModules[preferredKey];
    if (preferredLoader) {
        const module = await preferredLoader();
        return (module as { default: Record<string, unknown> }).default;
    }

    const fallbackLoader = localeModules[fallbackKey];
    if (fallbackLoader) {
        const module = await fallbackLoader();
        return (module as { default: Record<string, unknown> }).default;
    }

    return {};
};

export const preloadLocaleNamespaces = async (language: string, namespaces: string[]): Promise<void> => {
    const normalizedLanguage = isLocale(language) ? language : DEFAULT_LOCALE;
    const uniqueNamespaces = Array.from(new Set(namespaces.filter(Boolean)));

    await Promise.all(uniqueNamespaces.map(async (namespace) => {
        const cacheKey = `${normalizedLanguage}:${namespace}`;
        if (preloadCache.has(cacheKey) || i18n.hasResourceBundle(normalizedLanguage, namespace)) return;

        const resources = await loadLocaleNamespace(normalizedLanguage, namespace);
        i18n.addResourceBundle(normalizedLanguage, namespace, resources, true, true);
        preloadCache.add(cacheKey);
    }));
};

void i18n
    .use(resourcesToBackend(loadLocaleNamespace))
    .use(initReactI18next)
    .init({
        lng: detectInitialLocale(),
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: SUPPORTED_LOCALES,
        nonExplicitSupportedLngs: false,
        defaultNS: 'common',
        ns: ['common'],
        interpolation: {
            prefix: '{',
            suffix: '}',
            escapeValue: false,
            defaultVariables: {
                appName: APP_NAME,
            },
        },
        react: {
            useSuspense: true,
        },
    });

if (typeof window !== 'undefined') {
    i18n.on('languageChanged', (language) => {
        const normalized = normalizeDetectedLocale(language);
        if (!normalized) return;
        try {
            writeLocalStorageItem(LOCALE_STORAGE_KEY, normalized);
        } catch {
            // Ignore storage write failures (private mode/quota/security).
        }
    });
}

export default i18n;
