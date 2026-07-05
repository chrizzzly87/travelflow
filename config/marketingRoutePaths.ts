// Canonical list of marketing route paths (locale-unprefixed). The App Router
// tree under app/[locale]/(marketing)/ mirrors this list 1:1; the sitemap
// generator (scripts/generate-sitemap.mjs) parses it textually — keep the
// literal array shape (path: '...') intact.
export interface MarketingRouteConfig {
    path: string;
}

const MARKETING_ROUTE_CONFIGS: MarketingRouteConfig[] = [
    { path: '/' },
    { path: '/features' },
    { path: '/inspirations' },
    { path: '/inspirations/themes' },
    { path: '/inspirations/best-time-to-travel' },
    { path: '/inspirations/countries' },
    { path: '/inspirations/events-and-festivals' },
    { path: '/inspirations/weekend-getaways' },
    { path: '/inspirations/country/:countryName' },
    { path: '/updates' },
    { path: '/blog' },
    { path: '/blog/:slug' },
    { path: '/pricing' },
    { path: '/faq' },
    { path: '/share-unavailable' },
    { path: '/login' },
    { path: '/auth/reset-password' },
    { path: '/contact' },
    { path: '/imprint' },
    { path: '/privacy' },
    { path: '/terms' },
    { path: '/cookies' },
];

export const MARKETING_ROUTE_PATHS: string[] = MARKETING_ROUTE_CONFIGS.map((route) => route.path);
