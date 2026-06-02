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
const deferredAppRoutesTarget = target('route:deferred-app-routes', () => import('../app/routes/DeferredAppRoutes'));

const createTripClassicLabTarget = target('route:create-trip-lab-classic', () => import('../pages/CreateTripClassicLabPage'));
const createTripWizardTarget = target('route:create-trip-wizard', () => import('../pages/CreateTripV3Page'));
const checkoutTarget = target('route:checkout', () => import('../pages/CheckoutPage'));

const shareUnavailableTarget = target('route:share-unavailable', () => import('../pages/ShareUnavailablePage'));
const loginTarget = target('route:login', () => import('../pages/LoginPage'));
const resetPasswordTarget = target('route:reset-password', () => import('../pages/ResetPasswordPage'));
const profileTarget = target('route:profile', () => import('../pages/ProfilePage'));
const profileSettingsTarget = target('route:profile-settings', () => import('../pages/ProfileSettingsPage'));
const profileOnboardingTarget = target('route:profile-onboarding', () => import('../pages/ProfileOnboardingPage'));

const rules: PrefetchRule[] = [
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

    return [];
};
