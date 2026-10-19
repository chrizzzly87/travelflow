import { startTransition, useEffect } from 'react';
import type { i18n } from 'i18next';
import { applyDocumentLocale, isLocale, normalizeLocale } from '../../config/locales';
import { extractLocaleFromPath, isToolRoute } from '../../config/routes';
import { getRouteNamespaces } from '../../app/routing/routeLocale';
import { preloadLocaleNamespaces } from '../../i18n';
import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

/** Document hydration owns its initial language; browser preferences follow after mount. */
export function useDocumentLocale(instance: i18n) {
    useEffect(() => {
        let active = true;
        const pathname = window.location.pathname;
        const initialLanguage = normalizeLocale(instance.resolvedLanguage ?? instance.language);
        const stored = readLocalStorageItem('tf_app_language');
        const preferred = isLocale(stored) ? stored : null;
        const restorePreference = isToolRoute(pathname) && !extractLocaleFromPath(pathname)
            && preferred && preferred !== initialLanguage;
        const apply = (language: string) => {
            const normalized = normalizeLocale(language);
            applyDocumentLocale(normalized);
            writeLocalStorageItem('tf_app_language', normalized);
        };
        applyDocumentLocale(initialLanguage);
        instance.on('languageChanged', apply);
        if (restorePreference) {
            void preloadLocaleNamespaces(preferred, getRouteNamespaces(pathname), instance).then(() => {
                // A newer selection/navigation owns the document if it arrived
                // while the saved preference's resources were loading.
                if (!active || window.location.pathname !== pathname
                    || readLocalStorageItem('tf_app_language') !== preferred
                    || normalizeLocale(instance.resolvedLanguage ?? instance.language) !== initialLanguage) return;
                startTransition(() => { void instance.changeLanguage(preferred); });
            }).catch(() => { /* Keep the delivered language and saved preference if its download fails. */ });
        } else {
            writeLocalStorageItem('tf_app_language', initialLanguage);
        }
        return () => { active = false; instance.off('languageChanged', apply); };
    }, [instance]);
}
