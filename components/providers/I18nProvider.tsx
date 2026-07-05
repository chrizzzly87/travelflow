'use client';

import React, { useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { getFixedLocaleInstance } from '../../lib/i18n/fixedInstances';
import type { LocaleResources } from '../../lib/i18n/resources';

interface I18nProviderProps {
    locale: string;
    resources: LocaleResources;
    children: React.ReactNode;
}

/**
 * Provides a fixed-locale i18next instance preloaded with the server-loaded
 * resources, so server-rendered HTML contains final translated strings and
 * hydration renders identically (no suspend-on-i18n, no two-pass text).
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ locale, resources, children }) => {
    const instance = useMemo(() => getFixedLocaleInstance(locale, resources), [locale, resources]);

    return (
        <I18nextProvider i18n={instance}>
            {children}
        </I18nextProvider>
    );
};
