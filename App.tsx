import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scales } from '@phosphor-icons/react';
import { AppLanguage, ITrip, ITimelineItem, IViewSettings } from './types';
import { TripManagerProvider } from './contexts/TripManagerContext';
import { CookieConsentBanner } from './components/marketing/CookieConsentBanner';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry } from './services/historyService';
import { buildTripUrl, generateVersionId, getStoredAppLanguage, setStoredAppLanguage } from './services/appRuntimeUtils';
import { DB_ENABLED } from './config/db';
import { GlobalTooltipLayer } from './components/GlobalTooltipLayer';
import { trackEvent } from './services/analyticsService';
import { resolveTripExpiryFromEntitlements } from './config/productLimits';
import { applyDocumentLocale, DEFAULT_LOCALE, normalizeLocale } from './config/locales';
import {
    buildLocalizedMarketingPath,
    extractLocaleFromPath,
    getBlogSlugFromPath,
    isToolRoute,
    stripLocalePrefix,
} from './config/routes';
import { APP_NAME } from './config/appGlobals';
import { useAuth } from './hooks/useAuth';
import {
    dbAdminOverrideTripCommit,
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbUpsertTripWithStatus,
    dbUpsertUserSettings,
    ensureDbSession,
} from './services/dbApi';
import { loadLazyComponentWithRecovery } from './services/lazyImportRecovery';
import { getBlogPostBySlugWithFallback } from './services/blogService';
import { resolvePageTitle } from './services/pageTitleService';
import { setCanonicalDocumentTitle } from './services/tripGenerationTabFeedbackService';
import { useAnalyticsBootstrap } from './app/bootstrap/useAnalyticsBootstrap';
import { useAuthNavigationBootstrap } from './app/bootstrap/useAuthNavigationBootstrap';
import { useDebuggerBootstrap } from './app/bootstrap/useDebuggerBootstrap';
import { useNavigationContextBootstrap } from './app/bootstrap/useNavigationContextBootstrap';
import { useWarmupGate } from './app/bootstrap/useWarmupGate';
import { AppProviderShell } from './app/bootstrap/AppProviderShell';
import { AppRoutes } from './app/routes/AppRoutes';
import { isFirstLoadCriticalPath } from './app/prefetch/isFirstLoadCriticalPath';
import { useConnectivityStatus } from './hooks/useConnectivityStatus';
import { enqueueTripCommitAndSync } from './services/tripSyncManager';
import { GlobalConnectivityBadge } from './components/GlobalConnectivityBadge';
import { normalizeTransportMode } from './shared/transportModes';
import {
    buildPathFromLocationParts,
    isSafeAuthReturnPath,
} from './services/authNavigationService';
const IS_DEV = Boolean((import.meta as any)?.env?.DEV);

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

let tripManagerModulePromise: Promise<{ default: React.ComponentType<any> }> | null = null;

const loadTripManagerModule = (): Promise<{ default: React.ComponentType<any> }> => {
    if (!tripManagerModulePromise) {
        tripManagerModulePromise = import('./components/TripManager').then((module) => ({ default: module.TripManager }));
    }
    return tripManagerModulePromise;
};

