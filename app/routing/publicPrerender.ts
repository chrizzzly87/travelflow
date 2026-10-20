import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../../config/locales';

/** Deliberate public entry points only. Do not discover private/session routes
 * by crawling links or by expanding the native account route tree. */
const publicEntryPaths = ['/', '/features', '/pricing', '/faq', '/blog', '/updates', '/inspirations'] as const;
export const publicPrerenderPaths = SUPPORTED_LOCALES.flatMap(locale => publicEntryPaths.map(path => (
    locale === DEFAULT_LOCALE ? path : `/${locale}${path === '/' ? '' : path}`
)));
