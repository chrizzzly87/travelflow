import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, Suspense, lazy } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLanguage, ITrip, IViewSettings } from './types';
import { TripManagerProvider } from './contexts/TripManagerContext';
import { CookieConsentBanner } from './components/marketing/CookieConsentBanner';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry, findHistoryEntryByUrl } from './services/historyService';
import { buildCreateTripUrl, buildShareUrl, buildTripUrl, decompressTrip, generateTripId, generateVersionId, getStoredAppLanguage, isUuid, setStoredAppLanguage } from './utils';
import { DB_ENABLED } from './config/db';
import { isSimulatedLoggedIn, toggleSimulatedLogin } from './services/simulatedLoginService';
import { useDbSync } from './hooks/useDbSync';
import { AppDialogProvider } from './components/AppDialogProvider';
import { GlobalTooltipLayer } from './components/GlobalTooltipLayer';
import { initializeAnalytics, trackEvent, trackPageView } from './services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from './config/productLimits';
import { getTripLifecycleState } from './config/paywall';
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

type ExampleTemplateFactory = (createdAtIso: string) => ITrip;
type ExampleTripCardSummary = {
    title: string;
    countries: { name: string }[];
};
type ExampleTripPrefetchState = {
    useExampleSharedTransition?: boolean;
    prefetchedExampleTrip?: ITrip;
    prefetchedExampleView?: IViewSettings;
    prefetchedTemplateTitle?: string;
    prefetchedTemplateCountries?: string[];
};

const DEBUG_AUTO_OPEN_STORAGE_KEY = 'tf_debug_auto_open';
const IS_DEV = import.meta.env.DEV;

type DbServiceModule = typeof import('./services/dbService');

let dbServicePromise: Promise<DbServiceModule> | null = null;

const loadDbService = async (): Promise<DbServiceModule> => {
    if (!dbServicePromise) {
        dbServicePromise = import('./services/dbService');
    }
    return dbServicePromise;
};

const ensureDbSession = async () => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.ensureDbSession();
};

const dbCanCreateTrip = async () => {
    if (!DB_ENABLED) {
        return {
            allowCreate: true,
            activeTripCount: 0,
            maxTripCount: 0,
        };
    }
    const db = await loadDbService();
    return db.dbCanCreateTrip();
};

const dbCreateTripVersion = async (...args: Parameters<DbServiceModule['dbCreateTripVersion']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbCreateTripVersion(...args);
};

