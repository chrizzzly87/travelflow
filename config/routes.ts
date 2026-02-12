import { AppLanguage } from '../types';
import { DEFAULT_LOCALE, isLocale } from './locales';

export type RouteKey =
    | 'home'
    | 'features'
    | 'inspirations'
    | 'inspirationsThemes'
    | 'inspirationsBestTime'
    | 'inspirationsCountries'
    | 'inspirationsFestivals'
    | 'inspirationsWeekendGetaways'
    | 'inspirationsCountryDetail'
    | 'updates'
    | 'blog'
    | 'blogPost'
    | 'pricing'
    | 'faq'
    | 'shareUnavailable'
    | 'login'
    | 'contact'
    | 'imprint'
    | 'privacy'
    | 'terms'
    | 'cookies'
    | 'createTrip'
    | 'createTripClassicLab'
    | 'createTripSplitWorkspaceLab'
    | 'createTripJourneyArchitectLab'
    | 'tripDetail'
    | 'tripLegacy'
    | 'exampleTrip'
    | 'shareTrip'
    | 'adminDashboard'
    | 'adminAiBenchmark';

type RouteParamsByKey = {
    inspirationsCountryDetail: { countryName: string };
    blogPost: { slug: string };
    tripDetail: { tripId: string };
    exampleTrip: { templateId: string };
    shareTrip: { token: string };
};

const encodeSegment = (value: string): string => encodeURIComponent(value);

const MARKETING_PATH_PATTERNS: RegExp[] = [
    /^\/$/,
    /^\/features$/,
    /^\/inspirations$/,
    /^\/inspirations\/themes$/,
    /^\/inspirations\/best-time-to-travel$/,
    /^\/inspirations\/countries$/,
    /^\/inspirations\/events-and-festivals$/,
    /^\/inspirations\/weekend-getaways$/,
    /^\/inspirations\/country\/[^/]+$/,
    /^\/updates$/,
    /^\/blog$/,
    /^\/blog\/[^/]+$/,
    /^\/pricing$/,
    /^\/faq$/,
    /^\/share-unavailable$/,
    /^\/login$/,
    /^\/contact$/,
    /^\/imprint$/,
    /^\/privacy$/,
    /^\/terms$/,
    /^\/cookies$/,
];

const TOOL_ROUTE_PREFIXES = ['/create-trip', '/trip', '/s', '/example', '/admin', '/api'];

export const LOCALIZED_MARKETING_ROUTE_KEYS: RouteKey[] = [
    'home',
    'features',
    'inspirations',
    'inspirationsThemes',
    'inspirationsBestTime',
    'inspirationsCountries',
    'inspirationsFestivals',
    'inspirationsWeekendGetaways',
    'inspirationsCountryDetail',
    'updates',
    'blog',
    'blogPost',
    'pricing',
    'faq',
    'shareUnavailable',
    'login',
    'contact',
    'imprint',
    'privacy',
    'terms',
    'cookies',
];

const LOCALIZED_MARKETING_ROUTE_KEY_SET = new Set<RouteKey>(LOCALIZED_MARKETING_ROUTE_KEYS);

export const isLocalizedMarketingRouteKey = (routeKey: RouteKey): boolean =>
    LOCALIZED_MARKETING_ROUTE_KEY_SET.has(routeKey);

