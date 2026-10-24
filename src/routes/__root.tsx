import React, { startTransition, useEffect } from 'react';
import { createRootRouteWithContext, HeadContent, lazyRouteComponent, Scripts, useRouter } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { preloadLocaleNamespaces } from '../../i18n';
import i18n from '../../i18n';
import { localeToDir, normalizeLocale } from '../../config/locales';
import { offlineShellMaskPath } from '../../app/routing/publicPrerender';
import { getRouteNamespaces } from '../../app/routing/routeLocale';
import ApplicationShell from '../../app/shell/ApplicationShell';
import { bootScripts } from '../documentAssets';
import { buildRouteDocument, resolveRouteDocument } from '../document/routeDocument';
import { readLocalStorageItem } from '../../services/browserStorageService';
import { getTripDocumentMetadata } from '../server/tripMetadata';
import { shouldResolveTripMetadata } from '../document/tripMetadataPolicy';
import { privateDocumentCacheHeaders } from '../../app/routing/cachePolicy';
import '../../index.css';
import '../document/consent.css';
import { ContactFormRegistration } from '../document/ContactFormRegistration';
import { getDocumentHints } from '../document/headAssets';
import { useDocumentLocale } from '../document/useDocumentLocale';
import { ThemeColor } from '../document/ThemeColor';
import { tripVideoMetadata } from '../../shared/tripOgVideo';
import { RenderClockProvider } from '../../hooks/useRenderNow';

export const Route = createRootRouteWithContext<{ i18n: typeof i18n; hydrationI18n?: typeof i18n; renderedAt?: number }>()({
    // Native context is reconstructed on hydration but cached when the root is
    // reused. Its URL snapshot is only for the server's neutral SPA mask.
    context: ({ location }) => ({ hydrationDocument: buildRouteDocument(location.href, readLocalStorageItem('tf_app_language')) }),
    beforeLoad: async ({ context, location, preload, abortController }) => {
        const routeDocument = buildRouteDocument(location.href, readLocalStorageItem('tf_app_language'));
        const { locale } = routeDocument;
        await preloadLocaleNamespaces(locale, getRouteNamespaces(location.pathname), context.i18n);
        abortController.signal.throwIfAborted();
        if (!preload && context.i18n.resolvedLanguage !== locale) {
            // i18next notifies existing React subscribers synchronously. A route
            // language change must not interrupt a still-hydrating page boundary.
            let languageChange: ReturnType<typeof context.i18n.changeLanguage> | undefined;
            startTransition(() => { languageChange = context.i18n.changeLanguage(locale); });
            await languageChange;
        }
        if (shouldResolveTripMetadata(location.pathname)) {
            try {
                const trip = await getTripDocumentMetadata({ data: `${location.pathname}${location.searchStr}` });
                if (trip) return { routeDocument, tripMetadata: trip };
            } catch { /* Metadata must not block offline trip access. */ }
        }
        return { routeDocument, tripMetadata: null };
    },
    head: ({ match }) => {
        // The first hydration head must match its transported document. React
        // does not guarantee suppressed attribute patches; native invalidation
        // below resolves the actual URL after the neutral shell has hydrated.
        const { metadata, locale, pathname } = match.context.routeDocument ?? match.context.hydrationDocument;
        const { tripMetadata } = match.context;
        const meta = tripMetadata
            ? { ...metadata, ...tripMetadata, ogTitle: tripMetadata.pageTitle, ogDescription: tripMetadata.description }
            : metadata;
        const tripMediaMeta = tripMetadata ? [
            { property: 'og:image:width', content: String(tripMetadata.imageDimensions?.width ?? 1200) },
            { property: 'og:image:height', content: String(tripMetadata.imageDimensions?.height ?? 630) },
            ...tripVideoMetadata(tripMetadata.ogVideoUrl, tripMetadata.videoDimensions),
        ] : [];
        return {
            meta: [{ title: meta.pageTitle }, { name: 'content-language', content: locale }, { name: 'description', content: meta.description }, { name: 'robots', content: meta.robots }, { property: 'og:title', content: meta.ogTitle }, { property: 'og:description', content: meta.ogDescription }, { property: 'og:image', content: meta.ogImageUrl }, ...tripMediaMeta, { property: 'og:url', content: meta.canonicalUrl }, { name: 'twitter:card', content: 'summary_large_image' }, { name: 'apple-mobile-web-app-capable', content: 'yes' }, { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }, { name: 'apple-mobile-web-app-title', content: 'TravelFlow' }],
            links: [{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }, { rel: 'manifest', href: '/manifest.webmanifest' }, { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, { rel: 'canonical', href: meta.canonicalUrl }, ...meta.alternateLinks.map(link => ({ rel: 'alternate', hrefLang: link.hreflang, href: link.href })), ...getDocumentHints(pathname)],
        };
    },
    headers: () => ({ 'x-tf-renderer': 'tanstack-start', ...privateDocumentCacheHeaders }),
    component: RootDocument,
    notFoundComponent: lazyRouteComponent(() => import('../../pages/NotFoundPage'), 'NotFoundPage'),
});
function RootDocument() {
    const router = useRouter();
    const context = Route.useRouteContext();
    const { locale } = resolveRouteDocument(context);
    useDocumentLocale(router.options.context.i18n, locale);
    const masked = context.routeDocument?.pathname === offlineShellMaskPath;
    useEffect(() => {
        if (masked) void router.invalidate({ filter: match => match.routeId === '__root__' }).catch(() => {
            // A later navigation can cancel recovery; its own beforeLoad owns metadata.
        });
    }, [router, masked]);
    return <html lang={locale} dir={localeToDir(normalizeLocale(locale))} suppressHydrationWarning>
        <head>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <ThemeColor />
            {bootScripts.map(({ id, code, attributes }) => <script {...attributes} key={id} dangerouslySetInnerHTML={{ __html: code }} />)}
            <HeadContent />
        </head>
        <body><ContactFormRegistration /><I18nextProvider i18n={router.options.context.i18n}><RenderClockProvider renderedAt={router.options.context.renderedAt}><div id="root" data-tf-prerendered-root="true"><ApplicationShell /></div></RenderClockProvider></I18nextProvider><Scripts /></body>
    </html>;
}
