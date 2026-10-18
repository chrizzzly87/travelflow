import { useEffect } from 'react';
import type { i18n } from 'i18next';
import { applyDocumentLocale, normalizeLocale } from '../../config/locales';

/** Browser preferences can change language on workspaces whose canonical URL is unprefixed. */
export function useDocumentLocale(instance: i18n) {
    useEffect(() => {
        const apply = (language: string) => applyDocumentLocale(normalizeLocale(language));
        apply(instance.resolvedLanguage ?? instance.language);
        instance.on('languageChanged', apply);
        return () => { instance.off('languageChanged', apply); };
    }, [instance]);
}
