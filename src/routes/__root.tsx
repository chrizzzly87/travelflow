import React, { startTransition } from 'react';
import { createRootRouteWithContext, HeadContent, lazyRouteComponent, Scripts, useRouter } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { preloadLocaleNamespaces } from '../../i18n';
import i18n from '../../i18n';
import { extractLocaleFromPath, isToolRoute, stripLocalePrefix } from '../../config/routes';
import { DEFAULT_LOCALE, localeToDir, normalizeLocale } from '../../config/locales';
import { getRouteLocale, getRouteNamespaces } from '../../app/routing/routeLocale';
import ApplicationShell from '../../app/shell/ApplicationShell';
import { bootScripts } from '../documentAssets';
import { buildSiteOgMetadata } from '../../netlify/edge-lib/site-og-metadata';
import { getTripDocumentMetadata } from '../server/tripMetadata';
import '../../index.css';
import '../document/consent.css';
import { ContactFormRegistration } from '../document/ContactFormRegistration';
import { getDocumentHints } from '../document/headAssets';
import { useDocumentLocale } from '../document/useDocumentLocale';

export const Route = createRootRouteWithContext<{ i18n: typeof i18n }>()({
    beforeLoad: async ({ context, location, preload, abortController }) => {
        let storedLocale = DEFAULT_LOCALE;
        try { if (typeof window !== 'undefined') storedLocale = normalizeLocale(window.localStorage.getItem('tf_app_language')); } catch { /* Storage may be unavailable. */ }
        const locale = getRouteLocale(location.pathname, storedLocale);
        await preloadLocaleNamespaces(locale, getRouteNamespaces(location.pathname), context.i18n);
        abortController.signal.throwIfAborted();
        if (!preload && context.i18n.resolvedLanguage !== locale) {
            // i18next notifies existing React subscribers synchronously. A route
            // language change must not interrupt a still-hydrating page boundary.
            let languageChange: ReturnType<typeof context.i18n.changeLanguage> | undefined;
            startTransition(() => { languageChange = context.i18n.changeLanguage(locale); });
            await languageChange;
        }
        const metadata = buildSiteOgMetadata(new URL(location.href, 'https://travelflowapp.netlify.app'));
        if (/^\/(?:trip|s)\//.test(location.pathname)) {
            try {
                const trip = await getTripDocumentMetadata({ data: `${location.pathname}${location.searchStr}` });
                if (trip) return { locale, metadata: { ...metadata, ...trip, ogTitle: trip.pageTitle, ogDescription: trip.description } };
            } catch { /* Metadata must not block offline trip access. */ }
        }
        return { locale, metadata };
    },
    head: ({ match }) => {
        const meta = match.context.metadata;
        return {
            meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { title: meta.pageTitle }, { name: 'content-language', content: match.context.locale }, { name: 'description', content: meta.description }, { name: 'robots', content: meta.robots }, { property: 'og:title', content: meta.ogTitle }, { property: 'og:description', content: meta.ogDescription }, { property: 'og:image', content: meta.ogImageUrl }, { property: 'og:url', content: meta.canonicalUrl }, { name: 'twitter:card', content: 'summary_large_image' }, { name: 'apple-mobile-web-app-capable', content: 'yes' }, { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }, { name: 'apple-mobile-web-app-title', content: 'TravelFlow' }, { name: 'theme-color', content: '#ffffff', 'data-tf-theme-color': '' }],
            links: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }, { rel: 'manifest', href: '/manifest.webmanifest' }, { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, { rel: 'canonical', href: meta.canonicalUrl }, ...meta.alternateLinks.map(link => ({ rel: 'alternate', hrefLang: link.hreflang, href: link.href })), ...getDocumentHints(match.pathname)],
        };
    },
    headers: () => ({ 'x-tf-renderer': 'tanstack-start', 'cache-control': 'no-store' }),
    component: RootDocument,
    notFoundComponent: lazyRouteComponent(() => import('../../pages/NotFoundPage'), 'NotFoundPage'),
});
function RootDocument() {
    const router = useRouter();
    const { locale } = Route.useRouteContext();
    useDocumentLocale(router.options.context.i18n);
    return <html lang={locale} dir={localeToDir(normalizeLocale(locale))} suppressHydrationWarning>
        <head><HeadContent />
            {bootScripts.map(({ id, code, attributes }) => <script {...attributes} key={id} dangerouslySetInnerHTML={{ __html: code }} />)}
        </head>
        <body><ContactFormRegistration /><I18nextProvider i18n={router.options.context.i18n}><div id="root" data-tf-prerendered-root="true"><ApplicationShell /></div></I18nextProvider><Scripts /></body>
    </html>;
}
