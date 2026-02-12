import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from './config/locales';
import { APP_NAME } from './config/appGlobals';

const localeModules = import.meta.glob('./locales/*/*.json');
const preloadCache = new Set<string>();

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
    .use(LanguageDetector)
    .use(ICU)
    .use(initReactI18next)
    .init({
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: SUPPORTED_LOCALES,
        nonExplicitSupportedLngs: false,
        defaultNS: 'common',
        ns: ['common'],
        detection: {
            order: ['path', 'localStorage', 'navigator', 'htmlTag'],
            lookupFromPathIndex: 0,
            lookupLocalStorage: 'tf_app_language',
            caches: ['localStorage'],
        },
        interpolation: {
            escapeValue: false,
            defaultVariables: {
                appName: APP_NAME,
            },
        },
        react: {
            useSuspense: true,
        },
    });

export default i18n;
