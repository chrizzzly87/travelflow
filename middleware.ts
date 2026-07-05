import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config/locales';

// URL scheme (unchanged from the SPA): the default locale (en) is served
// unprefixed (/features), all other locales are prefixed (/de/features).
// Internally every route lives under app/[locale]/, so unprefixed requests
// are rewritten (not redirected) to /en/..., and explicit /en/... URLs are
// permanently redirected to their canonical unprefixed form.

const NON_DEFAULT_LOCALES = new Set<string>(
    SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE)
);

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';

    if (firstSegment === DEFAULT_LOCALE) {
        const url = request.nextUrl.clone();
        url.pathname = pathname.slice(`/${DEFAULT_LOCALE}`.length) || '/';
        return NextResponse.redirect(url, 308);
    }

    if (NON_DEFAULT_LOCALES.has(firstSegment)) {
        return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
    return NextResponse.rewrite(url);
}

export const config = {
    // Skip Next internals, API routes (served by Netlify edge functions in
    // production), and anything that looks like a static file.
    matcher: ['/((?!_next/|api/|\\.netlify/|.*\\..*).*)'],
};