export const buildPath = <K extends RouteKey>(
    routeKey: K,
    params?: K extends keyof RouteParamsByKey ? RouteParamsByKey[K] : never
): string => {
    switch (routeKey) {
        case 'home':
            return '/';
        case 'features':
            return '/features';
        case 'inspirations':
            return '/inspirations';
        case 'inspirationsThemes':
            return '/inspirations/themes';
        case 'inspirationsBestTime':
            return '/inspirations/best-time-to-travel';
        case 'inspirationsCountries':
            return '/inspirations/countries';
        case 'inspirationsFestivals':
            return '/inspirations/events-and-festivals';
        case 'inspirationsWeekendGetaways':
            return '/inspirations/weekend-getaways';
        case 'inspirationsCountryDetail':
            return `/inspirations/country/${encodeSegment((params as RouteParamsByKey['inspirationsCountryDetail']).countryName)}`;
        case 'updates':
            return '/updates';
        case 'blog':
            return '/blog';
        case 'blogPost':
            return `/blog/${encodeSegment((params as RouteParamsByKey['blogPost']).slug)}`;
        case 'pricing':
            return '/pricing';
        case 'faq':
            return '/faq';
        case 'shareUnavailable':
            return '/share-unavailable';
        case 'login':
            return '/login';
        case 'contact':
            return '/contact';
        case 'imprint':
            return '/imprint';
        case 'privacy':
            return '/privacy';
        case 'terms':
            return '/terms';
        case 'cookies':
            return '/cookies';
        case 'createTrip':
            return '/create-trip';
        case 'createTripClassicLab':
            return '/create-trip/labs/classic-card';
        case 'createTripSplitWorkspaceLab':
            return '/create-trip/labs/split-workspace';
        case 'createTripJourneyArchitectLab':
            return '/create-trip/labs/journey-architect';
        case 'tripDetail':
            return `/trip/${encodeSegment((params as RouteParamsByKey['tripDetail']).tripId)}`;
        case 'tripLegacy':
            return '/trip';
        case 'exampleTrip':
            return `/example/${encodeSegment((params as RouteParamsByKey['exampleTrip']).templateId)}`;
        case 'shareTrip':
            return `/s/${encodeSegment((params as RouteParamsByKey['shareTrip']).token)}`;
        case 'adminDashboard':
            return '/admin/dashboard';
        case 'adminAiBenchmark':
            return '/admin/ai-benchmark';
        default:
            return '/';
    }
};

export const buildLocalizedMarketingPath = <K extends RouteKey>(
    routeKey: K,
    locale: AppLanguage,
    params?: K extends keyof RouteParamsByKey ? RouteParamsByKey[K] : never
): string => {
    const path = buildPath(routeKey, params as never);
    if (!isLocalizedMarketingRouteKey(routeKey) || locale === DEFAULT_LOCALE) {
        return path;
    }
    return path === '/' ? `/${locale}` : `/${locale}${path}`;
};

export const extractLocaleFromPath = (pathname: string): AppLanguage | null => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const maybeLocale = segments[0];
    return isLocale(maybeLocale) ? maybeLocale : null;
};

export const stripLocalePrefix = (pathname: string): string => {
    const locale = extractLocaleFromPath(pathname);
    if (!locale) return pathname || '/';
    const stripped = pathname.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/';
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
};

const matchesPrefix = (pathname: string, prefix: string): boolean => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

export const isToolRoute = (pathname: string): boolean => {
    const stripped = stripLocalePrefix(pathname);
    return TOOL_ROUTE_PREFIXES.some((prefix) => matchesPrefix(stripped, prefix));
};

export const isLocalizedMarketingPath = (pathname: string): boolean => {
    if (!pathname) return false;
    const stripped = stripLocalePrefix(pathname);
    if (isToolRoute(stripped)) return false;
    return MARKETING_PATH_PATTERNS.some((pattern) => pattern.test(stripped));
};

export const localizeMarketingPath = (pathname: string, locale: AppLanguage): string => {
    const stripped = stripLocalePrefix(pathname) || '/';
    if (!isLocalizedMarketingPath(stripped)) {
        return buildLocalizedMarketingPath('home', locale);
    }
    if (locale === DEFAULT_LOCALE) {
        return stripped;
    }
    return stripped === '/' ? `/${locale}` : `/${locale}${stripped}`;
};

export const getBlogSlugFromPath = (pathname: string): string | null => {
    const stripped = stripLocalePrefix(pathname);
    const match = stripped.match(/^\/blog\/([^/]+)\/?$/);
    return match?.[1] ?? null;
};
