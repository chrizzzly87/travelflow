import React, { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { BrowserRouter as Router, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLanguage, ITrip, IViewSettings } from './types';
import { TripManagerProvider } from './contexts/TripManagerContext';
import { CookieConsentBanner } from './components/marketing/CookieConsentBanner';
import { saveTrip, getTripById } from './services/storageService';
import { appendHistoryEntry } from './services/historyService';
import { buildTripUrl, generateVersionId, getStoredAppLanguage, setStoredAppLanguage } from './utils';
import { DB_ENABLED } from './config/db';
import { isSimulatedLoggedIn, toggleSimulatedLogin } from './services/simulatedLoginService';
import { AppDialogProvider } from './components/AppDialogProvider';
import { GlobalTooltipLayer } from './components/GlobalTooltipLayer';
import { initializeAnalytics, trackEvent, trackPageView } from './services/analyticsService';
import { ANONYMOUS_TRIP_EXPIRATION_DAYS, buildTripExpiryIso } from './config/productLimits';
import { applyDocumentLocale, DEFAULT_LOCALE, normalizeLocale } from './config/locales';
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
import { AppRoutes } from './app/routes/AppRoutes';
import { getPathnameFromHref, preloadRouteForPath } from './app/prefetch/fallbackRouteWarmup';

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

const TripManager = lazyWithRecovery('TripManager', () => import('./components/TripManager').then((module) => ({ default: module.TripManager })));
const SettingsModal = lazyWithRecovery('SettingsModal', () => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const OnPageDebugger = lazyWithRecovery('OnPageDebugger', () => import('./components/OnPageDebugger').then((module) => ({ default: module.OnPageDebugger })));

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
            <NavigationPrefetchManager enabled={isWarmupEnabled} />
            <SpeculationRulesManager enabled={isWarmupEnabled} />
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
