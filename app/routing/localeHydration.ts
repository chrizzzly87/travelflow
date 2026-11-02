import type { i18n, Resource } from 'i18next';
import { DEFAULT_LOCALE, normalizeLocale } from '../../config/locales';

export interface LocaleHydrationSnapshot {
    language: string;
    resources: Resource;
}

/** Copy only the request's active language/fallback and already loaded namespaces. */
export function getLocaleHydrationSnapshot(instance: i18n): LocaleHydrationSnapshot {
    const language = normalizeLocale(instance.resolvedLanguage ?? instance.language);
    const resources: Resource = {};
    for (const locale of new Set([language, DEFAULT_LOCALE])) {
        const loaded = instance.getDataByLanguage(locale);
        if (loaded) resources[locale] = JSON.parse(JSON.stringify(loaded));
    }
    return { language, resources };
}

/** Native router hydration restores resources before its first React render. */
export async function restoreLocaleHydrationSnapshot(snapshot: LocaleHydrationSnapshot | undefined, instance: i18n): Promise<void> {
    if (!snapshot) return;
    for (const [language, namespaces] of Object.entries(snapshot.resources)) {
        for (const [namespace, resources] of Object.entries(namespaces)) {
            instance.addResourceBundle(language, namespace, resources, true, true);
        }
    }
    await instance.changeLanguage(snapshot.language);
}
