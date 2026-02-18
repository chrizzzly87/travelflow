import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, Suspense, lazy } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLanguage, ITrip, IViewSettings } from './types';
import { TripManagerProvider } from './contexts/TripManagerContext';
import { CookieConsentBanner } from './components/marketing/CookieConsentBanner';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry } from './services/historyService';
import { buildTripUrl, generateVersionId, getStoredAppLanguage, setStoredAppLanguage } from './utils';
import { DB_ENABLED } from './config/db';
import { isSimulatedLoggedIn, toggleSimulatedLogin } from './services/simulatedLoginService';
import { useDbSync } from './hooks/useDbSync';
import { AppDialogProvider } from './components/AppDialogProvider';
import { GlobalTooltipLayer } from './components/GlobalTooltipLayer';
import { initializeAnalytics, trackEvent, trackPageView } from './services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from './config/productLimits';
import { applyDocumentLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale } from './config/locales';
import { extractLocaleFromPath, isToolRoute, stripLocalePrefix } from './config/routes';
import { APP_NAME } from './config/appGlobals';
import { NavigationPrefetchManager } from './components/NavigationPrefetchManager';
import { SpeculationRulesManager } from './components/SpeculationRulesManager';
import { isNavPrefetchEnabled } from './services/navigationPrefetch';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { LoginModalProvider } from './contexts/LoginModalContext';
import { buildPathFromLocationParts, isLoginPathname, rememberAuthReturnPath } from './services/authNavigationService';
import {
    dbAdminOverrideTripCommit,
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbUpsertTrip,
    dbUpsertUserSettings,
    ensureDbSession,
} from './services/dbApi';
import { loadLazyComponentWithRecovery } from './services/lazyImportRecovery';

type AppDebugWindow = Window & typeof globalThis & {
    debug?: (command?: AppDebugCommand) => unknown;
    toggleSimulatedLogin?: (force?: boolean) => boolean;
    getSimulatedLoginState?: () => 'simulated_logged_in' | 'anonymous';
};

type AppDebugCommand =
    | boolean
    | {
        open?: boolean;
        tracking?: boolean;
        seo?: boolean;
        a11y?: boolean;
        simulatedLogin?: boolean;
    };

