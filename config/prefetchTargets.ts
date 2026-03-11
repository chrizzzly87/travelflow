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
const deferredAppRoutesTarget = target('route:deferred-app-routes', () => import('../app/routes/DeferredAppRoutes'));

const createTripClassicLabTarget = target('route:create-trip-lab-classic', () => import('../pages/CreateTripClassicLabPage'));
const createTripWizardTarget = target('route:create-trip-wizard', () => import('../pages/CreateTripV3Page'));
const checkoutTarget = target('route:checkout', () => import('../pages/CheckoutPage'));

const featuresTarget = target('route:features', () => import('../pages/FeaturesPage'));
const updatesTarget = target('route:updates', () => import('../pages/UpdatesPage'));
const pricingTarget = target('route:pricing', () => import('../pages/PricingPage'));
const faqTarget = target('route:faq', () => import('../pages/FaqPage'));
const shareUnavailableTarget = target('route:share-unavailable', () => import('../pages/ShareUnavailablePage'));
const loginTarget = target('route:login', () => import('../pages/LoginPage'));
const resetPasswordTarget = target('route:reset-password', () => import('../pages/ResetPasswordPage'));
const contactTarget = target('route:contact', () => import('../pages/ContactPage'));
const imprintTarget = target('route:imprint', () => import('../pages/ImprintPage'));
const privacyTarget = target('route:privacy', () => import('../pages/PrivacyPage'));
const termsTarget = target('route:terms', () => import('../pages/TermsPage'));
const cookiesTarget = target('route:cookies', () => import('../pages/CookiesPage'));
const profileTarget = target('route:profile', () => import('../pages/ProfilePage'));
const profileSettingsTarget = target('route:profile-settings', () => import('../pages/ProfileSettingsPage'));
const profileOnboardingTarget = target('route:profile-onboarding', () => import('../pages/ProfileOnboardingPage'));

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
        match: (pathname) => pathname === '/create-trip',
        targets: [createTripClassicLabTarget, tripViewTarget],
    },
    {
        match: (pathname) => pathname === '/create-trip/labs/classic-card',
        targets: [createTripClassicLabTarget, tripViewTarget],
    },
    {
        match: (pathname) => pathname === '/create-trip/wizard',
        targets: [createTripWizardTarget, tripViewTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/create-trip'),
        targets: [tripViewTarget],
    },
    {
        match: (pathname) => pathname === '/checkout',
        targets: [deferredAppRoutesTarget, checkoutTarget],
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
        targets: [deferredAppRoutesTarget, featuresTarget],
    },
    {
        match: (pathname) => pathname === '/updates',
        targets: [deferredAppRoutesTarget, updatesTarget],
    },
    {
        match: (pathname) => pathname === '/pricing',
        targets: [deferredAppRoutesTarget, pricingTarget],
    },
    {
        match: (pathname) => pathname === '/faq',
        targets: [deferredAppRoutesTarget, faqTarget],
    },
    {
        match: (pathname) => pathname === '/share-unavailable',
        targets: [deferredAppRoutesTarget, shareUnavailableTarget],
    },
    {
        match: (pathname) => pathname === '/login',
        targets: [deferredAppRoutesTarget, loginTarget],
    },
    {
        match: (pathname) => pathname === '/auth/reset-password',
        targets: [deferredAppRoutesTarget, resetPasswordTarget],
    },
    {
        match: (pathname) => pathname === '/contact',
        targets: [deferredAppRoutesTarget, contactTarget],
    },
    {
        match: (pathname) => pathname === '/imprint',
        targets: [deferredAppRoutesTarget, imprintTarget],
    },
    {
        match: (pathname) => pathname === '/privacy',
        targets: [deferredAppRoutesTarget, privacyTarget],
    },
    {
        match: (pathname) => pathname === '/terms',
        targets: [deferredAppRoutesTarget, termsTarget],
    },
    {
        match: (pathname) => pathname === '/cookies',
        targets: [deferredAppRoutesTarget, cookiesTarget],
    },
    {
        match: (pathname) => pathname === '/profile',
        targets: [deferredAppRoutesTarget, profileTarget],
    },
    {
        match: (pathname) => pathname === '/profile/settings',
        targets: [deferredAppRoutesTarget, profileSettingsTarget],
    },
    {
        match: (pathname) => pathname === '/profile/onboarding',
        targets: [deferredAppRoutesTarget, profileOnboardingTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations',
        targets: [deferredAppRoutesTarget, inspirationsTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/themes',
        targets: [deferredAppRoutesTarget, inspirationsThemesTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/best-time-to-travel',
        targets: [deferredAppRoutesTarget, inspirationsBestTimeTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/countries',
        targets: [deferredAppRoutesTarget, inspirationsCountriesTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/events-and-festivals',
        targets: [deferredAppRoutesTarget, inspirationsFestivalsTarget],
    },
    {
        match: (pathname) => pathname === '/inspirations/weekend-getaways',
        targets: [deferredAppRoutesTarget, inspirationsWeekendsTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/inspirations/country'),
        targets: [deferredAppRoutesTarget, inspirationsCountryDetailTarget],
    },
    {
        match: (pathname) => pathname === '/blog',
        targets: [deferredAppRoutesTarget, blogTarget],
    },
    {
        match: (pathname) => startsWithSegment(pathname, '/blog'),
        targets: [deferredAppRoutesTarget, blogPostTarget],
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
        return [];
    }

    if (startsWithSegment(normalizedPathname, '/create-trip')) {
        return [];
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
