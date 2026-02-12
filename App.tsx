import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, Suspense, lazy } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation, useParams } from 'react-router-dom';
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
import { buildTripExpiryIso } from './config/productLimits';
import { getTripLifecycleState } from './config/paywall';
import { NavigationPrefetchManager } from './components/NavigationPrefetchManager';
import { SpeculationRulesManager } from './components/SpeculationRulesManager';

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

const CreateTripForm = lazy(() => import('./components/CreateTripForm').then((module) => ({ default: module.CreateTripForm })));
const TripView = lazy(() => import('./components/TripView').then((module) => ({ default: module.TripView })));
const TripManager = lazy(() => import('./components/TripManager').then((module) => ({ default: module.TripManager })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const OnPageDebugger = lazy(() => import('./components/OnPageDebugger').then((module) => ({ default: module.OnPageDebugger })));
const MarketingHomePage = lazy(() => import('./pages/MarketingHomePage').then((module) => ({ default: module.MarketingHomePage })));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage').then((module) => ({ default: module.FeaturesPage })));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage').then((module) => ({ default: module.UpdatesPage })));
const BlogPage = lazy(() => import('./pages/BlogPage').then((module) => ({ default: module.BlogPage })));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage').then((module) => ({ default: module.BlogPostPage })));
const InspirationsPage = lazy(() => import('./pages/InspirationsPage').then((module) => ({ default: module.InspirationsPage })));
const ThemesPage = lazy(() => import('./pages/inspirations/ThemesPage').then((module) => ({ default: module.ThemesPage })));
const BestTimeToTravelPage = lazy(() => import('./pages/inspirations/BestTimeToTravelPage').then((module) => ({ default: module.BestTimeToTravelPage })));
const CountriesPage = lazy(() => import('./pages/inspirations/CountriesPage').then((module) => ({ default: module.CountriesPage })));
const FestivalsPage = lazy(() => import('./pages/inspirations/FestivalsPage').then((module) => ({ default: module.FestivalsPage })));
const WeekendGetawaysPage = lazy(() => import('./pages/inspirations/WeekendGetawaysPage').then((module) => ({ default: module.WeekendGetawaysPage })));
const CountryDetailPage = lazy(() => import('./pages/inspirations/CountryDetailPage').then((module) => ({ default: module.CountryDetailPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ImprintPage = lazy(() => import('./pages/ImprintPage').then((module) => ({ default: module.ImprintPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((module) => ({ default: module.TermsPage })));
const CookiesPage = lazy(() => import('./pages/CookiesPage').then((module) => ({ default: module.CookiesPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminAiBenchmarkPage = lazy(() => import('./pages/AdminAiBenchmarkPage').then((module) => ({ default: module.AdminAiBenchmarkPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const FaqPage = lazy(() => import('./pages/FaqPage').then((module) => ({ default: module.FaqPage })));
const ShareUnavailablePage = lazy(() => import('./pages/ShareUnavailablePage').then((module) => ({ default: module.ShareUnavailablePage })));
const CreateTripClassicLabPage = lazy(() => import('./pages/CreateTripClassicLabPage').then((module) => ({ default: module.CreateTripClassicLabPage })));
const CreateTripSplitWorkspaceLabPage = lazy(() => import('./pages/CreateTripSplitWorkspaceLabPage').then((module) => ({ default: module.CreateTripSplitWorkspaceLabPage })));
const CreateTripJourneyArchitectLabPage = lazy(() => import('./pages/CreateTripJourneyArchitectLabPage').then((module) => ({ default: module.CreateTripJourneyArchitectLabPage })));

const RouteLoadingFallback: React.FC = () => (
    <div className="min-h-[42vh] w-full bg-slate-50" aria-hidden="true" />
);

const renderWithSuspense = (node: React.ReactElement) => (
    <Suspense fallback={<RouteLoadingFallback />}>
        {node}
    </Suspense>
);

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

/** Intercept internal link clicks to wrap in View Transition API.
 *  Uses the capture phase so we run BEFORE React Router's onClick,
 *  preventing a double-navigate that causes duplicated content. */
const ViewTransitionHandler: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (!document.startViewTransition) return;

        const handleClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement).closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || !href.startsWith('/')) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (href.startsWith('#')) return;
            // Skip same-page navigations
            if (href === window.location.pathname) return;

            e.preventDefault();
            e.stopPropagation();

            document.startViewTransition(() => {
                flushSync(() => {
                    navigate(href);
                });
            });
        };

        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [navigate]);

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
    const lastLoadRef = useRef<string | null>(null);
    const [shareMode, setShareMode] = useState<'view' | 'edit'>('view');
    const [allowCopy, setAllowCopy] = useState(true);
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const [snapshotState, setSnapshotState] = useState<{ hasNewer: boolean; latestUrl: string } | null>(null);
    const [sourceShareVersionId, setSourceShareVersionId] = useState<string | null>(null);

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
            tripExpiresAt: buildTripExpiryIso(now),
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
    const [viewSettings, setViewSettings] = useState<IViewSettings | undefined>(undefined);
    const trackedTemplateRef = useRef<string | null>(null);
    const [templateFactory, setTemplateFactory] = useState<ExampleTemplateFactory | null | undefined>(undefined);
    const [templateCard, setTemplateCard] = useState<ExampleTripCardSummary | null>(null);
    const templateCountries = useMemo(
        () => templateCard?.countries?.map((country) => country.name).filter(Boolean) || [],
        [templateCard]
    );

    useEffect(() => {
        if (!templateId) {
            setTemplateFactory(null);
            setTemplateCard(null);
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
                // React treats function arguments to setState as updaters; wrap to store the function itself.
                setTemplateFactory(() => nextFactory);
                setTemplateCard((getExampleTripCardByTemplateId(templateId) as ExampleTripCardSummary | undefined) ?? null);
            } catch {
                if (cancelled) return;
                setTemplateFactory(null);
                setTemplateCard(null);
            }
        };

        void loadTemplateResources();

        return () => {
            cancelled = true;
        };
    }, [templateId]);

    useEffect(() => {
        if (!templateId) {
            navigate('/', { replace: true });
            return;
        }

        if (templateFactory === undefined) {
            return;
        }

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

        if (trackedTemplateRef.current !== templateId) {
            trackedTemplateRef.current = templateId;
            trackEvent('example_trip__open', {
                template: templateId,
                country_count: templateCountries.length,
            });
        }
    }, [templateCountries, templateFactory, templateId, navigate, onTripLoaded]);

    const handleCopyExampleTrip = async () => {
        if (!trip || !templateId) return;
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
            ...trip,
            id: generateTripId(),
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isExample: false,
            status: 'active',
            tripExpiresAt: buildTripExpiryIso(now),
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
                    sourceTripId: trip.id,
                    sourceTitle: trip.title,
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

    if (!trip || !trip.isExample) return null;

    return (
        <Suspense fallback={<RouteLoadingFallback />}>
            <TripView
                trip={trip}
                initialViewSettings={viewSettings ?? trip.defaultView}
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
                    title: templateCard?.title || trip.title,
                    countries: templateCountries,
                    onCreateSimilarTrip: handleCreateSimilarTrip,
                }}
            />
        </Suspense>
    );
};

/** Thin wrapper that triggers DB sync when the create-trip page mounts. */
const CreateTripRoute: React.FC<{
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

const AppContent: React.FC = () => {
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

    // DB sync (session, upload, sync, user settings) is deferred to trip-related
    // routes via useDbSync to avoid unnecessary network calls on marketing pages.

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
                    `[TravelFlow] toggleSimulatedLogin(${typeof force === 'boolean' ? force : 'toggle'}) -> ${next ? 'SIMULATED LOGGED-IN' : 'ANONYMOUS'}`
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
                tripExpiresAt: newTrip.tripExpiresAt || buildTripExpiryIso(now),
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
                <Route 
                    path="/" 
                    element={renderWithSuspense(<MarketingHomePage />)}
                />
                <Route
                    path="/create-trip"
                    element={
                        renderWithSuspense(<CreateTripRoute
                            onTripGenerated={handleTripGenerated}
                            onOpenManager={() => setIsManagerOpen(true)}
                            onLanguageLoaded={setAppLanguage}
                        />)
                    } 
                />
                <Route
                    path="/create-trip/labs/classic-card"
                    element={
                        renderWithSuspense(<CreateTripClassicLabPage
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
                <Route path="/features" element={renderWithSuspense(<FeaturesPage />)} />
                <Route path="/inspirations" element={renderWithSuspense(<InspirationsPage />)} />
                <Route path="/inspirations/themes" element={renderWithSuspense(<ThemesPage />)} />
                <Route path="/inspirations/best-time-to-travel" element={renderWithSuspense(<BestTimeToTravelPage />)} />
                <Route path="/inspirations/countries" element={renderWithSuspense(<CountriesPage />)} />
                <Route path="/inspirations/events-and-festivals" element={renderWithSuspense(<FestivalsPage />)} />
                <Route path="/inspirations/weekend-getaways" element={renderWithSuspense(<WeekendGetawaysPage />)} />
                <Route path="/inspirations/country/:countryName" element={renderWithSuspense(<CountryDetailPage />)} />
                <Route path="/updates" element={renderWithSuspense(<UpdatesPage />)} />
                <Route path="/blog" element={renderWithSuspense(<BlogPage />)} />
                <Route path="/blog/:slug" element={renderWithSuspense(<BlogPostPage />)} />
                <Route path="/pricing" element={renderWithSuspense(<PricingPage />)} />
                <Route path="/faq" element={renderWithSuspense(<FaqPage />)} />
                <Route path="/share-unavailable" element={renderWithSuspense(<ShareUnavailablePage />)} />
                <Route path="/login" element={renderWithSuspense(<LoginPage />)} />
                <Route path="/imprint" element={renderWithSuspense(<ImprintPage />)} />
                <Route path="/privacy" element={renderWithSuspense(<PrivacyPage />)} />
                <Route path="/terms" element={renderWithSuspense(<TermsPage />)} />
                <Route path="/cookies" element={renderWithSuspense(<CookiesPage />)} />
                <Route path="/admin/dashboard" element={renderWithSuspense(<AdminDashboardPage />)} />
                <Route path="/admin/ai-benchmark" element={renderWithSuspense(<AdminAiBenchmarkPage />)} />
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
                 <Route path="*" element={<Navigate to="/" replace />} />
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
            <AppDialogProvider>
                <AppContent />
            </AppDialogProvider>
        </Router>
    );
};

export default App;