const DEBUG_AUTO_OPEN_STORAGE_KEY = 'tf_debug_auto_open';
const IS_DEV = Boolean((import.meta as any)?.env?.DEV);

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const CreateTripForm = lazyWithRecovery('CreateTripForm', () => import('./components/CreateTripForm').then((module) => ({ default: module.CreateTripForm })));
const TripManager = lazyWithRecovery('TripManager', () => import('./components/TripManager').then((module) => ({ default: module.TripManager })));
const SettingsModal = lazyWithRecovery('SettingsModal', () => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const OnPageDebugger = lazyWithRecovery('OnPageDebugger', () => import('./components/OnPageDebugger').then((module) => ({ default: module.OnPageDebugger })));
const MarketingHomePage = lazyWithRecovery('MarketingHomePage', () => import('./pages/MarketingHomePage').then((module) => ({ default: module.MarketingHomePage })));
const FeaturesPage = lazyWithRecovery('FeaturesPage', () => import('./pages/FeaturesPage').then((module) => ({ default: module.FeaturesPage })));
const UpdatesPage = lazyWithRecovery('UpdatesPage', () => import('./pages/UpdatesPage').then((module) => ({ default: module.UpdatesPage })));
const BlogPage = lazyWithRecovery('BlogPage', () => import('./pages/BlogPage').then((module) => ({ default: module.BlogPage })));
const BlogPostPage = lazyWithRecovery('BlogPostPage', () => import('./pages/BlogPostPage').then((module) => ({ default: module.BlogPostPage })));
const InspirationsPage = lazyWithRecovery('InspirationsPage', () => import('./pages/InspirationsPage').then((module) => ({ default: module.InspirationsPage })));
const ThemesPage = lazyWithRecovery('ThemesPage', () => import('./pages/inspirations/ThemesPage').then((module) => ({ default: module.ThemesPage })));
const BestTimeToTravelPage = lazyWithRecovery('BestTimeToTravelPage', () => import('./pages/inspirations/BestTimeToTravelPage').then((module) => ({ default: module.BestTimeToTravelPage })));
const CountriesPage = lazyWithRecovery('CountriesPage', () => import('./pages/inspirations/CountriesPage').then((module) => ({ default: module.CountriesPage })));
const FestivalsPage = lazyWithRecovery('FestivalsPage', () => import('./pages/inspirations/FestivalsPage').then((module) => ({ default: module.FestivalsPage })));
const WeekendGetawaysPage = lazyWithRecovery('WeekendGetawaysPage', () => import('./pages/inspirations/WeekendGetawaysPage').then((module) => ({ default: module.WeekendGetawaysPage })));
const CountryDetailPage = lazyWithRecovery('CountryDetailPage', () => import('./pages/inspirations/CountryDetailPage').then((module) => ({ default: module.CountryDetailPage })));
const LoginPage = lazyWithRecovery('LoginPage', () => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ResetPasswordPage = lazyWithRecovery('ResetPasswordPage', () => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const ContactPage = lazyWithRecovery('ContactPage', () => import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const ImprintPage = lazyWithRecovery('ImprintPage', () => import('./pages/ImprintPage').then((module) => ({ default: module.ImprintPage })));
const PrivacyPage = lazyWithRecovery('PrivacyPage', () => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazyWithRecovery('TermsPage', () => import('./pages/TermsPage').then((module) => ({ default: module.TermsPage })));
const CookiesPage = lazyWithRecovery('CookiesPage', () => import('./pages/CookiesPage').then((module) => ({ default: module.CookiesPage })));
const ProfilePage = lazyWithRecovery('ProfilePage', () => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const ProfileSettingsPage = lazyWithRecovery('ProfileSettingsPage', () => import('./pages/ProfileSettingsPage').then((module) => ({ default: module.ProfileSettingsPage })));
const ProfileOnboardingPage = lazyWithRecovery('ProfileOnboardingPage', () => import('./pages/ProfileOnboardingPage').then((module) => ({ default: module.ProfileOnboardingPage })));
const AdminWorkspaceRouter = lazyWithRecovery('AdminWorkspaceRouter', () => import('./pages/AdminWorkspaceRouter').then((module) => ({ default: module.AdminWorkspaceRouter })));
const PricingPage = lazyWithRecovery('PricingPage', () => import('./pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const FaqPage = lazyWithRecovery('FaqPage', () => import('./pages/FaqPage').then((module) => ({ default: module.FaqPage })));
const ShareUnavailablePage = lazyWithRecovery('ShareUnavailablePage', () => import('./pages/ShareUnavailablePage').then((module) => ({ default: module.ShareUnavailablePage })));
const NotFoundPage = lazyWithRecovery('NotFoundPage', () => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const TripLoaderRoute = lazyWithRecovery('TripLoaderRoute', () => import('./routes/TripRouteLoaders').then((module) => ({ default: module.TripLoaderRoute })));
const SharedTripLoaderRoute = lazyWithRecovery('SharedTripLoaderRoute', () => import('./routes/TripRouteLoaders').then((module) => ({ default: module.SharedTripLoaderRoute })));
const ExampleTripLoaderRoute = lazyWithRecovery('ExampleTripLoaderRoute', () => import('./routes/TripRouteLoaders').then((module) => ({ default: module.ExampleTripLoaderRoute })));
const CreateTripClassicLabPage = lazyWithRecovery('CreateTripClassicLabPage', () => import('./pages/CreateTripClassicLabPage').then((module) => ({ default: module.CreateTripClassicLabPage })));
const CreateTripSplitWorkspaceLabPage = lazyWithRecovery('CreateTripSplitWorkspaceLabPage', () => import('./pages/CreateTripSplitWorkspaceLabPage').then((module) => ({ default: module.CreateTripSplitWorkspaceLabPage })));
const CreateTripJourneyArchitectLabPage = lazyWithRecovery('CreateTripJourneyArchitectLabPage', () => import('./pages/CreateTripJourneyArchitectLabPage').then((module) => ({ default: module.CreateTripJourneyArchitectLabPage })));
const CreateTripV1Page = lazyWithRecovery('CreateTripV1Page', () => import('./pages/CreateTripV1Page').then((module) => ({ default: module.CreateTripV1Page })));
const CreateTripV2Page = lazyWithRecovery('CreateTripV2Page', () => import('./pages/CreateTripV2Page').then((module) => ({ default: module.CreateTripV2Page })));
const CreateTripV3Page = lazyWithRecovery('CreateTripV3Page', () => import('./pages/CreateTripV3Page').then((module) => ({ default: module.CreateTripV3Page })));

type RoutePreloadRule = {
    key: string;
    match: (pathname: string) => boolean;
    preload: () => Promise<unknown>;
};

const ROUTE_PRELOAD_RULES: RoutePreloadRule[] = [
    { key: 'home', match: (pathname) => pathname === '/', preload: () => import('./pages/MarketingHomePage') },
    { key: 'features', match: (pathname) => pathname === '/features', preload: () => import('./pages/FeaturesPage') },
    { key: 'inspirations', match: (pathname) => pathname === '/inspirations', preload: () => import('./pages/InspirationsPage') },
    { key: 'themes', match: (pathname) => pathname === '/inspirations/themes', preload: () => import('./pages/inspirations/ThemesPage') },
    { key: 'best-time', match: (pathname) => pathname === '/inspirations/best-time-to-travel', preload: () => import('./pages/inspirations/BestTimeToTravelPage') },
    { key: 'countries', match: (pathname) => pathname === '/inspirations/countries', preload: () => import('./pages/inspirations/CountriesPage') },
    { key: 'festivals', match: (pathname) => pathname === '/inspirations/events-and-festivals', preload: () => import('./pages/inspirations/FestivalsPage') },
    { key: 'weekend-getaways', match: (pathname) => pathname === '/inspirations/weekend-getaways', preload: () => import('./pages/inspirations/WeekendGetawaysPage') },
    { key: 'country-detail', match: (pathname) => pathname.startsWith('/inspirations/country/'), preload: () => import('./pages/inspirations/CountryDetailPage') },
    { key: 'updates', match: (pathname) => pathname === '/updates', preload: () => import('./pages/UpdatesPage') },
    { key: 'blog', match: (pathname) => pathname === '/blog', preload: () => import('./pages/BlogPage') },
    { key: 'blog-post', match: (pathname) => pathname.startsWith('/blog/'), preload: () => import('./pages/BlogPostPage') },
    { key: 'pricing', match: (pathname) => pathname === '/pricing', preload: () => import('./pages/PricingPage') },
    { key: 'faq', match: (pathname) => pathname === '/faq', preload: () => import('./pages/FaqPage') },
    { key: 'login', match: (pathname) => pathname === '/login', preload: () => import('./pages/LoginPage') },
    { key: 'reset-password', match: (pathname) => pathname === '/auth/reset-password', preload: () => import('./pages/ResetPasswordPage') },
    { key: 'contact', match: (pathname) => pathname === '/contact', preload: () => import('./pages/ContactPage') },
    { key: 'create-trip', match: (pathname) => pathname === '/create-trip', preload: () => import('./pages/CreateTripClassicLabPage') },
    { key: 'profile', match: (pathname) => pathname === '/profile', preload: () => import('./pages/ProfilePage') },
    { key: 'profile-settings', match: (pathname) => pathname === '/profile/settings', preload: () => import('./pages/ProfileSettingsPage') },
    { key: 'profile-onboarding', match: (pathname) => pathname === '/profile/onboarding', preload: () => import('./pages/ProfileOnboardingPage') },
    { key: 'create-trip-classic-lab', match: (pathname) => pathname === '/create-trip/labs/classic-card', preload: () => import('./pages/CreateTripClassicLabPage') },
    { key: 'create-trip-legacy-lab', match: (pathname) => pathname === '/create-trip/labs/classic-legacy', preload: () => import('./components/CreateTripForm') },
    { key: 'create-trip-design-v1', match: (pathname) => pathname === '/create-trip/labs/design-v1' || pathname === '/create-trip/v1', preload: () => import('./pages/CreateTripV1Page') },
    { key: 'create-trip-design-v2', match: (pathname) => pathname === '/create-trip/labs/design-v2' || pathname === '/create-trip/v2', preload: () => import('./pages/CreateTripV2Page') },
    { key: 'create-trip-design-v3', match: (pathname) => pathname === '/create-trip/labs/design-v3' || pathname === '/create-trip/v3', preload: () => import('./pages/CreateTripV3Page') },
];

const warmedRouteKeys = new Set<string>();

const getPathnameFromHref = (href: string): string => {
    try {
        return new URL(href, window.location.origin).pathname;
    } catch {
        return href.split(/[?#]/)[0] || href;
    }
};

const findRoutePreloadRule = (pathname: string): RoutePreloadRule | null => {
    for (const rule of ROUTE_PRELOAD_RULES) {
        if (rule.match(pathname)) return rule;
    }
    return null;
};

const preloadRouteForPath = async (pathname: string): Promise<void> => {
    const normalizedPathname = stripLocalePrefix(pathname || '/');
    const rule = findRoutePreloadRule(normalizedPathname);
    if (!rule) return;
    if (warmedRouteKeys.has(rule.key)) return;
    warmedRouteKeys.add(rule.key);
    try {
        await rule.preload();
    } catch {
        warmedRouteKeys.delete(rule.key);
    }
};

const RouteLoadingFallback: React.FC = () => (
    <div className="min-h-[42vh] w-full bg-slate-50" aria-hidden="true" />
);

const renderWithSuspense = (node: React.ReactElement) => (
    <Suspense fallback={<RouteLoadingFallback />}>
        {node}
    </Suspense>
);

const LOCALIZED_MARKETING_LOCALES: AppLanguage[] = SUPPORTED_LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

const MARKETING_ROUTE_CONFIGS: Array<{ path: string; element: React.ReactElement }> = [
    { path: '/', element: <MarketingHomePage /> },
    { path: '/features', element: <FeaturesPage /> },
    { path: '/inspirations', element: <InspirationsPage /> },
    { path: '/inspirations/themes', element: <ThemesPage /> },
    { path: '/inspirations/best-time-to-travel', element: <BestTimeToTravelPage /> },
    { path: '/inspirations/countries', element: <CountriesPage /> },
    { path: '/inspirations/events-and-festivals', element: <FestivalsPage /> },
    { path: '/inspirations/weekend-getaways', element: <WeekendGetawaysPage /> },
    { path: '/inspirations/country/:countryName', element: <CountryDetailPage /> },
    { path: '/updates', element: <UpdatesPage /> },
    { path: '/blog', element: <BlogPage /> },
    { path: '/blog/:slug', element: <BlogPostPage /> },
    { path: '/pricing', element: <PricingPage /> },
    { path: '/faq', element: <FaqPage /> },
    { path: '/share-unavailable', element: <ShareUnavailablePage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/auth/reset-password', element: <ResetPasswordPage /> },
    { path: '/contact', element: <ContactPage /> },
    { path: '/imprint', element: <ImprintPage /> },
    { path: '/privacy', element: <PrivacyPage /> },
    { path: '/terms', element: <TermsPage /> },
    { path: '/cookies', element: <CookiesPage /> },
];

const getLocalizedMarketingRoutePath = (path: string, locale: AppLanguage): string => {
    if (path === '/') return `/${locale}`;
    return `/${locale}${path}`;
};

const shouldEnableDebuggerOnBoot = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        const params = new URLSearchParams(window.location.search);
        const debugParam = params.get('debug');
        if (debugParam === '1' || debugParam === 'true') return true;
        return window.localStorage.getItem(DEBUG_AUTO_OPEN_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

/** Scroll to top on route change */
const ScrollToTop: React.FC = () => {
    const { pathname } = useLocation();
    const prevPathRef = useRef(pathname);

    useLayoutEffect(() => {
        if (prevPathRef.current === pathname) return;
        prevPathRef.current = pathname;
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

/** Pre-warm internal routes on user intent (hover/focus/touch). */
const ViewTransitionHandler: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    useEffect(() => {
        if (!enabled) return;
        // Keep legacy prewarm as a fallback path only when the new
        // navigation prefetch manager is disabled.
        if (isNavPrefetchEnabled()) return;

        const warmLinkTarget = (target: EventTarget | null) => {
            const anchor = (target as HTMLElement | null)?.closest?.('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || !href.startsWith('/')) return;
            const pathname = getPathnameFromHref(href);
            void preloadRouteForPath(pathname);
        };

        const handleMouseOver = (event: MouseEvent) => warmLinkTarget(event.target);
        const handleFocusIn = (event: FocusEvent) => warmLinkTarget(event.target);
        const handleTouchStart = (event: TouchEvent) => warmLinkTarget(event.target);

        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('touchstart', handleTouchStart, true);

        // Warm high-traffic marketing routes in dev so first local navigation
        // does not wait on Vite's on-demand transforms.
        let warmupTimerId: number | null = null;
        if (IS_DEV) {
            warmupTimerId = window.setTimeout(() => {
                void preloadRouteForPath('/features');
                void preloadRouteForPath('/inspirations');
                void preloadRouteForPath('/blog');
                void preloadRouteForPath('/pricing');
            }, 600);
        }
        return () => {
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('focusin', handleFocusIn, true);
            document.removeEventListener('touchstart', handleTouchStart, true);
            if (warmupTimerId !== null) window.clearTimeout(warmupTimerId);
        };
    }, []);

    return null;
};

const createLocalHistoryEntry = (
    navigate: ReturnType<typeof useNavigate>,
    updatedTrip: ITrip,
    view: IViewSettings | undefined,
    label: string,
    options?: { replace?: boolean },
    ts?: number,
    baseUrlOverride?: string
) => {
    const versionId = generateVersionId();
    const url = baseUrlOverride ? `${baseUrlOverride}?v=${versionId}` : buildTripUrl(updatedTrip.id, versionId);
    navigate(url, { replace: options?.replace ?? false });
    appendHistoryEntry(updatedTrip.id, url, label, { snapshot: { trip: updatedTrip, view }, ts });
    return url;
};

/** Thin wrapper that triggers DB sync when create-trip lab routes mount. */
const CreateTripClassicRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripClassicLabPage
                onTripGenerated={onTripGenerated}
                onOpenManager={onOpenManager}
                onLanguageLoaded={onLanguageLoaded}
            />
        </Suspense>
    );
};

const CreateTripLegacyRoute: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
        <CreateTripForm onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
    </Suspense>
);
};

const CreateTripDesignV1Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripV1Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const CreateTripDesignV2Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripV2Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const CreateTripDesignV3Route: React.FC<{
    onTripGenerated: (t: ITrip) => void;
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}> = ({ onTripGenerated, onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);
    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <CreateTripV3Page onTripGenerated={onTripGenerated} onOpenManager={onOpenManager} />
        </Suspense>
    );
};

const AuthenticatedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isLoading) return <RouteLoadingFallback />;
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return children;
};

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAdmin, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isLoading) return <RouteLoadingFallback />;
    if (!isAuthenticated || !isAdmin) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return children;
};

const AppContent: React.FC = () => {
    const { i18n } = useTranslation();
    const { access, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => getStoredAppLanguage());
    const [shouldLoadDebugger, setShouldLoadDebugger] = useState<boolean>(() => shouldEnableDebuggerOnBoot());
    const [isWarmupEnabled, setIsWarmupEnabled] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const userSettingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debugQueueRef = useRef<AppDebugCommand[]>([]);
    const debugStubRef = useRef<((command?: AppDebugCommand) => unknown) | null>(null);

    useEffect(() => {
        if (isLoginPathname(location.pathname)) return;
        const currentPath = buildPathFromLocationParts({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        });
        rememberAuthReturnPath(currentPath);
    }, [location.hash, location.pathname, location.search]);

    useEffect(() => {
        if (isAuthLoading) return;
        const strippedPath = stripLocalePrefix(location.pathname);
        const isAuthPath = strippedPath === '/login' || strippedPath === '/auth/reset-password';
        if (!isAuthenticated || !access || access.isAnonymous || isAuthPath) return;

        if (access.accountStatus !== 'active') {
            void logout();
            navigate('/login', { replace: true });
            return;
        }

        if (access.onboardingCompleted) return;
        if (strippedPath === '/profile/onboarding') return;

        navigate('/profile/onboarding', {
            replace: true,
            state: { from: `${location.pathname}${location.search}` },
        });
    }, [access, isAuthLoading, isAuthenticated, location.pathname, location.search, logout, navigate]);

    const resolveTripExpiry = (createdAtMs: number, existingTripExpiry?: string | null): string | null => {
        if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
        const expirationDays = access?.entitlements.tripExpirationDays;
        if (expirationDays === null) return null;
        if (typeof expirationDays === 'number' && expirationDays > 0) {
            return buildTripExpiryIso(createdAtMs, expirationDays);
        }
        return buildTripExpiryIso(createdAtMs, ANONYMOUS_TRIP_EXPIRATION_DAYS);
    };

    const resolvedRouteLocale = useMemo<AppLanguage>(() => {
        const localeFromPath = extractLocaleFromPath(location.pathname);
        if (isToolRoute(location.pathname)) {
            if (localeFromPath) return localeFromPath;
            return normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? appLanguage);
        }

        if (localeFromPath) return localeFromPath;
        return DEFAULT_LOCALE;
    }, [appLanguage, i18n.language, i18n.resolvedLanguage, location.pathname]);

    // DB sync (session, upload, sync, user settings) is deferred to trip-related
    // routes via useDbSync to avoid unnecessary network calls on marketing pages.

    useEffect(() => {
        applyDocumentLocale(resolvedRouteLocale);

        const currentI18nLanguage = normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
        if (currentI18nLanguage !== resolvedRouteLocale) {
            void i18n.changeLanguage(resolvedRouteLocale);
        }
    }, [i18n, resolvedRouteLocale]);

    useEffect(() => {
        if (isToolRoute(location.pathname)) return;
        const localeFromPath = extractLocaleFromPath(location.pathname);
        if (!localeFromPath) return;
        if (localeFromPath === appLanguage) return;
        setAppLanguage(localeFromPath);
    }, [appLanguage, location.pathname]);

    useEffect(() => {
        if (!isToolRoute(location.pathname)) return;
        const localeFromPath = extractLocaleFromPath(location.pathname);
        const resolvedToolLocale = localeFromPath ?? normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
        if (resolvedToolLocale === appLanguage) return;
        setAppLanguage(resolvedToolLocale);
    }, [appLanguage, i18n.language, i18n.resolvedLanguage, location.pathname]);

    const isInitialLanguageRef = useRef(true);
    useEffect(() => {
        setStoredAppLanguage(appLanguage);
        // Skip DB write on initial mount — only persist when user changes the language.
        if (isInitialLanguageRef.current) {
            isInitialLanguageRef.current = false;
            return;
        }
        if (DB_ENABLED) {
            void dbUpsertUserSettings({ language: appLanguage });
        }
    }, [appLanguage]);

    useEffect(() => {
        const disposeAnalytics = initializeAnalytics();
        return () => {
            disposeAnalytics();
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let resolved = false;
        let timeoutId: number | null = null;
        let idleId: number | null = null;

        const removeInteractionListeners = () => {
            window.removeEventListener('pointerdown', onFirstInteraction, true);
            window.removeEventListener('keydown', onFirstInteraction, true);
            window.removeEventListener('touchstart', onFirstInteraction, true);
            window.removeEventListener('scroll', onFirstInteraction, true);
        };

        const clearTimers = () => {
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (idleId !== null && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
                idleId = null;
            }
        };

        const enableWarmup = () => {
            if (resolved) return;
            resolved = true;
            setIsWarmupEnabled(true);
            removeInteractionListeners();
            clearTimers();
        };

        const onFirstInteraction = () => {
            enableWarmup();
        };

        window.addEventListener('pointerdown', onFirstInteraction, true);
        window.addEventListener('keydown', onFirstInteraction, true);
        window.addEventListener('touchstart', onFirstInteraction, true);
        window.addEventListener('scroll', onFirstInteraction, true);

        timeoutId = window.setTimeout(enableWarmup, 3200);

        if ('requestIdleCallback' in window) {
            idleId = (window as Window & {
                requestIdleCallback: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
            }).requestIdleCallback(() => {
                enableWarmup();
            }, { timeout: 2600 });
        }

        return () => {
            resolved = true;
            removeInteractionListeners();
            clearTimers();
        };
    }, []);

    useEffect(() => {
        trackPageView(`${location.pathname}${location.search}`);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (shouldLoadDebugger) return;
        const params = new URLSearchParams(location.search);
        const debugParam = params.get('debug');
        if (debugParam === '1' || debugParam === 'true') {
            setShouldLoadDebugger(true);
        }
    }, [location.search, shouldLoadDebugger]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as AppDebugWindow;
        if (shouldLoadDebugger) return;

        const debugStub = (command?: AppDebugCommand) => {
            debugQueueRef.current.push(command ?? true);
            setShouldLoadDebugger(true);
            return undefined;
        };

        debugStubRef.current = debugStub;
        host.debug = debugStub;

        return () => {
            if (host.debug === debugStub) {
                delete host.debug;
            }
        };
    }, [shouldLoadDebugger]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!shouldLoadDebugger) return;

        let rafId: number | null = null;
        const flushQueuedDebugCommands = () => {
            const host = window as AppDebugWindow;
            if (typeof host.debug !== 'function' || host.debug === debugStubRef.current) {
                rafId = window.requestAnimationFrame(flushQueuedDebugCommands);
                return;
            }

            const queued = [...debugQueueRef.current];
            debugQueueRef.current = [];
            queued.forEach((command) => {
                host.debug?.(command);
            });
        };

        flushQueuedDebugCommands();
        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [shouldLoadDebugger]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as AppDebugWindow;
        host.toggleSimulatedLogin = (force?: boolean) => {
            const next = toggleSimulatedLogin(force);
            if (IS_DEV) {
                console.info(
                    `[${APP_NAME}] toggleSimulatedLogin(${typeof force === 'boolean' ? force : 'toggle'}) -> ${next ? 'SIMULATED LOGGED-IN' : 'ANONYMOUS'}`
                );
            }
            return next;
        };
        host.getSimulatedLoginState = () => (isSimulatedLoggedIn() ? 'simulated_logged_in' : 'anonymous');

        return () => {
            delete host.toggleSimulatedLogin;
            delete host.getSimulatedLoginState;
        };
    }, []);

    const handleViewSettingsChange = (settings: IViewSettings) => {
        if (!DB_ENABLED) return;
        if (userSettingsSaveRef.current) {
            clearTimeout(userSettingsSaveRef.current);
        }
        userSettingsSaveRef.current = setTimeout(() => {
            void dbUpsertUserSettings({
                mapStyle: settings.mapStyle,
                routeMode: settings.routeMode,
                layoutMode: settings.layoutMode,
                timelineView: settings.timelineView,
                showCityNames: settings.showCityNames,
                zoomLevel: settings.zoomLevel,
                sidebarWidth: settings.sidebarWidth,
                timelineHeight: settings.timelineHeight,
            });
        }, 800);
    };

    // Persist trip changes
    const handleUpdateTrip = (updatedTrip: ITrip, options?: { persist?: boolean }) => {
        setTrip(updatedTrip);
        if (options?.persist === false) return;
        saveTrip(updatedTrip);
    };

    const handleCommitState = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string; adminOverride?: boolean }) => {
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();

        if (!DB_ENABLED) {
            createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);
            return;
        }

        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);

        const commit = async () => {
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            if (options?.adminOverride) {
                const overrideCommit = await dbAdminOverrideTripCommit(updatedTrip, view, label);
                if (!overrideCommit?.tripId || !overrideCommit.versionId) return;
                return;
            }
            const upserted = await dbUpsertTrip(updatedTrip, view);
            const versionId = await dbCreateTripVersion(updatedTrip, view, label);
            if (!upserted || !versionId) return;
        };

        void commit();
    };

    const handleTripGenerated = (newTrip: ITrip) => {
        const create = async () => {
            const existingTrip = getTripById(newTrip.id);
            if (existingTrip) {
                const now = Date.now();
                const updatedTrip: ITrip = {
                    ...existingTrip,
                    ...newTrip,
                    createdAt: typeof existingTrip.createdAt === 'number'
                        ? existingTrip.createdAt
                        : (typeof newTrip.createdAt === 'number' ? newTrip.createdAt : now),
                    updatedAt: now,
                    isFavorite: existingTrip.isFavorite ?? newTrip.isFavorite ?? false,
                    status: newTrip.status || existingTrip.status || 'active',
                    tripExpiresAt: newTrip.tripExpiresAt || existingTrip.tripExpiresAt || buildTripExpiryIso(now),
                    sourceKind: newTrip.sourceKind || existingTrip.sourceKind || 'created',
                };

                setTrip(updatedTrip);
                saveTrip(updatedTrip);
                const commitTs = Date.now();
                createLocalHistoryEntry(navigate, updatedTrip, undefined, 'Data: Updated generated trip', { replace: true }, commitTs);

                if (DB_ENABLED) {
                    const sessionId = await ensureDbSession();
                    if (!sessionId) return;
                    const upserted = await dbUpsertTrip(updatedTrip, undefined);
                    const versionId = await dbCreateTripVersion(updatedTrip, undefined, 'Data: Updated generated trip');
                    if (!upserted || !versionId) return;
                }
                return;
            }

            if (DB_ENABLED) {
                const limit = await dbCanCreateTrip();
                if (!limit.allowCreate) {
                    window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
                    navigate('/pricing');
                    return;
                }
            }

            const now = Date.now();
            const preparedTrip: ITrip = {
                ...newTrip,
                createdAt: typeof newTrip.createdAt === 'number' ? newTrip.createdAt : now,
                updatedAt: now,
                status: 'active',
                tripExpiresAt: resolveTripExpiry(now, newTrip.tripExpiresAt),
                sourceKind: newTrip.sourceKind || 'created',
            };
            const cityCount = newTrip.items.filter((item) => item.type === 'city').length;
            const activityCount = newTrip.items.filter((item) => item.type === 'activity').length;
            const travelSegmentCount = newTrip.items.filter((item) => item.type === 'travel').length;
            trackEvent('app__trip--create', {
                city_count: cityCount,
                activity_count: activityCount,
                travel_segment_count: travelSegmentCount,
                total_item_count: newTrip.items.length,
            });

            setTrip(preparedTrip);
            saveTrip(preparedTrip);
            const createdTs = Date.now();
            if (!DB_ENABLED) {
                createLocalHistoryEntry(navigate, preparedTrip, undefined, 'Data: Created trip', undefined, createdTs);
                return;
            }

            createLocalHistoryEntry(navigate, preparedTrip, undefined, 'Data: Created trip', undefined, createdTs);
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            const upserted = await dbUpsertTrip(preparedTrip, undefined);
            const versionId = await dbCreateTripVersion(preparedTrip, undefined, 'Data: Created trip');
            if (!upserted || !versionId) return;
        };

        void create();
    };

    const handleLoadTrip = (loadedTrip: ITrip) => {
        setTrip(loadedTrip);
        setIsManagerOpen(false);
        navigate(buildTripUrl(loadedTrip.id));
    };

    return (
        <TripManagerProvider openTripManager={() => setIsManagerOpen(true)}>
            <ScrollToTop />
            <ViewTransitionHandler enabled={isWarmupEnabled} />
            <NavigationPrefetchManager enabled={isWarmupEnabled} />
            <SpeculationRulesManager enabled={isWarmupEnabled} />
            <Routes>
                {MARKETING_ROUTE_CONFIGS.map(({ path, element }) => (
                    <Route
                        key={`marketing:${path}`}
                        path={path}
                        element={renderWithSuspense(element)}
                    />
                ))}
                {LOCALIZED_MARKETING_LOCALES.flatMap((locale) =>
                    MARKETING_ROUTE_CONFIGS.map(({ path, element }) => (
                        <Route
                            key={`marketing:${locale}:${path}`}
                            path={getLocalizedMarketingRoutePath(path, locale)}
                            element={renderWithSuspense(element)}
                        />
                    ))
                )}
                <Route
                    path="/create-trip"
                    element={
                        renderWithSuspense(<CreateTripClassicRoute
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    } 
                />
                {LOCALIZED_MARKETING_LOCALES.map((locale) => (
                    <Route
                        key={`tool:${locale}:create-trip`}
                        path={`/${locale}/create-trip`}
                        element={
                            renderWithSuspense(<CreateTripClassicRoute
                                onTripGenerated={handleTripGenerated}
                                onOpenManager={() => setIsManagerOpen(true)}
                                onLanguageLoaded={setAppLanguage}
                            />)
                        }
                    />
                ))}
                <Route
                    path="/create-trip/labs/classic-card"
                    element={
                        renderWithSuspense(<CreateTripClassicRoute
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/labs/classic-legacy"
                    element={
                        renderWithSuspense(<CreateTripLegacyRoute
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/labs/split-workspace"
                    element={
                        renderWithSuspense(<CreateTripSplitWorkspaceLabPage
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/labs/journey-architect"
                    element={
                        renderWithSuspense(<CreateTripJourneyArchitectLabPage
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/labs/design-v1"
                    element={
                        renderWithSuspense(<CreateTripDesignV1Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/labs/design-v2"
                    element={
                        renderWithSuspense(<CreateTripDesignV2Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/labs/design-v3"
                    element={
                        renderWithSuspense(<CreateTripDesignV3Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/v1"
                    element={
                        renderWithSuspense(<CreateTripDesignV1Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/v2"
                    element={
                        renderWithSuspense(<CreateTripDesignV2Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/create-trip/v3"
                    element={
                        renderWithSuspense(<CreateTripDesignV3Route
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    }
                />
                <Route
                    path="/profile/onboarding"
                    element={renderWithSuspense(
                        <AuthenticatedRoute>
                            <ProfileOnboardingPage />
                        </AuthenticatedRoute>
                    )}
                />
                <Route
                    path="/profile"
                    element={renderWithSuspense(
                        <AuthenticatedRoute>
                            <ProfilePage />
                        </AuthenticatedRoute>
                    )}
                />
                <Route
                    path="/profile/settings"
                    element={renderWithSuspense(
                        <AuthenticatedRoute>
                            <ProfileSettingsPage />
                        </AuthenticatedRoute>
                    )}
                />
                <Route
                    path="/admin/*"
                    element={renderWithSuspense(
                        <AdminRoute>
                            <AdminWorkspaceRouter />
                        </AdminRoute>
                    )}
                />
                <Route 
                    path="/trip/:tripId" 
                    element={renderWithSuspense(
                        <TripLoaderRoute
                            trip={trip}
                            onTripLoaded={setTrip}
                            onUpdateTrip={handleUpdateTrip}
                            onCommitState={handleCommitState}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                            onLanguageLoaded={setAppLanguage}
                        />
                    )} 
                />
                <Route
                    path="/example/:templateId"
                    element={renderWithSuspense(
                        <ExampleTripLoaderRoute
                            trip={trip}
                            onTripLoaded={setTrip}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                        />
                    )}
                />
                <Route
                    path="/s/:token"
                    element={renderWithSuspense(
                        <SharedTripLoaderRoute
                            trip={trip}
                            onTripLoaded={setTrip}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                            onLanguageLoaded={setAppLanguage}
                        />
                    )}
                />
                 {/* Legacy Redirect */}
                 <Route path="/trip" element={<Navigate to="/create-trip" replace />} />
                 <Route path="*" element={renderWithSuspense(<NotFoundPage />)} />
            </Routes>

            {/* Global Modals */}
            {isManagerOpen && (
                <Suspense fallback={null}>
                    <TripManager 
                        isOpen={isManagerOpen} 
                        onClose={() => setIsManagerOpen(false)} 
                        onSelectTrip={handleLoadTrip}
                        currentTripId={trip?.id}
                        onUpdateTrip={(updatedTrip) => {
                            if (!trip || trip.id !== updatedTrip.id) return;
                            handleUpdateTrip(updatedTrip, { persist: false });
                        }}
                        appLanguage={appLanguage}
                    />
                </Suspense>
            )}
            
            {isSettingsOpen && (
                <Suspense fallback={null}>
                    <SettingsModal 
                        isOpen={isSettingsOpen} 
                        onClose={() => setIsSettingsOpen(false)} 
                        appLanguage={appLanguage}
                        onAppLanguageChange={setAppLanguage}
                    />
                </Suspense>
            )}

            <CookieConsentBanner />
            <GlobalTooltipLayer />
            {shouldLoadDebugger && (
                <Suspense fallback={null}>
                    <OnPageDebugger />
                </Suspense>
            )}
        </TripManagerProvider>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <AppDialogProvider>
                    <LoginModalProvider>
                        <AppContent />
                    </LoginModalProvider>
                </AppDialogProvider>
            </AuthProvider>
        </Router>
    );
};

export default App;
