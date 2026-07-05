import { createInstance, type TFunction } from 'i18next';
import { APP_NAME } from '../../config/appGlobals';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isLocale } from '../../config/locales';
import { loadLocaleResources } from './resources';

/**
 * Server-side translator for generateMetadata and other RSC-only text.
 * Creates a throwaway fixed-language instance per call (cheap: resources are
 * plain objects already loaded through the module cache).
 */
export const getServerT = async (
    locale: string,
    namespaces: readonly string[]
): Promise<TFunction> => {
    const normalizedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const resources = await loadLocaleResources(normalizedLocale, namespaces);

    const instance = createInstance();
    await instance.init({
        lng: normalizedLocale,
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: SUPPORTED_LOCALES,
        nonExplicitSupportedLngs: false,
        defaultNS: namespaces[0] ?? 'common',
        ns: [...namespaces],
        resources: { [normalizedLocale]: resources },
        initImmediate: false,
        interpolation: {
            prefix: '{',
            suffix: '}',
            escapeValue: false,
            defaultVariables: {
                appName: APP_NAME,
            },
        },
    });

    return instance.getFixedT(normalizedLocale);
};

/** Mirrors services/pageTitleService.ts formatting: "<label> · TravelFlow". */
export const buildPageTitle = (label: string): string => `${label} · ${APP_NAME}`;
