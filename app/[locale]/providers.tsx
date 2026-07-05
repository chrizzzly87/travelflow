'use client';

import React from 'react';
import App from '../../App';
import { NextRouterAdapter } from '../../lib/router/NextRouterAdapter';
import { I18nProvider } from '../../components/providers/I18nProvider';
import type { LocaleResources } from '../../lib/i18n/resources';

interface AppProvidersProps {
    locale: string;
    resources: LocaleResources;
    children: React.ReactNode;
}

/**
 * Client provider stack for every route: router compat adapter, i18n bridge
 * (shell namespaces), and the app shell (auth, dialogs, toasts, terms gate,
 * cookie consent, trip manager).
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ locale, resources, children }) => (
    <NextRouterAdapter>
        <I18nProvider locale={locale} resources={resources}>
            <App>{children}</App>
        </I18nProvider>
    </NextRouterAdapter>
);
