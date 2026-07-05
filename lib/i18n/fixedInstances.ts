import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { APP_NAME } from '../../config/appGlobals';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';
import type { LocaleResources } from './resources';

// Fixed-language i18next instances for server-rendered marketing/blog/legal
// routes. One instance per locale, never language-switched, so concurrent SSR
// of different locales can never race each other (locale changes on these
// routes are URL navigations to another locale's tree). Tool routes keep the
// mutable client singleton from i18n.ts.

const instances = new Map<string, I18nInstance>();

const createFixedInstance = (locale: string): I18nInstance => {
    const instance = createInstance();
    void instance
        .use(initReactI18next)
        .init({
            lng: locale,
            fallbackLng: DEFAULT_LOCALE,
            supportedLngs: SUPPORTED_LOCALES,
            nonExplicitSupportedLngs: false,
            defaultNS: 'common',
            ns: [],
            resources: {},
            initImmediate: false,
            interpolation: {
                prefix: '{',
                suffix: '}',
                escapeValue: false,
                defaultVariables: {
                    appName: APP_NAME,
                },
            },
            react: {
                useSuspense: false,
            },
        });
    return instance;
};

export const getFixedLocaleInstance = (
    locale: string,
    resources: LocaleResources
): I18nInstance => {
    let instance = instances.get(locale);
    if (!instance) {
        instance = createFixedInstance(locale);
        instances.set(locale, instance);
    }
    for (const [namespace, bundle] of Object.entries(resources)) {
        if (!instance.hasResourceBundle(locale, namespace)) {
            instance.addResourceBundle(locale, namespace, bundle, true, false);
        }
    }
    return instance;
};