const TripManager = lazyWithRecovery('TripManager', () => loadTripManagerModule());
const SettingsModal = lazyWithRecovery('SettingsModal', () => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const OnPageDebugger = lazyWithRecovery('OnPageDebugger', () => import('./components/OnPageDebugger').then((module) => ({ default: module.OnPageDebugger })));
const NavigationPrefetchManager = lazyWithRecovery(
    'NavigationPrefetchManager',
    () => import('./components/NavigationPrefetchManager').then((module) => ({ default: module.NavigationPrefetchManager }))
);
const SpeculationRulesManager = lazyWithRecovery(
    'SpeculationRulesManager',
    () => import('./components/SpeculationRulesManager').then((module) => ({ default: module.SpeculationRulesManager }))
);
const TRIP_MANAGER_FALLBACK_ROWS = [0, 1, 2, 3, 4, 5];

const normalizeTripForRuntimeLoad = (trip: ITrip): ITrip => {
    let didChange = false;

    const normalizedItems = trip.items.map((item) => {
        if (item.type !== 'travel' && item.type !== 'travel-empty') return item;

        const nextMode = normalizeTransportMode(item.transportMode);
        const nextType: ITimelineItem['type'] = nextMode === 'na' ? 'travel-empty' : 'travel';
        const modeChanged = item.transportMode !== nextMode;
        const typeChanged = item.type !== nextType;
        const shouldClearRouteMetrics = (
            modeChanged || nextMode === 'na'
        ) && (
            item.routeDistanceKm !== undefined || item.routeDurationHours !== undefined
        );

        if (!modeChanged && !typeChanged && !shouldClearRouteMetrics) return item;

        didChange = true;
        return {
            ...item,
            type: nextType,
            transportMode: nextMode,
            routeDistanceKm: shouldClearRouteMetrics ? undefined : item.routeDistanceKm,
            routeDurationHours: shouldClearRouteMetrics ? undefined : item.routeDurationHours,
        };
    });

    if (!didChange) return trip;
    return {
        ...trip,
        items: normalizedItems,
    };
};

const TripManagerLoadingFallback: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
    <>
        <button
            type="button"
            className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[1100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
            }}
            onClick={onClose}
            aria-label="Close My Plans panel"
        />
        <div
            className={`fixed inset-y-0 right-0 w-[380px] max-w-[94vw] bg-white shadow-2xl z-[1200] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">My Plans</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    aria-label="Close"
                >
                    x
                </button>
            </div>
            <div className="px-3 py-2 border-b border-gray-100">
                <div className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                {TRIP_MANAGER_FALLBACK_ROWS.map((row) => (
                    <div key={row} className="rounded-lg border border-gray-100 bg-white px-2 py-2">
                        <div className="animate-pulse">
                            <div className="h-3.5 w-32 rounded bg-gray-200" />
                            <div className="mt-2 h-2.5 w-44 rounded bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </>
);

const isNavPrefetchEnabled = (): boolean => {
    const navPrefetchEnabledByEnv = (import.meta as any)?.env?.VITE_NAV_PREFETCH_ENABLED;
    if (navPrefetchEnabledByEnv === 'true') return true;
    if (navPrefetchEnabledByEnv === 'false') return false;
    return Boolean((import.meta as any)?.env?.PROD);
};

const ViewTransitionHandler: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    useEffect(() => {
        if (!enabled) return;
        // Keep legacy prewarm as a fallback path only when the new
        // navigation prefetch manager is disabled.
        if (isNavPrefetchEnabled()) return;

        let fallbackWarmupModulePromise: Promise<{
            getPathnameFromHref: (href: string) => string;
            preloadRouteForPath: (pathname: string) => Promise<void>;
        }> | null = null;
        const loadFallbackWarmupModule = async () => {
            if (!fallbackWarmupModulePromise) {
                fallbackWarmupModulePromise = import('./app/prefetch/fallbackRouteWarmup');
            }
            return fallbackWarmupModulePromise;
        };

        const warmLinkTarget = async (target: EventTarget | null) => {
            const anchor = (target as HTMLElement | null)?.closest?.('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || !href.startsWith('/')) return;
            const { getPathnameFromHref, preloadRouteForPath } = await loadFallbackWarmupModule();
            const pathname = getPathnameFromHref(href);
            await preloadRouteForPath(pathname);
        };

        const handleMouseOver = (event: MouseEvent) => {
            void warmLinkTarget(event.target);
        };
        const handleFocusIn = (event: FocusEvent) => {
            void warmLinkTarget(event.target);
        };
        const handleTouchStart = (event: TouchEvent) => {
            void warmLinkTarget(event.target);
        };

        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('touchstart', handleTouchStart, true);

        // Warm high-traffic marketing routes in dev so first local navigation
        // does not wait on Vite's on-demand transforms.
        let warmupTimerId: number | null = null;
        if (IS_DEV) {
            warmupTimerId = window.setTimeout(() => {
                void loadFallbackWarmupModule().then(({ preloadRouteForPath }) => Promise.all([
                    preloadRouteForPath('/features'),
                    preloadRouteForPath('/inspirations'),
                    preloadRouteForPath('/blog'),
                    preloadRouteForPath('/pricing'),
                ]));
            }, 600);
        }
        return () => {
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('focusin', handleFocusIn, true);
            document.removeEventListener('touchstart', handleTouchStart, true);
            if (warmupTimerId !== null) window.clearTimeout(warmupTimerId);
        };
    }, [enabled]);

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

const TERMS_EXEMPT_PATHS = new Set([
    '/terms',
    '/privacy',
    '/cookies',
    '/imprint',
    '/login',
    '/auth/reset-password',
]);

export const shouldRedirectToTermsAcceptance = (options: {
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    hasAccess: boolean;
    isAnonymous: boolean;
    isAdmin: boolean;
    termsAcceptanceRequired: boolean;
    pathname: string;
}): boolean => {
    if (options.isAuthLoading) return false;
    if (!options.isAuthenticated || !options.hasAccess || options.isAnonymous) return false;
    if (!options.termsAcceptanceRequired) return false;

    const strippedPath = stripLocalePrefix(options.pathname);
    if (options.isAdmin && strippedPath.startsWith('/admin')) return false;
    if (TERMS_EXEMPT_PATHS.has(strippedPath)) return false;
    return isToolRoute(options.pathname);
};

export type TermsNoticeState = 'none' | 'force' | 'inform';

export const resolveTermsNoticeState = (options: {
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    hasAccess: boolean;
    isAnonymous: boolean;
    termsAcceptanceRequired: boolean;
    termsNoticeRequired: boolean;
}): TermsNoticeState => {
    if (options.isAuthLoading) return 'none';
    if (!options.isAuthenticated || !options.hasAccess || options.isAnonymous) return 'none';
    if (options.termsAcceptanceRequired) return 'force';
    if (options.termsNoticeRequired) return 'inform';
    return 'none';
};

const AppContent: React.FC = () => {
    const { i18n, t } = useTranslation(['common', 'pages', 'auth', 'wip', 'legal']);
    const { access, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [dismissedTermsNoticeVersion, setDismissedTermsNoticeVersion] = useState<string | null>(null);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => getStoredAppLanguage());
    const navigate = useNavigate();
    const location = useLocation();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const userSettingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shouldLoadDebugger = useDebuggerBootstrap({ appName: APP_NAME, isDev: IS_DEV });
    const isFirstLoadCritical = useMemo(
        () => isFirstLoadCriticalPath(location.pathname),
        [location.pathname]
    );
    const isWarmupEnabled = useWarmupGate({ interactionOnly: isFirstLoadCritical });
    const shouldSuppressSpeculationRules = isFirstLoadCritical;

    useAuthNavigationBootstrap();
    useNavigationContextBootstrap();
    useAnalyticsBootstrap();

    useEffect(() => {
        if (isAuthLoading) return;
        const strippedPath = stripLocalePrefix(location.pathname);
        const isAuthPath = strippedPath === '/login' || strippedPath === '/auth/reset-password';
        if (!isAuthenticated || !access || access.isAnonymous || isAuthPath) return;

        if (access.accountStatus !== 'active') {
            void logout();
            navigate('/login', { replace: true });
        }
    }, [access, isAuthLoading, isAuthenticated, location.pathname, location.search, logout, navigate]);

    useEffect(() => {
        if (!shouldRedirectToTermsAcceptance({
            isAuthenticated,
            isAuthLoading,
            hasAccess: Boolean(access),
            isAnonymous: Boolean(access?.isAnonymous),
            isAdmin: access?.role === 'admin',
            termsAcceptanceRequired: Boolean(access?.termsAcceptanceRequired),
            pathname: location.pathname,
        })) {
            return;
        }

        const localeFromPath = extractLocaleFromPath(location.pathname);
        const activeLocale = localeFromPath ?? normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? appLanguage);
        const termsPath = buildLocalizedMarketingPath('terms', activeLocale);
        const currentRoutePath = buildPathFromLocationParts({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
        });
        const nextPath = isSafeAuthReturnPath(currentRoutePath) ? currentRoutePath : '/create-trip';
        const query = new URLSearchParams();
        query.set('accept', 'required');
        query.set('next', nextPath);

        const redirectTarget = `${termsPath}?${query.toString()}`;
        const currentTarget = `${location.pathname}${location.search}`;
        if (currentTarget === redirectTarget) return;

        navigate(redirectTarget, { replace: true });
    }, [
        access,
        appLanguage,
        i18n.language,
        i18n.resolvedLanguage,
        isAuthLoading,
        isAuthenticated,
        location.hash,
        location.pathname,
        location.search,
        navigate,
    ]);

    const resolvedRouteLocale = useMemo<AppLanguage>(() => {
        const localeFromPath = extractLocaleFromPath(location.pathname);
        if (isToolRoute(location.pathname)) {
            if (localeFromPath) return localeFromPath;
            return normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? appLanguage);
        }

        if (localeFromPath) return localeFromPath;
        return DEFAULT_LOCALE;
    }, [appLanguage, i18n.language, i18n.resolvedLanguage, location.pathname]);

    const termsNoticeState = useMemo(
        () => resolveTermsNoticeState({
            isAuthenticated,
            isAuthLoading,
            hasAccess: Boolean(access),
            isAnonymous: Boolean(access?.isAnonymous),
            termsAcceptanceRequired: Boolean(access?.termsAcceptanceRequired),
            termsNoticeRequired: Boolean(access?.termsNoticeRequired),
        }),
        [access, isAuthLoading, isAuthenticated]
    );
    const hasResolvedAuthAccess = !isAuthLoading && (!isAuthenticated || Boolean(access));
    const forceRedirectApplies = hasResolvedAuthAccess && shouldRedirectToTermsAcceptance({
        isAuthenticated,
        isAuthLoading,
        hasAccess: Boolean(access),
        isAnonymous: Boolean(access?.isAnonymous),
        isAdmin: access?.role === 'admin',
        termsAcceptanceRequired: Boolean(access?.termsAcceptanceRequired),
        pathname: location.pathname,
    });

    const termsNoticeVersion = access?.termsCurrentVersion ?? null;
    const shouldShowInformTermsNotice = (
        termsNoticeState === 'inform'
        && Boolean(termsNoticeVersion)
        && dismissedTermsNoticeVersion !== termsNoticeVersion
    );
    const shouldShowForceTermsNotice = termsNoticeState === 'force';
    const isTermsRoute = stripLocalePrefix(location.pathname) === '/terms';
    const shouldEvaluateTermsGate = isToolRoute(location.pathname) && !isTermsRoute;
    const canResolveTermsGate = !isAuthLoading && (!isAuthenticated || Boolean(access));
    const shouldBlockForTermsGate = shouldEvaluateTermsGate && (!canResolveTermsGate || forceRedirectApplies);
    const shouldRenderTermsNotice = (
        hasResolvedAuthAccess
        && !isTermsRoute
        && (shouldShowForceTermsNotice || shouldShowInformTermsNotice)
        && !forceRedirectApplies
    );

    useEffect(() => {
        if (!termsNoticeVersion) {
            if (dismissedTermsNoticeVersion !== null) {
                setDismissedTermsNoticeVersion(null);
            }
            return;
        }
        if (dismissedTermsNoticeVersion && dismissedTermsNoticeVersion !== termsNoticeVersion) {
            setDismissedTermsNoticeVersion(null);
        }
    }, [dismissedTermsNoticeVersion, termsNoticeVersion]);

    const openTermsFromNotice = useCallback((mode: 'force' | 'inform') => {
        const termsPath = buildLocalizedMarketingPath('terms', resolvedRouteLocale);
        const query = new URLSearchParams();
        if (mode === 'force') {
            const currentRoutePath = buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            });
            const nextPath = isSafeAuthReturnPath(currentRoutePath) ? currentRoutePath : '/create-trip';
            query.set('accept', 'required');
            query.set('next', nextPath);
        } else {
            query.set('notice', 'updated');
        }
        const target = query.size > 0 ? `${termsPath}?${query.toString()}` : termsPath;
        navigate(target, { replace: false });
    }, [location.hash, location.pathname, location.search, navigate, resolvedRouteLocale]);

    const pageTitleLabels = useMemo(() => ({
        features: t('nav.features', { ns: 'common' }),
        inspirations: t('nav.inspirations', { ns: 'common' }),
        updates: t('nav.updates', { ns: 'common' }),
        blog: t('nav.blog', { ns: 'common' }),
        pricing: t('nav.pricing', { ns: 'common' }),
        faq: t('faq.title', { ns: 'wip' }),
        contact: t('footer.contact', { ns: 'common' }),
        imprint: t('footer.imprint', { ns: 'common' }),
        privacy: t('footer.privacy', { ns: 'common' }),
        terms: t('footer.terms', { ns: 'common' }),
        cookies: t('footer.cookies', { ns: 'common' }),
        login: t('nav.login', { ns: 'common' }),
        resetPassword: t('reset.title', { ns: 'auth' }),
        shareUnavailable: t('shareUnavailable.title', { ns: 'pages' }),
        createTrip: t('nav.createTrip', { ns: 'common' }),
        createTripLab: `${t('nav.createTrip', { ns: 'common' })} Labs`,
        profile: 'Profile',
        profileSettings: 'Profile settings',
        profileOnboarding: 'Complete profile',
        admin: t('nav.admin', { ns: 'common' }),
        notFound: '404',
    }), [t, i18n.resolvedLanguage]);

    const blogPostTitle = useMemo(() => {
        const blogSlug = getBlogSlugFromPath(location.pathname);
        if (!blogSlug) return null;
        return getBlogPostBySlugWithFallback(blogSlug, resolvedRouteLocale)?.title ?? null;
    }, [location.pathname, resolvedRouteLocale]);

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

    useEffect(() => {
        const nextTitle = resolvePageTitle({
            pathname: location.pathname,
            appName: APP_NAME,
            labels: pageTitleLabels,
            tripTitle: trip?.title || null,
            blogPostTitle,
        });
        setCanonicalDocumentTitle(nextTitle);
    }, [blogPostTitle, location.pathname, pageTitleLabels, trip?.title]);

    const isInitialLanguageRef = useRef(true);
    useEffect(() => {
        setStoredAppLanguage(appLanguage);
        // Skip DB write on initial mount — only persist when user changes the language.
        if (isInitialLanguageRef.current) {
            isInitialLanguageRef.current = false;
            return;
        }
        if (DB_ENABLED && isAuthenticated && access && !access.isAnonymous) {
            void dbUpsertUserSettings({ language: appLanguage });
        }
    }, [access, appLanguage, isAuthenticated]);

    const handleViewSettingsChange = (settings: IViewSettings) => {
        if (!DB_ENABLED) return;
        if (!isAuthenticated || !access || access.isAnonymous) return;
        if (userSettingsSaveRef.current) {
            clearTimeout(userSettingsSaveRef.current);
        }
        userSettingsSaveRef.current = setTimeout(() => {
            void dbUpsertUserSettings({
                mapStyle: settings.mapStyle,
                routeMode: settings.routeMode,
                layoutMode: settings.layoutMode,
                timelineMode: settings.timelineMode,
                timelineView: settings.timelineView,
                showCityNames: settings.showCityNames,
                zoomLevel: settings.zoomLevel,
                sidebarWidth: settings.sidebarWidth,
                timelineHeight: settings.timelineHeight,
            });
        }, 800);
    };

    const handleUpdateTrip = useCallback((updatedTrip: ITrip, options?: { persist?: boolean }) => {
        setTrip(updatedTrip);
        if (options?.persist === false) return;
        saveTrip(updatedTrip);
    }, []);

    const handleTripManagerUpdate = useCallback((updatedTrip: ITrip) => {
        setTrip((currentTrip) => {
            if (!currentTrip || currentTrip.id !== updatedTrip.id) return currentTrip;
            if (Object.is(currentTrip, updatedTrip)) return currentTrip;
            return updatedTrip;
        });
    }, []);

    const enqueueTripCommitFallback = useCallback((updatedTrip: ITrip, view: IViewSettings | undefined, label: string) => {
        enqueueTripCommitAndSync({
            tripId: updatedTrip.id,
            tripSnapshot: updatedTrip,
            viewSnapshot: view ?? null,
            label,
        });
    }, []);

    const commitOwnedTripResilient = useCallback(async (
        updatedTrip: ITrip,
        view: IViewSettings | undefined,
        label: string,
    ): Promise<boolean> => {
        const canAttemptRemote = DB_ENABLED && connectivitySnapshot.state === 'online';
        if (!canAttemptRemote) {
            enqueueTripCommitFallback(updatedTrip, view, label);
            return false;
        }

        const sessionId = await ensureDbSession();
        if (!sessionId) {
            enqueueTripCommitFallback(updatedTrip, view, label);
            return false;
        }

        const upsertResult = await dbUpsertTripWithStatus(updatedTrip, view);
        if (!upsertResult.tripId) {
            if (upsertResult.isPermissionError) {
                return false;
            }
            enqueueTripCommitFallback(updatedTrip, view, label);
            return false;
        }
        const versionId = await dbCreateTripVersion(updatedTrip, view, label);
        if (!versionId) {
            enqueueTripCommitFallback(updatedTrip, view, label);
            return false;
        }
        return true;
    }, [connectivitySnapshot.state, enqueueTripCommitFallback]);

    const handleCommitState = (updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string; adminOverride?: boolean }) => {
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();

        if (!DB_ENABLED) {
            createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);
            return;
        }

        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);

        const commit = async () => {
            if (options?.adminOverride) {
                const sessionId = await ensureDbSession();
                if (!sessionId) return;
                const overrideCommit = await dbAdminOverrideTripCommit(updatedTrip, view, label);
                if (!overrideCommit?.tripId || !overrideCommit.versionId) return;
                return;
            }
            await commitOwnedTripResilient(updatedTrip, view, label);
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
                    tripExpiresAt: resolveTripExpiryFromEntitlements(
                        now,
                        newTrip.tripExpiresAt || existingTrip.tripExpiresAt,
                        access?.entitlements.tripExpirationDays
                    ),
                    sourceKind: newTrip.sourceKind || existingTrip.sourceKind || 'created',
                };

                setTrip(updatedTrip);
                saveTrip(updatedTrip);
                const commitTs = Date.now();
                createLocalHistoryEntry(navigate, updatedTrip, undefined, 'Data: Updated generated trip', { replace: true }, commitTs);

                if (DB_ENABLED) {
                    await commitOwnedTripResilient(updatedTrip, undefined, 'Data: Updated generated trip');
                }
                return;
            }

            if (DB_ENABLED && connectivitySnapshot.state === 'online') {
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
                tripExpiresAt: resolveTripExpiryFromEntitlements(
                    now,
                    newTrip.tripExpiresAt,
                    access?.entitlements.tripExpirationDays
                ),
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
            await commitOwnedTripResilient(preparedTrip, undefined, 'Data: Created trip');
        };

        void create();
    };

    const handleRouteTripLoaded = useCallback((loadedTrip: ITrip) => {
        setTrip(normalizeTripForRuntimeLoad(loadedTrip));
    }, []);

    const handleLoadTrip = (loadedTrip: ITrip) => {
        setTrip(normalizeTripForRuntimeLoad(loadedTrip));
        setIsManagerOpen(false);
        navigate(buildTripUrl(loadedTrip.id));
    };

    const prewarmTripManager = useCallback(() => {
        void loadTripManagerModule().catch(() => undefined);
    }, []);

    const openTripManager = useCallback(() => {
        prewarmTripManager();
        setIsManagerOpen(true);
    }, [prewarmTripManager]);

    return (
        <TripManagerProvider openTripManager={openTripManager} prewarmTripManager={prewarmTripManager}>
            <GlobalConnectivityBadge />
            <ViewTransitionHandler enabled={isWarmupEnabled} />
            {isWarmupEnabled && (
                <Suspense fallback={null}>
                    <NavigationPrefetchManager enabled />
                    <SpeculationRulesManager enabled={!shouldSuppressSpeculationRules} />
                </Suspense>
            )}
            {shouldRenderTermsNotice && (
                <section
                    className={`mx-auto w-full max-w-[1600px] px-4 pt-3 ${shouldShowForceTermsNotice ? 'text-rose-950' : 'text-accent-950'} sm:px-6 lg:px-8`}
                    aria-live={shouldShowForceTermsNotice ? 'assertive' : 'polite'}
                >
                    <div
                        className={`rounded-2xl border px-4 py-3 shadow-sm sm:flex sm:items-start sm:justify-between sm:gap-4 ${
                            shouldShowForceTermsNotice
                                ? 'border-rose-200 bg-rose-50'
                                : 'border-accent-200 bg-accent-50'
                        }`}
                    >
                        <div className="flex min-w-0 items-start gap-3">
                            <span
                                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                                    shouldShowForceTermsNotice
                                        ? 'border-rose-200 bg-rose-100 text-rose-700'
                                        : 'border-accent-200 bg-accent-100 text-accent-700'
                                }`}
                                aria-hidden="true"
                            >
                                <Scales size={18} weight="duotone" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                    {shouldShowForceTermsNotice
                                        ? t('termsPage.globalForceTitle', { ns: 'legal' })
                                        : t('termsPage.globalInformTitle', { ns: 'legal' })}
                                </p>
                                <p className="mt-1 text-xs leading-5">
                                    {shouldShowForceTermsNotice
                                        ? t('termsPage.globalForceDescription', { ns: 'legal' })
                                        : t('termsPage.globalInformDescription', { ns: 'legal' })}
                                </p>
                                {termsNoticeVersion && (
                                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">
                                        {t('termsPage.versionLabel', { ns: 'legal' })}: {termsNoticeVersion}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 sm:mt-0">
                            <button
                                type="button"
                                onClick={() => openTermsFromNotice(shouldShowForceTermsNotice ? 'force' : 'inform')}
                                className="inline-flex h-9 items-center rounded-lg bg-accent-700 px-3 text-xs font-semibold text-white hover:bg-accent-800"
                            >
                                {t('termsPage.globalReviewAction', { ns: 'legal' })}
                            </button>
                            {shouldShowInformTermsNotice && termsNoticeVersion && (
                                <button
                                    type="button"
                                    onClick={() => setDismissedTermsNoticeVersion(termsNoticeVersion)}
                                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                                >
                                    {t('termsPage.globalDismissAction', { ns: 'legal' })}
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            )}
            {shouldBlockForTermsGate ? (
                <div className="min-h-[42vh] w-full bg-slate-50" aria-hidden="true" />
            ) : (
                <AppRoutes
                    trip={trip}
                    appLanguage={appLanguage}
                    onAppLanguageLoaded={setAppLanguage}
                    onTripGenerated={handleTripGenerated}
                    onTripLoaded={handleRouteTripLoaded}
                    onUpdateTrip={handleUpdateTrip}
                    onCommitState={handleCommitState}
                    onViewSettingsChange={handleViewSettingsChange}
                    onOpenManager={openTripManager}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />
            )}

            {isManagerOpen && (
                <Suspense fallback={<TripManagerLoadingFallback isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />}>
                    <TripManager
                        isOpen={isManagerOpen}
                        onClose={() => setIsManagerOpen(false)}
                        onSelectTrip={handleLoadTrip}
                        currentTripId={trip?.id}
                        onUpdateTrip={handleTripManagerUpdate}
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
        <AppProviderShell>
            <AppContent />
        </AppProviderShell>
    );
};

export default App;
