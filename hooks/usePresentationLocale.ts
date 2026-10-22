import { createContext, useContext } from 'react';
import type { AppLanguage } from '../types';
import { normalizeLocale } from '../config/locales';
import { extractLocaleFromPath } from '../config/routes';

/** Only the initial pending chrome can present a transported document locale.
 * Actual route matching and action destinations always remain URL-owned. */
export const PendingDocumentLocaleContext = createContext<AppLanguage | null>(null);
export function usePresentationLocale(pathname: string, fallback?: string | null): AppLanguage {
    return useContext(PendingDocumentLocaleContext) ?? extractLocaleFromPath(pathname) ?? normalizeLocale(fallback);
}
