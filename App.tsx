import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLanguage, ITrip, IViewSettings } from './types';
import { TripManagerProvider } from './contexts/TripManagerContext';
import { CookieConsentBanner } from './components/marketing/CookieConsentBanner';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry } from './services/historyService';
import { buildTripUrl, generateVersionId, getStoredAppLanguage, setStoredAppLanguage } from './services/appRuntimeUtils';
import { DB_ENABLED } from './config/db';
import { GlobalTooltipLayer } from './components/GlobalTooltipLayer';
import { trackEvent } from './services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from './config/productLimits';
import { applyDocumentLocale, DEFAULT_LOCALE, normalizeLocale } from './config/locales';
import { extractLocaleFromPath, isToolRoute, stripLocalePrefix } from './config/routes';
import { APP_NAME } from './config/appGlobals';
import { useAuth } from './hooks/useAuth';
import {
    dbAdminOverrideTripCommit,
    dbCanCreateTrip,
    dbCreateTripVersion,
    dbUpsertTrip,
    dbUpsertUserSettings,
    ensureDbSession,
} from './services/dbApi';
import { loadLazyComponentWithRecovery } from './services/lazyImportRecovery';
import { useAnalyticsBootstrap } from './app/bootstrap/useAnalyticsBootstrap';
import { useAuthNavigationBootstrap } from './app/bootstrap/useAuthNavigationBootstrap';
import { useDebuggerBootstrap } from './app/bootstrap/useDebuggerBootstrap';
import { useWarmupGate } from './app/bootstrap/useWarmupGate';
import { AppProviderShell } from './app/bootstrap/AppProviderShell';
import { AppRoutes } from './app/routes/AppRoutes';
import { isFirstLoadCriticalPath } from './app/prefetch/isFirstLoadCriticalPath';
const IS_DEV = Boolean((import.meta as any)?.env?.DEV);

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const TripManager = lazyWithRecovery('TripManager', () => import('./components/TripManager').then((module) => ({ default: module.TripManager })));
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

const AppContent: React.FC = () => {
    const { i18n } = useTranslation();
    const { access, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
    const [trip, setTrip] = useState<ITrip | null>(null);
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => getStoredAppLanguage());
    const navigate = useNavigate();
    const location = useLocation();
    const userSettingsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shouldLoadDebugger = useDebuggerBootstrap({ appName: APP_NAME, isDev: IS_DEV });
    const isFirstLoadCritical = useMemo(
        () => isFirstLoadCriticalPath(location.pathname),
        [location.pathname]
    );
    const isWarmupEnabled = useWarmupGate({ interactionOnly: isFirstLoadCritical });
    const shouldSuppressSpeculationRules = isFirstLoadCritical;

    useAuthNavigationBootstrap();
    useAnalyticsBootstrap();

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
            <ViewTransitionHandler enabled={isWarmupEnabled} />
            {isWarmupEnabled && (
                <Suspense fallback={null}>
                    <NavigationPrefetchManager enabled />
                    <SpeculationRulesManager enabled={!shouldSuppressSpeculationRules} />
                </Suspense>
            )}
            <AppRoutes
                trip={trip}
                appLanguage={appLanguage}
                onAppLanguageLoaded={setAppLanguage}
                onTripGenerated={handleTripGenerated}
                onTripLoaded={setTrip}
                onUpdateTrip={handleUpdateTrip}
                onCommitState={handleCommitState}
                onViewSettingsChange={handleViewSettingsChange}
                onOpenManager={() => setIsManagerOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {isManagerOpen && (
                <Suspense fallback={<TripManagerLoadingFallback isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />}>
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
        <AppProviderShell>
            <AppContent />
        </AppProviderShell>
    );
};

export default App;
