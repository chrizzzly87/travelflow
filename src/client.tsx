import React, { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { hydrateStart } from '@tanstack/react-start/client';
import { RouterProvider } from '@tanstack/react-router';
import i18n, { preloadLocaleNamespaces } from '../i18n';
import { getRouteLocale, getRouteNamespaces } from '../app/routing/routeLocale';
import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import { registerServiceWorker } from '../services/serviceWorkerRegistration';

async function hydrateApplication() {
    let storedLocale = DEFAULT_LOCALE;
    try { storedLocale = normalizeLocale(localStorage.getItem('tf_app_language')); } catch { /* Storage may be unavailable. */ }
    const locale = getRouteLocale(location.pathname, storedLocale);
    await preloadLocaleNamespaces(locale, getRouteNamespaces(location.pathname));
    await i18n.changeLanguage(locale);
    const router = await hydrateStart();
    startTransition(() => { hydrateRoot(document, <StrictMode><RouterProvider router={router} /></StrictMode>); });
    registerServiceWorker();
}
void hydrateApplication();
