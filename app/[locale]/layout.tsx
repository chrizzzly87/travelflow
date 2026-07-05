import '../../index.css';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    isLocale,
    localeToDir,
    localeToHtmlLang,
} from '../../config/locales';
import { APP_SHELL_NAMESPACES } from '../../lib/i18n/namespaces';
import { loadLocaleResources } from '../../lib/i18n/resources';
import type { AppLanguage } from '../../types';
import { AppProviders } from './providers';

export const generateStaticParams = () => SUPPORTED_LOCALES.map((locale) => ({ locale }));

const SITE_DESCRIPTION = 'Plan and share travel routes with timeline and map previews in TravelFlow.';

export const metadata: Metadata = {
    title: 'TravelFlow',
    description: SITE_DESCRIPTION,
    icons: {
        icon: [
            { url: '/favicon.svg', type: 'image/svg+xml' },
            { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
            { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
            { url: '/favicon.ico', sizes: 'any' },
        ],
        apple: '/apple-touch-icon.png',
    },
    openGraph: {
        type: 'website',
        siteName: 'TravelFlow',
        title: 'TravelFlow',
        description: SITE_DESCRIPTION,
        images: [{ url: '/api/og/site', width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'TravelFlow',
        description: SITE_DESCRIPTION,
        images: ['/api/og/site'],
    },
    other: {
        'view-transition': 'same-origin',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

// Per-locale font preloads, server-rendered so they start during HTML parse
// (replaces the inline JS injector from the SPA's index.html). Latin is the
// default set; Korean intentionally uses system fonts.
const FONT_PRELOADS: Partial<Record<AppLanguage, string[]>> = {
    ru: [
        '/fonts/noto-fallback/noto-sans-cyrillic.woff2',
        '/fonts/noto-fallback/noto-sans-cyrillic-ext.woff2',
    ],
    fa: [
        '/fonts/vazirmatn/vazirmatn-arabic-400-normal.woff2',
        '/fonts/vazirmatn/vazirmatn-arabic-700-normal.woff2',
        '/fonts/vazirmatn/vazirmatn-arabic-800-normal.woff2',
    ],
    ur: [
        '/fonts/vazirmatn/vazirmatn-arabic-400-normal.woff2',
        '/fonts/vazirmatn/vazirmatn-arabic-700-normal.woff2',
        '/fonts/vazirmatn/vazirmatn-arabic-800-normal.woff2',
    ],
    pl: [
        '/fonts/bricolage-grotesque/bricolage-grotesque-latin-ext.woff2',
        '/fonts/space-grotesk/space-grotesk-latin-ext.woff2',
    ],
};

const LATIN_FONT_PRELOADS = [
    '/fonts/bricolage-grotesque/bricolage-grotesque-latin.woff2',
    '/fonts/space-grotesk/space-grotesk-latin.woff2',
];

interface RootLayoutProps {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
    const { locale: rawLocale } = await params;
    if (!isLocale(rawLocale)) notFound();
    const locale: AppLanguage = rawLocale;

    const resources = await loadLocaleResources(locale, APP_SHELL_NAMESPACES);
    const fontPreloads = [...LATIN_FONT_PRELOADS, ...(FONT_PRELOADS[locale] ?? [])];

    return (
        <html lang={localeToHtmlLang(locale)} dir={localeToDir(locale)}>
            <body>
                {fontPreloads.map((href) => (
                    <link
                        key={href}
                        rel="preload"
                        href={href}
                        as="font"
                        type="font/woff2"
                        crossOrigin="anonymous"
                    />
                ))}
                <div id="root" data-tf-locale={locale} data-tf-default-locale={DEFAULT_LOCALE}>
                    <AppProviders locale={locale} resources={resources}>
                        {children}
                    </AppProviders>
                </div>
            </body>
        </html>
    );
}
