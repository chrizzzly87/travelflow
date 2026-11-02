import { startTransition, useEffect } from 'react';
import type { i18n } from 'i18next';
import type { AppLanguage } from '../../types';
import { applyDocumentLocale, isLocale, normalizeLocale } from '../../config/locales';
import { extractLocaleFromPath, isToolRoute } from '../../config/routes';
import { getRouteNamespaces } from '../../app/routing/routeLocale';
import { preloadLocaleNamespaces } from '../../i18n';
import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

/** Synchronize the delivered i18n snapshot with the native route locale after hydration. */
export function useDocumentLocale(instance: i18n, routeLocale?: AppLanguage) {
    useEffect(() => {
        let active = true;
        const pathname = window.location.pathname;
        const initialLanguage = normalizeLocale(instance.resolvedLanguage ?? instance.language);
        const stored = readLocalStorageItem('tf_app_language');
        const storedPreference = isLocale(stored) ? stored : null;
        // Explicit URLs own their language. Unprefixed tools retain the saved
        // preference even when their server document was delivered in English.
        const preferred = extractLocaleFromPath(pathname)
            ?? (isToolRoute(pathname) ? storedPreference : null)
            ?? routeLocale;
        const restorePreference = preferred && preferred !== initialLanguage;
        const apply = (language: string) => {
            const normalized = normalizeLocale(language);
            applyDocumentLocale(normalized);
            writeLocalStorageItem('tf_app_language', normalized);
        };
        applyDocumentLocale(routeLocale ?? initialLanguage);
        instance.on('languageChanged', apply);
        if (restorePreference) {
            void preloadLocaleNamespaces(preferred, getRouteNamespaces(pathname), instance).then(() => {
                // A newer selection/navigation owns the document if it arrived
                // while the saved preference's resources were loading.
                if (!active || window.location.pathname !== pathname
                    || readLocalStorageItem('tf_app_language') !== stored
                    || normalizeLocale(instance.resolvedLanguage ?? instance.language) !== initialLanguage) return;
                startTransition(() => { void instance.changeLanguage(preferred); });
            }).catch(() => { /* Keep the delivered language and saved preference if its download fails. */ });
        } else {
            writeLocalStorageItem('tf_app_language', initialLanguage);
        }
        return () => { active = false; instance.off('languageChanged', apply); };
    }, [instance, routeLocale]);
}
