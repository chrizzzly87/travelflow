import { stripLocalePrefix } from './routes';

export interface PrefetchTarget {
    key: string;
    load: () => Promise<unknown>;
}

interface PrefetchRule {
    match: (pathname: string) => boolean;
    targets: PrefetchTarget[];
}

const startsWithSegment = (pathname: string, prefix: string): boolean =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

const target = (key: string, load: () => Promise<unknown>): PrefetchTarget => ({ key, load });

const tripViewTarget = target('component:trip-view', () => import('../components/TripView'));
const exampleTemplatesTarget = target('data:example-trip-templates', () => import('../data/exampleTripTemplates'));
const exampleCardsTarget = target('data:example-trip-cards', () => import('../data/exampleTripCards'));
const homeTarget = target('route:home', () => import('../pages/MarketingHomePage'));

const createTripFormTarget = target('route:create-trip', () => import('../components/CreateTripForm'));
const createTripClassicLabTarget = target('route:create-trip-lab-classic', () => import('../pages/CreateTripClassicLabPage'));
const createTripSplitLabTarget = target('route:create-trip-lab-split', () => import('../pages/CreateTripSplitWorkspaceLabPage'));
const createTripArchitectLabTarget = target('route:create-trip-lab-architect', () => import('../pages/CreateTripJourneyArchitectLabPage'));

const featuresTarget = target('route:features', () => import('../pages/FeaturesPage'));
const updatesTarget = target('route:updates', () => import('../pages/UpdatesPage'));
const pricingTarget = target('route:pricing', () => import('../pages/PricingPage'));
const faqTarget = target('route:faq', () => import('../pages/FaqPage'));
const loginTarget = target('route:login', () => import('../pages/LoginPage'));
const contactTarget = target('route:contact', () => import('../pages/ContactPage'));
const imprintTarget = target('route:imprint', () => import('../pages/ImprintPage'));
const privacyTarget = target('route:privacy', () => import('../pages/PrivacyPage'));
const termsTarget = target('route:terms', () => import('../pages/TermsPage'));
const cookiesTarget = target('route:cookies', () => import('../pages/CookiesPage'));

const inspirationsTarget = target('route:inspirations', () => import('../pages/InspirationsPage'));
const inspirationsThemesTarget = target('route:inspirations-themes', () => import('../pages/inspirations/ThemesPage'));
const inspirationsBestTimeTarget = target('route:inspirations-best-time', () => import('../pages/inspirations/BestTimeToTravelPage'));
const inspirationsCountriesTarget = target('route:inspirations-countries', () => import('../pages/inspirations/CountriesPage'));
const inspirationsFestivalsTarget = target('route:inspirations-festivals', () => import('../pages/inspirations/FestivalsPage'));
const inspirationsWeekendsTarget = target('route:inspirations-weekends', () => import('../pages/inspirations/WeekendGetawaysPage'));
const inspirationsCountryDetailTarget = target('route:inspirations-country-detail', () => import('../pages/inspirations/CountryDetailPage'));

const blogTarget = target('route:blog', () => import('../pages/BlogPage'));
const blogPostTarget = target('route:blog-post', () => import('../pages/BlogPostPage'));

const rules: PrefetchRule[] = [
    {
        match: (pathname) => pathname === '/',
        targets: [homeTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/create-trip'),
        targets: [createTripFormTarget, tripViewTarget],
    },
    {
        match: (pathname) => pathname === '/create-trip/labs/classic-card',
        targets: [createTripClassicLabTarget, tripViewTarget],
    },
    {
        match: (pathname) => pathname === '/create-trip/labs/split-workspace',
        targets: [createTripSplitLabTarget, tripViewTarget],
    },
    {
        match: (pathname) => pathname === '/create-trip/labs/journey-architect',
        targets: [createTripArchitectLabTarget, tripViewTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/trip'),
        targets: [tripViewTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/example'),
        targets: [tripViewTarget, exampleTemplatesTarget, exampleCardsTarget],
    },
    {
        match: (pathname) => pathname === '/features',
        targets: [featuresTarget],
    },
    {
        match: (pathname) => pathname === '/updates',
        targets: [updatesTarget],
    },
    {
        match: (pathname) => pathname === '/pricing',
        targets: [pricingTarget],
    },
    {
        match: (pathname) => pathname === '/faq',
        targets: [faqTarget],
    },
    {
        match: (pathname) => pathname === '/login',
        targets: [loginTarget],
    },
    {
        match: (pathname) => pathname === '/contact',
        targets: [contactTarget],
    },
    {
        match: (pathname) => pathname === '/imprint',
        targets: [imprintTarget],
    },
    {
        match: (pathname) => pathname === '/privacy',
        targets: [privacyTarget],
    },
    {
        match: (pathname) => pathname === '/terms',
        targets: [termsTarget],
    },
    {
        match: (pathname) => pathname === '/cookies',
        targets: [cookiesTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations',
        targets: [inspirationsTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/themes',
        targets: [inspirationsThemesTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/best-time-to-travel',
        targets: [inspirationsBestTimeTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/countries',
        targets: [inspirationsCountriesTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/events-and-festivals',
        targets: [inspirationsFestivalsTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/weekend-getaways',
        targets: [inspirationsWeekendsTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/inspirations/country'),
        targets: [inspirationsCountryDetailTarget],
    },
    {
        match: (pathname) => pathname === '/blog',
        targets: [blogTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/blog'),
        targets: [blogPostTarget],
    },
];

export const resolvePrefetchTargets = (pathname: string): PrefetchTarget[] => {
    const normalizedPathname = stripLocalePrefix(pathname || '/');
    const matched: PrefetchTarget[] = [];
    const seen = new Set<string>();

    rules.forEach((rule) => {
        if (!rule.match(normalizedPathname)) return;
        rule.targets.forEach((candidate) => {
            if (seen.has(candidate.key)) return;
            seen.add(candidate.key);
            matched.push(candidate);
        });
    });

    return matched;
};

export const getIdleWarmupPaths = (pathname: string): string[] => {
    const normalizedPathname = stripLocalePrefix(pathname || '/');

    if (normalizedPathname === '/') {
        return ['/create-trip', '/example/__prefetch__'];
    }

    if (startsWithSegment(normalizedPathname, '/create-trip')) {
        return ['/trip/__prefetch__', '/example/__prefetch__'];
    }

    if (normalizedPathname === '/blog') {
        return [];
    }

    if (startsWithSegment(normalizedPathname, '/inspirations')) {
        return [];
    }

    if (
        normalizedPathname === '/features' ||
        normalizedPathname === '/pricing' ||
        normalizedPathname === '/updates'
    ) {
        return ['/create-trip', '/inspirations'];
    }

    return [];
};
