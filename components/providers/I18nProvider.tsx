'use client';

import React, { useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18nSingleton from '../../i18n';
import { getFixedLocaleInstance } from '../../lib/i18n/fixedInstances';
import type { LocaleResources } from '../../lib/i18n/resources';

interface I18nProviderProps {
    locale: string;
    resources: LocaleResources;
    children: React.ReactNode;
}

/**
 * Bridges server-loaded translations into i18next so server-rendered HTML
 * contains final strings and the client hydrates identically.
 *
 * - Server render: a fixed-language instance per locale (never mutated, so
 *   concurrent SSR of different locales cannot race).
 * - Client render: the app singleton from i18n.ts (runtime language switching
 *   keeps working exactly as before). The resources that rendered the server
 *   HTML are injected synchronously before children render, so nothing
 *   suspends on i18n during hydration — the failure class from the 2026-07
 *   postmortem. The singleton's initial language detection prefers the URL /
 *   <html lang>, so it always equals `locale` here at hydration time.
 *
 * Nested providers are cheap: they resolve to the same instances and just add
 * route-specific namespaces (delivered via the RSC payload on navigation).
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ locale, resources, children }) => {
    const instance = useMemo(() => {
        if (typeof window === 'undefined') {
            return getFixedLocaleInstance(locale, resources);
        }
        for (const [namespace, bundle] of Object.entries(resources)) {
            if (!i18nSingleton.hasResourceBundle(locale, namespace)) {
                i18nSingleton.addResourceBundle(locale, namespace, bundle, true, false);
            }
        }
        return i18nSingleton;
    }, [locale, resources]);

    return (
        <I18nextProvider i18n={instance}>
            {children}
        </I18nextProvider>
    );
};