const dbGetSharedTrip = async (...args: Parameters<DbServiceModule['dbGetSharedTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetSharedTrip(...args);
};

const dbGetSharedTripVersion = async (...args: Parameters<DbServiceModule['dbGetSharedTripVersion']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetSharedTripVersion(...args);
};

const dbGetTrip = async (...args: Parameters<DbServiceModule['dbGetTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetTrip(...args);
};

const dbGetTripVersion = async (...args: Parameters<DbServiceModule['dbGetTripVersion']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbGetTripVersion(...args);
};

const dbUpdateSharedTrip = async (...args: Parameters<DbServiceModule['dbUpdateSharedTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbUpdateSharedTrip(...args);
};

const dbUpsertTrip = async (...args: Parameters<DbServiceModule['dbUpsertTrip']>) => {
    if (!DB_ENABLED) return null;
    const db = await loadDbService();
    return db.dbUpsertTrip(...args);
};

const dbUpsertUserSettings = async (...args: Parameters<DbServiceModule['dbUpsertUserSettings']>) => {
    if (!DB_ENABLED) return;
    const db = await loadDbService();
    await db.dbUpsertUserSettings(...args);
};

const lazyWithRecovery = <TModule,>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const CreateTripForm = lazyWithRecovery('CreateTripForm', () => import('./components/CreateTripForm').then((module) => ({ default: module.CreateTripForm })));
const TripView = lazyWithRecovery('TripView', () => import('./components/TripView').then((module) => ({ default: module.TripView })));
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
const ContactPage = lazyWithRecovery('ContactPage', () => import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const ImprintPage = lazyWithRecovery('ImprintPage', () => import('./pages/ImprintPage').then((module) => ({ default: module.ImprintPage })));
const PrivacyPage = lazyWithRecovery('PrivacyPage', () => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazyWithRecovery('TermsPage', () => import('./pages/TermsPage').then((module) => ({ default: module.TermsPage })));
const CookiesPage = lazyWithRecovery('CookiesPage', () => import('./pages/CookiesPage').then((module) => ({ default: module.CookiesPage })));
const AdminDashboardPage = lazyWithRecovery('AdminDashboardPage', () => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminAiBenchmarkPage = lazyWithRecovery('AdminAiBenchmarkPage', () => import('./pages/AdminAiBenchmarkPage').then((module) => ({ default: module.AdminAiBenchmarkPage })));
const AdminAccessPage = lazyWithRecovery('AdminAccessPage', () => import('./pages/AdminAccessPage').then((module) => ({ default: module.AdminAccessPage })));
const PricingPage = lazyWithRecovery('PricingPage', () => import('./pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const FaqPage = lazyWithRecovery('FaqPage', () => import('./pages/FaqPage').then((module) => ({ default: module.FaqPage })));
const ShareUnavailablePage = lazyWithRecovery('ShareUnavailablePage', () => import('./pages/ShareUnavailablePage').then((module) => ({ default: module.ShareUnavailablePage })));
const NotFoundPage = lazyWithRecovery('NotFoundPage', () => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
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
    { key: 'contact', match: (pathname) => pathname === '/contact', preload: () => import('./pages/ContactPage') },
    { key: 'create-trip', match: (pathname) => pathname === '/create-trip', preload: () => import('./pages/CreateTripClassicLabPage') },
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
const ViewTransitionHandler: React.FC = () => {
    useEffect(() => {
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

const resolveTripInitialMapFocusQuery = (trip: ITrip): string | undefined => {
    const locations = trip.items
        .filter((item) => item.type === 'city' && typeof item.location === 'string')
        .map((item) => item.location?.trim() ?? '')
        .filter((location) => location.length > 0);
    const uniqueLocations = Array.from(new Set(locations));
    if (uniqueLocations.length === 0) return undefined;
    return uniqueLocations.join(' || ');
};

// Legacy compressed URLs still supported in TripLoader.

// Component to handle trip loading from URL
const TripLoader = ({
    trip,
    onTripLoaded,
    handleUpdateTrip,
    handleCommitState,
    setIsManagerOpen,
    setIsSettingsOpen,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    handleUpdateTrip: (t: ITrip, options?: { persist?: boolean }) => void,
    handleCommitState: (t: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
    onLanguageLoaded?: (lang: AppLanguage) => void,
}) => {
    const { tripId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const lastLoadRef = useRef<string | null>(null);
    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (!tripId) return;
        const loadKey = `${tripId}:${versionId || ''}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
            setViewSettings(undefined);
            // 1. Legacy compressed URLs
            const sharedState = decompressTrip(tripId);
            if (sharedState) {
                const { trip: loadedTrip, view } = sharedState;
                const localTrip = getTripById(loadedTrip.id);
                const mergedTrip: ITrip = {
                    ...loadedTrip,
                    isFavorite: localTrip?.isFavorite ?? loadedTrip.isFavorite ?? false,
                };
                const resolvedView = view ?? mergedTrip.defaultView;
                setViewSettings(resolvedView);
                onTripLoaded(mergedTrip, resolvedView);
                return;
            }

            // 2. Supabase-backed load
            if (DB_ENABLED) {
                await ensureDbSession();
                if (versionId && isUuid(versionId)) {
                    const version = await dbGetTripVersion(tripId, versionId);
                    if (version?.trip) {
                        saveTrip(version.trip);
                        const resolvedView = version.view ?? version.trip.defaultView;
                        setViewSettings(resolvedView);
                        onTripLoaded(version.trip, resolvedView);
                        return;
                    }
                }
                if (versionId) {
                    const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                    if (localEntry?.snapshot?.trip) {
                        saveTrip(localEntry.snapshot.trip);
                        const resolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                        setViewSettings(resolvedView);
                        onTripLoaded(localEntry.snapshot.trip, resolvedView);
                        return;
                    }
                }
                const dbTrip = await dbGetTrip(tripId);
                if (dbTrip?.trip) {
                    saveTrip(dbTrip.trip);
                    const resolvedView = dbTrip.view ?? dbTrip.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(dbTrip.trip, resolvedView);
                    return;
                }
            }

            // 3. Local fallback
            if (versionId) {
                const localEntry = findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId));
                if (localEntry?.snapshot?.trip) {
                    saveTrip(localEntry.snapshot.trip);
                    const resolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(localEntry.snapshot.trip, resolvedView);
                    return;
                }
            }
            const localTrip = getTripById(tripId);
            if (localTrip) {
                onTripLoaded(localTrip, localTrip.defaultView);
                return;
            }

            console.error('Failed to load trip from URL');
            navigate('/create-trip', { replace: true });
        };

        void load();
    }, [tripId, versionId, navigate, onTripLoaded]);

    if (!trip) return null;

    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <TripView
                trip={trip}
                initialMapFocusQuery={resolveTripInitialMapFocusQuery(trip)}
                initialViewSettings={viewSettings ?? trip.defaultView}
                onUpdateTrip={handleUpdateTrip}
                onCommitState={handleCommitState}
                onViewSettingsChange={(settings) => {
                    setViewSettings(settings);
                    onViewSettingsChange(settings);
                }}
                onOpenManager={() => setIsManagerOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                appLanguage={appLanguage}
            />
        </Suspense>
    );
};

const SharedTripLoader = ({
    trip,
    onTripLoaded,
    setIsManagerOpen,
    setIsSettingsOpen,
    appLanguage,
    onViewSettingsChange,
    onLanguageLoaded,
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
    onLanguageLoaded?: (lang: AppLanguage) => void,
}) => {
    const { token } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { access } = useAuth();
    const lastLoadRef = useRef<string | null>(null);
    const [shareMode, setShareMode] = useState<'view' | 'edit'>('view');
    const [allowCopy, setAllowCopy] = useState(true);
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [snapshotState, setSnapshotState] = useState<{ hasNewer: boolean; latestUrl: string } | null>(null);
    const [sourceShareVersionId, setSourceShareVersionId] = useState<string | null>(null);

    const resolveTripExpiry = (createdAtMs: number, existingTripExpiry?: string | null): string | null => {
        if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
        const expirationDays = access?.entitlements.tripExpirationDays;
        if (expirationDays === null) return null;
        if (typeof expirationDays === 'number' && expirationDays > 0) {
            return buildTripExpiryIso(createdAtMs, expirationDays);
        }
        return buildTripExpiryIso(createdAtMs, ANONYMOUS_TRIP_EXPIRATION_DAYS);
    };

    const versionId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('v');
    }, [location.search]);

    useDbSync(onLanguageLoaded);

    useEffect(() => {
        if (!token) return;
        const loadKey = `${token}:${location.search}`;
        if (lastLoadRef.current === loadKey) return;
        lastLoadRef.current = loadKey;

        const load = async () => {
            if (!DB_ENABLED) {
                navigate('/share-unavailable', { replace: true });
                return;
            }

            setViewSettings(undefined);
            setSnapshotState(null);
            setSourceShareVersionId(null);
            await ensureDbSession();
            const shared = await dbGetSharedTrip(token);
            if (!shared) {
                navigate('/share-unavailable', { replace: true });
                return;
            }
            if (getTripLifecycleState(shared.trip) !== 'active') {
                navigate('/share-unavailable', { replace: true });
                return;
            }

            setShareMode(shared.mode);
            setAllowCopy(shared.allowCopy ?? true);

            if (versionId && isUuid(versionId)) {
                const sharedVersion = await dbGetSharedTripVersion(token, versionId);
                if (sharedVersion?.trip) {
                    const resolvedView = sharedVersion.view ?? sharedVersion.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(sharedVersion.trip, resolvedView);
                    setSourceShareVersionId(sharedVersion.versionId);
                    const latestVersionId = sharedVersion.latestVersionId ?? shared.latestVersionId ?? null;
                    setSnapshotState({
                        hasNewer: Boolean(latestVersionId && latestVersionId !== sharedVersion.versionId),
                        latestUrl: buildShareUrl(token),
                    });
                    return;
                }

                const version = await dbGetTripVersion(shared.trip.id, versionId);
                if (version?.trip) {
                    const latestVersionMismatch = Boolean(shared.latestVersionId && shared.latestVersionId !== versionId);
                    const sharedUpdatedAt = typeof shared.trip.updatedAt === 'number' ? shared.trip.updatedAt : null;
                    const snapshotUpdatedAt = typeof version.trip.updatedAt === 'number' ? version.trip.updatedAt : null;
                    const newerByTimestamp = sharedUpdatedAt !== null && snapshotUpdatedAt !== null && sharedUpdatedAt > snapshotUpdatedAt;
                    const resolvedView = version.view ?? version.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(version.trip, resolvedView);
                    setSourceShareVersionId(versionId);
                    setSnapshotState({
                        hasNewer: latestVersionMismatch || newerByTimestamp,
                        latestUrl: buildShareUrl(token),
                    });
                    return;
                }
            }

            if (versionId) {
                const localEntry = findHistoryEntryByUrl(shared.trip.id, buildShareUrl(token, versionId));
                if (localEntry?.snapshot?.trip) {
                    const resolvedView = localEntry.snapshot.view ?? localEntry.snapshot.trip.defaultView;
                    setViewSettings(resolvedView);
                    onTripLoaded(localEntry.snapshot.trip, resolvedView);
                    setSourceShareVersionId(isUuid(versionId) ? versionId : null);
                    setSnapshotState({
                        hasNewer: true,
                        latestUrl: buildShareUrl(token),
                    });
                    return;
                }
            }

            const resolvedView = shared.view ?? shared.trip.defaultView;
            setViewSettings(resolvedView);
            onTripLoaded(shared.trip, resolvedView);
            setSourceShareVersionId(shared.latestVersionId ?? null);
        };

        void load();
    }, [token, versionId, location.search, navigate, onTripLoaded]);

    const handleCommitShared = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => {
        if (shareMode !== 'edit' || !token) return;
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();
        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs, buildShareUrl(token));

        const commit = async () => {
            const sessionId = await ensureDbSession();
            if (!sessionId) return;
            const version = await dbUpdateSharedTrip(token, updatedTrip, view, label);
            if (!version) return;
        };
        void commit();
    };

    const handleCopyTrip = async () => {
        if (!trip) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
                navigate('/pricing');
                return;
            }
        }
        let resolvedSourceShareVersionId = sourceShareVersionId;
        if (!resolvedSourceShareVersionId && token && DB_ENABLED) {
            const sharedNow = await dbGetSharedTrip(token);
            resolvedSourceShareVersionId = sharedNow?.latestVersionId ?? null;
        }
        const now = Date.now();
        const cloned: ITrip = {
            ...trip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiry(now),
            sourceKind: 'duplicate_shared',
            forkedFromTripId: trip.id,
            forkedFromShareToken: token || undefined,
            forkedFromShareVersionId: resolvedSourceShareVersionId || undefined,
        };
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: trip.id,
                    sourceTitle: trip.title,
                    sourceShareToken: token || null,
                    sourceShareVersionId: resolvedSourceShareVersionId || null,
                    createdAt: Date.now(),
                }));
            } catch (e) {
                // ignore storage issues
            }
        }
        saveTrip(cloned);
        if (DB_ENABLED) {
            await ensureDbSession();
            await dbUpsertTrip(cloned, viewSettings);
            const version = await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
            createLocalHistoryEntry(navigate, cloned, viewSettings, 'Data: Copied trip', undefined, Date.now());
            return;
        }
        navigate(buildTripUrl(cloned.id));
    };

    if (!trip) return null;

    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <TripView
                trip={trip}
                initialViewSettings={viewSettings ?? trip.defaultView}
                onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
                onCommitState={handleCommitShared}
                onViewSettingsChange={(settings) => {
                    setViewSettings(settings);
                    onViewSettingsChange(settings);
                }}
                onOpenManager={() => setIsManagerOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                appLanguage={appLanguage}
                readOnly={shareMode === 'view'}
                canShare={false}
                shareStatus={shareMode}
                shareSnapshotMeta={snapshotState ?? undefined}
                onCopyTrip={allowCopy ? handleCopyTrip : undefined}
            />
        </Suspense>
    );
};

const ExampleTripLoader = ({
    trip,
    onTripLoaded,
    setIsManagerOpen,
    setIsSettingsOpen,
    appLanguage,
    onViewSettingsChange,
}: {
    trip: ITrip | null,
    onTripLoaded: (t: ITrip, view?: IViewSettings) => void,
    setIsManagerOpen: (o: boolean) => void,
    setIsSettingsOpen: (o: boolean) => void,
    appLanguage: AppLanguage,
    onViewSettingsChange: (settings: IViewSettings) => void,
}) => {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { access } = useAuth();
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const trackedTemplateRef = useRef<string | null>(null);
    const hydratedTemplateRef = useRef<string | null>(null);
    const prefetchedState = location.state as ExampleTripPrefetchState | null;
    const prefetchedTrip = useMemo<ITrip | null>(() => {
        if (!templateId) return null;
        const candidate = prefetchedState?.prefetchedExampleTrip;
        if (!candidate) return null;
        if (!candidate.isExample) return null;
        if (candidate.exampleTemplateId !== templateId) return null;
        return candidate;
    }, [prefetchedState, templateId]);
    const prefetchedView = useMemo<IViewSettings | undefined>(() => {
        if (!prefetchedTrip) return undefined;
        return prefetchedState?.prefetchedExampleView ?? prefetchedTrip.defaultView;
    }, [prefetchedState, prefetchedTrip]);
    const prefetchedTemplateCard = useMemo<ExampleTripCardSummary | null>(() => {
        if (!prefetchedTrip) return null;
        const names = prefetchedState?.prefetchedTemplateCountries
            || prefetchedTrip.exampleTemplateCountries
            || [];
        return {
            title: prefetchedState?.prefetchedTemplateTitle || prefetchedTrip.title,
            countries: names.map((name) => ({ name })),
        };
    }, [prefetchedState, prefetchedTrip]);
    const [templateFactory, setTemplateFactory] = useState<ExampleTemplateFactory | null | undefined>(undefined);
    const [templateCard, setTemplateCard] = useState<ExampleTripCardSummary | null>(prefetchedTemplateCard);

    const resolveTripExpiry = (createdAtMs: number, existingTripExpiry?: string | null): string | null => {
        if (typeof existingTripExpiry === 'string' && existingTripExpiry) return existingTripExpiry;
        const expirationDays = access?.entitlements.tripExpirationDays;
        if (expirationDays === null) return null;
        if (typeof expirationDays === 'number' && expirationDays > 0) {
            return buildTripExpiryIso(createdAtMs, expirationDays);
        }
        return buildTripExpiryIso(createdAtMs, ANONYMOUS_TRIP_EXPIRATION_DAYS);
    };

    useEffect(() => {
        if (prefetchedTemplateCard) {
            setTemplateCard(prefetchedTemplateCard);
        }
    }, [prefetchedTemplateCard, templateId]);

    useEffect(() => {
        if (!templateId) {
            setTemplateFactory(null);
            setTemplateCard(prefetchedTemplateCard ?? null);
            return;
        }

        let cancelled = false;
        setTemplateFactory(undefined);

        const loadTemplateResources = async () => {
            try {
                const [{ TRIP_FACTORIES }, { getExampleTripCardByTemplateId }] = await Promise.all([
                    import('./data/exampleTripTemplates'),
                    import('./data/exampleTripCards'),
                ]);
                if (cancelled) return;
                const nextFactory = (TRIP_FACTORIES[templateId] as ExampleTemplateFactory | undefined) ?? null;
                setTemplateFactory(() => nextFactory);
                setTemplateCard((getExampleTripCardByTemplateId(templateId) as ExampleTripCardSummary | undefined) ?? prefetchedTemplateCard ?? null);
            } catch {
                if (cancelled) return;
                setTemplateFactory(null);
                setTemplateCard(prefetchedTemplateCard ?? null);
            }
        };

        void loadTemplateResources();

        return () => {
            cancelled = true;
        };
    }, [prefetchedTemplateCard, templateId]);

    const templateCountries = useMemo(
        () => templateCard?.countries?.map((country) => country.name).filter(Boolean)
            || prefetchedTrip?.exampleTemplateCountries
            || [],
        [templateCard, prefetchedTrip]
    );

    useEffect(() => {
        if (!templateId) {
            navigate('/', { replace: true });
            return;
        }

        const hasActiveExampleTrip =
            !!trip &&
            trip.isExample === true &&
            trip.exampleTemplateId === templateId;
        const hasHydratedTemplate = hydratedTemplateRef.current === templateId;
        const shouldHydrateTrip = !hasHydratedTemplate || !hasActiveExampleTrip;

        if (shouldHydrateTrip && prefetchedTrip) {
            const resolvedView = prefetchedView ?? prefetchedTrip.defaultView;
            setViewSettings(resolvedView);
            onTripLoaded(prefetchedTrip, resolvedView);
            hydratedTemplateRef.current = templateId;
        } else if (shouldHydrateTrip) {
            if (templateFactory === undefined) return;
            if (typeof templateFactory !== 'function') {
                navigate('/', { replace: true });
                return;
            }

            const nowMs = Date.now();
            const generated = templateFactory(new Date(nowMs).toISOString());
            const resolvedView: IViewSettings = {
                layoutMode: generated.defaultView?.layoutMode ?? 'horizontal',
                timelineView: generated.defaultView?.timelineView ?? 'horizontal',
                mapStyle: generated.defaultView?.mapStyle ?? 'standard',
                zoomLevel: generated.defaultView?.zoomLevel ?? 1,
                routeMode: generated.defaultView?.routeMode,
                showCityNames: generated.defaultView?.showCityNames,
                sidebarWidth: generated.defaultView?.sidebarWidth,
                timelineHeight: generated.defaultView?.timelineHeight,
            };
            const prepared: ITrip = {
                ...generated,
                createdAt: nowMs,
                updatedAt: nowMs,
                isFavorite: false,
                isExample: true,
                exampleTemplateId: templateId,
                exampleTemplateCountries: templateCountries,
                sourceKind: 'example',
                defaultView: resolvedView,
            };

            setViewSettings(resolvedView);
            onTripLoaded(prepared, resolvedView);
            hydratedTemplateRef.current = templateId;
        }

        if (trackedTemplateRef.current !== templateId) {
            trackedTemplateRef.current = templateId;
            trackEvent('example_trip__open', {
                template: templateId,
                country_count: templateCountries.length,
            });
        }
    }, [templateCountries, templateFactory, templateId, trip, prefetchedTrip, prefetchedView, navigate, onTripLoaded]);

    const activeTrip = useMemo(() => {
        if (trip?.isExample && trip.exampleTemplateId === templateId) {
            return trip;
        }
        return prefetchedTrip;
    }, [templateId, trip, prefetchedTrip]);

    const handleCopyExampleTrip = async () => {
        if (!activeTrip || !templateId) return;
        if (DB_ENABLED) {
            const limit = await dbCanCreateTrip();
            if (!limit.allowCreate) {
                window.alert(`Trip limit reached (${limit.activeTripCount}/${limit.maxTripCount}). Archive a trip or upgrade to continue.`);
                navigate('/pricing');
                return;
            }
        }
        const now = Date.now();
        const cloned: ITrip = {
            ...activeTrip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isExample: false,
            status: 'active',
            tripExpiresAt: resolveTripExpiry(now),
            sourceKind: 'duplicate_trip',
            sourceTemplateId: templateId,
            exampleTemplateId: undefined,
            exampleTemplateCountries: undefined,
            forkedFromExampleTemplateId: templateId,
        };

        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.setItem('tf_trip_copy_notice', JSON.stringify({
                    tripId: cloned.id,
                    sourceTripId: activeTrip.id,
                    sourceTitle: activeTrip.title,
                    sourceShareToken: null,
                    sourceShareVersionId: null,
                    createdAt: Date.now(),
                }));
            } catch {
                // ignore storage issues
            }
        }

        saveTrip(cloned);
        trackEvent('example_trip__banner--copy_trip', {
            template: templateId,
            country_count: templateCountries.length,
        });

        if (DB_ENABLED) {
            await ensureDbSession();
            await dbUpsertTrip(cloned, viewSettings);
            await dbCreateTripVersion(cloned, viewSettings, 'Data: Copied trip');
        }

        navigate(buildTripUrl(cloned.id));
    };

    const handleCreateSimilarTrip = () => {
        if (!templateId) return;
        const url = buildCreateTripUrl({
            countries: templateCountries,
            meta: {
                source: 'example_trip',
                label: templateCard?.title || 'Example trip',
                templateId,
            },
        });
        trackEvent('example_trip__banner--create_similar', {
            template: templateId,
            country_count: templateCountries.length,
        });
        navigate(url);
    };

    if (!activeTrip || !activeTrip.isExample) return null;

    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <TripView
                trip={activeTrip}
                initialViewSettings={viewSettings ?? activeTrip.defaultView}
                onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
                onViewSettingsChange={(settings) => {
                    setViewSettings(settings);
                    onViewSettingsChange(settings);
                }}
                onOpenManager={() => setIsManagerOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                appLanguage={appLanguage}
                canShare={false}
                onCopyTrip={handleCopyExampleTrip}
                isExamplePreview
                suppressToasts
                suppressReleaseNotice
                exampleTripBanner={{
                    title: templateCard?.title || activeTrip.title,
                    countries: templateCountries,
                    onCreateSimilarTrip: handleCreateSimilarTrip,
                }}
            />
        </Suspense>
    );
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

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAdmin } = useAuth();
    const location = useLocation();

    if (isLoading) return <RouteLoadingFallback />;
    if (!isAdmin) {
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
    const { access } = useAuth();
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => getStoredAppLanguage());
    const [shouldLoadDebugger, setShouldLoadDebugger] = useState<boolean>(() => shouldEnableDebuggerOnBoot());
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

    const handleCommitState = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string }) => {
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
            <ViewTransitionHandler />
            <NavigationPrefetchManager />
            <SpeculationRulesManager />
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
                    path="/admin/dashboard"
                    element={renderWithSuspense(
                        <AdminRoute>
                            <AdminDashboardPage />
                        </AdminRoute>
                    )}
                />
                <Route
                    path="/admin/ai-benchmark"
                    element={renderWithSuspense(
                        <AdminRoute>
                            <AdminAiBenchmarkPage />
                        </AdminRoute>
                    )}
                />
                <Route
                    path="/admin/access"
                    element={renderWithSuspense(
                        <AdminRoute>
                            <AdminAccessPage />
                        </AdminRoute>
                    )}
                />
                <Route 
                    path="/trip/:tripId" 
                    element={
                        <TripLoader
                            trip={trip}
                            onTripLoaded={setTrip}
                            handleUpdateTrip={handleUpdateTrip}
                            handleCommitState={handleCommitState}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                            onLanguageLoaded={setAppLanguage}
                        />
                    } 
                />
                <Route
                    path="/example/:templateId"
                    element={
                        <ExampleTripLoader
                            trip={trip}
                            onTripLoaded={setTrip}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                        />
                    }
                />
                <Route
                    path="/s/:token"
                    element={
                        <SharedTripLoader
                            trip={trip}
                            onTripLoaded={setTrip}
                            setIsManagerOpen={setIsManagerOpen}
                            setIsSettingsOpen={setIsSettingsOpen}
                            appLanguage={appLanguage}
                            onViewSettingsChange={handleViewSettingsChange}
                            onLanguageLoaded={setAppLanguage}
                        />
                    }
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
