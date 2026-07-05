import { DEFAULT_LOCALE, isLocale } from '../../config/locales';

export type LocaleNamespaceBundle = Record<string, unknown>;
export type LocaleResources = Record<string, LocaleNamespaceBundle>;

const importNamespace = async (
    language: string,
    namespace: string
): Promise<LocaleNamespaceBundle | null> => {
    try {
        const module = await import(`../../locales/${language}/${namespace}.json`);
        return (module as { default: LocaleNamespaceBundle }).default;
    } catch {
        return null;
    }
};

/**
 * Loads one locale namespace, falling back to the default locale. Works in
 * every runtime this repo has (Next server, Next client bundles, Vitest):
 * bundlers turn the templated import into a lazy per-JSON chunk context.
 */
export const loadLocaleNamespace = async (
    language: string,
    namespace: string
): Promise<LocaleNamespaceBundle> => {
    const normalizedLanguage = isLocale(language) ? language : DEFAULT_LOCALE;

    const preferred = await importNamespace(normalizedLanguage, namespace);
    if (preferred) return preferred;

    if (normalizedLanguage !== DEFAULT_LOCALE) {
        const fallback = await importNamespace(DEFAULT_LOCALE, namespace);
        if (fallback) return fallback;
    }

    return {};
};

export const loadLocaleResources = async (
    language: string,
    namespaces: readonly string[]
): Promise<LocaleResources> => {
    const uniqueNamespaces = Array.from(new Set(namespaces.filter(Boolean)));
    const entries = await Promise.all(uniqueNamespaces.map(async (namespace) => (
        [namespace, await loadLocaleNamespace(language, namespace)] as const
    )));
    return Object.fromEntries(entries);
};
